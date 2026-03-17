import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import { JobSourceDocument } from '../schemas/job-source.schema';
import { JobIntelligenceService } from '../services/job-intelligence.service';
import { JobSourceAdapter, NormalizedJobListing } from './job-source-adapter.interface';

type LeverPosting = {
  id: string;
  text: string;
  hostedUrl?: string;
  descriptionPlain?: string;
  description?: string;
  categories?: {
    location?: string;
    commitment?: string;
  };
  lists?: Array<{
    text?: string;
    content?: string;
  }>;
  createdAt?: number;
};

@Injectable()
export class LeverPostingsAdapter implements JobSourceAdapter {
  readonly type = 'lever-postings' as const;

  constructor(private readonly jobIntelligenceService: JobIntelligenceService) {}

  async fetchJobs(source: JobSourceDocument): Promise<NormalizedJobListing[]> {
    const companySlug = source.config?.companySlug;

    if (typeof companySlug !== 'string' || !companySlug.trim()) {
      throw new BadRequestException('Lever source requires a companySlug in config.');
    }

    const { data } = await axios.get<LeverPosting[]>(
      `https://api.lever.co/v0/postings/${companySlug}?mode=json`,
      {
        timeout: 20000,
      },
    );

    return (data ?? []).map((posting) => {
      const listContent = (posting.lists ?? [])
        .map((item) => `${item.text ?? ''} ${this.jobIntelligenceService.toPlainText(item.content)}`)
        .join(' ');
      const description = this.jobIntelligenceService.toPlainText(posting.descriptionPlain ?? posting.description);
      const location = posting.categories?.location;
      const combinedDescription = `${description} ${listContent}`.trim();

      return {
        externalId: posting.id,
        title: posting.text,
        company: typeof source.config?.company === 'string' ? source.config.company : source.name,
        location,
        remote: this.jobIntelligenceService.inferRemote(location, combinedDescription),
        employmentType: posting.categories?.commitment ?? this.jobIntelligenceService.inferEmploymentType(combinedDescription),
        url: posting.hostedUrl,
        description: combinedDescription,
        requirements: [],
        skills: this.jobIntelligenceService.extractSkills(posting.text, combinedDescription),
        minExperienceYears: this.jobIntelligenceService.extractYearsExperience(combinedDescription),
        seniority: this.jobIntelligenceService.inferSeniority(posting.text, combinedDescription),
        postedAt: posting.createdAt ? new Date(posting.createdAt) : undefined,
        raw: posting as unknown as Record<string, unknown>,
      };
    });
  }
}
