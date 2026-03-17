import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import { JobSourceDocument } from '../schemas/job-source.schema';
import { JobIntelligenceService } from '../services/job-intelligence.service';
import { JobSourceAdapter, NormalizedJobListing } from './job-source-adapter.interface';

type AshbyJobPosting = {
  id: string;
  title: string;
  locationName?: string;
  workplaceType?: string;
  employmentType?: string;
  publishedDate?: string;
  isListed?: boolean;
};

type AshbyBoardResponse = {
  data?: {
    jobBoard?: {
      jobPostings?: AshbyJobPosting[];
    };
  };
};

@Injectable()
export class AshbyBoardAdapter implements JobSourceAdapter {
  readonly type = 'ashby-board' as const;

  constructor(private readonly jobIntelligenceService: JobIntelligenceService) {}

  async fetchJobs(source: JobSourceDocument): Promise<NormalizedJobListing[]> {
    const organizationHostedJobsPageName = source.config?.organizationHostedJobsPageName;

    if (typeof organizationHostedJobsPageName !== 'string' || !organizationHostedJobsPageName.trim()) {
      throw new BadRequestException('Ashby source requires an organizationHostedJobsPageName in config.');
    }

    const query = `
      query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {
        jobBoard: apiJobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) {
          jobPostings {
            id
            title
            locationName
            workplaceType
            employmentType
            publishedDate
            isListed
          }
        }
      }
    `;

    const { data } = await axios.post<AshbyBoardResponse>(
      'https://jobs.ashbyhq.com/api/non-user-graphql?op=apiJobBoardWithTeams',
      {
        operationName: 'ApiJobBoardWithTeams',
        variables: {
          organizationHostedJobsPageName,
        },
        query,
      },
      {
        timeout: 20000,
        headers: {
          'content-type': 'application/json',
        },
      },
    );

    return (data.data?.jobBoard?.jobPostings ?? [])
      .filter((job) => job?.id && job?.title && job.isListed !== false)
      .map((job) => {
        const location = job.locationName;
        const description = [job.title, job.workplaceType, location].filter(Boolean).join(' • ');
        const remote = /remote/i.test(job.workplaceType ?? '') || this.jobIntelligenceService.inferRemote(location, description);

        return {
          externalId: job.id,
          title: job.title,
          company: typeof source.config?.company === 'string' ? source.config.company : source.name,
          location,
          remote,
          employmentType: job.employmentType,
          url: `https://jobs.ashbyhq.com/${organizationHostedJobsPageName}/${job.id}`,
          description,
          requirements: [],
          skills: this.jobIntelligenceService.extractSkills(job.title, description),
          minExperienceYears: this.jobIntelligenceService.extractYearsExperience(description),
          seniority: this.jobIntelligenceService.inferSeniority(job.title, description),
          postedAt: job.publishedDate ? new Date(job.publishedDate) : undefined,
          raw: job as unknown as Record<string, unknown>,
        };
      });
  }
}
