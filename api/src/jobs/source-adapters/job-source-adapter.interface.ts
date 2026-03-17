import { JobSourceDocument, JobSourceType } from '../schemas/job-source.schema';

export type NormalizedJobListing = {
  externalId: string;
  title: string;
  company: string;
  location?: string;
  remote?: boolean;
  employmentType?: string;
  url?: string;
  description?: string;
  requirements?: string[];
  skills?: string[];
  minExperienceYears?: number;
  seniority?: string;
  postedAt?: Date;
  raw?: Record<string, unknown>;
};

export interface JobSourceAdapter {
  readonly type: JobSourceType;
  fetchJobs(source: JobSourceDocument): Promise<NormalizedJobListing[]>;
}
