import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import { JobSourceDocument } from '../schemas/job-source.schema';
import { JobIntelligenceService } from '../services/job-intelligence.service';
import { JobSourceAdapter, NormalizedJobListing } from './job-source-adapter.interface';

type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url?: string;
  updated_at?: string;
  location?: {
    name?: string;
  };
  content?: string;
};

@Injectable()
export class GreenhouseBoardAdapter implements JobSourceAdapter {
  readonly type = 'greenhouse-board' as const;

  constructor(private readonly jobIntelligenceService: JobIntelligenceService) {}

  async fetchJobs(source: JobSourceDocument): Promise<NormalizedJobListing[]> {
    const boardToken = source.config?.boardToken;

    if (typeof boardToken !== 'string' || !boardToken.trim()) {
      throw new BadRequestException('Greenhouse source requires a boardToken in config.');
    }

    const { data } = await axios.get<{ jobs: GreenhouseJob[] }>(
      `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`,
      {
        timeout: 20000,
      },
    );

    return (data.jobs ?? []).map((job) => {
      const description = this.jobIntelligenceService.toPlainText(job.content);
      const location = job.location?.name;

      return {
        externalId: String(job.id),
        title: job.title,
        company: typeof source.config?.company === 'string' ? source.config.company : source.name,
        location,
        remote: this.jobIntelligenceService.inferRemote(location, description),
        employmentType: this.jobIntelligenceService.inferEmploymentType(description),
        url: job.absolute_url,
        description,
        requirements: [],
        skills: this.jobIntelligenceService.extractSkills(job.title, description),
        minExperienceYears: this.jobIntelligenceService.extractYearsExperience(description),
        seniority: this.jobIntelligenceService.inferSeniority(job.title, description),
        postedAt: job.updated_at ? new Date(job.updated_at) : undefined,
        raw: job as unknown as Record<string, unknown>,
      };
    });
  }
}
