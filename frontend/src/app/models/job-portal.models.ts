export interface EducationRecord {
  institution: string;
  degree: string;
  period?: string;
}

export interface AppUser {
  _id?: string;
  id?: string;
  ownerKey: string;
  displayName: string;
  email: string;
  seeded?: boolean;
}

export interface CandidateProfile {
  _id?: string;
  id?: string;
  ownerKey?: string;
  fullName: string;
  email: string;
  phone?: string;
  headline?: string;
  summary?: string;
  location?: string;
  preferredLocations: string[];
  workPreferences: string[];
  yearsExperience: number;
  seniority?: string;
  targetRoles: string[];
  skills: string[];
  certifications: string[];
  languages: string[];
  education: EducationRecord[];
  experienceHighlights: string[];
  sourceResumeName?: string;
  resumeUpdatedAt?: string;
}

export interface JobMatch {
  _id?: string;
  id?: string;
  ownerKey?: string;
  title: string;
  company: string;
  location?: string;
  remote: boolean;
  employmentType?: string;
  url?: string;
  skills: string[];
  matchScore: number;
  matchReasons: string[];
  missingRequirements: string[];
  sourceName: string;
  sourceType: string;
  isRecommended: boolean;
  createdAt?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface JobSource {
  _id?: string;
  id?: string;
  name: string;
  type: string;
  enabled: boolean;
  runCron: string;
  timeZone: string;
  lastRunAt?: string;
  lastRunStatus?: string;
  lastRunError?: string;
}

export interface SourceCatalogEntry {
  key: string;
  name: string;
  category: 'ats-api' | 'ats-feed' | 'hosted-career-site' | 'aggregator';
  integrationMethod: string;
  access: 'public' | 'partner' | 'customer-auth' | 'high-risk';
  recommended: boolean;
  status: 'ready' | 'next' | 'conditional' | 'avoid';
  docsUrl: string;
  notes: string;
}

export interface IngestionSummary {
  ranAt: string;
  ownerKey?: string;
  sourcesRun: number;
  jobsUpserted: number;
  matchedJobs: number;
  schedule: {
    cron: string;
    timeZone: string;
  };
  sourceResults: Array<{
    sourceId: string;
    sourceName: string;
    fetchedJobs: number;
    status: string;
    error?: string;
  }>;
}

export interface ResumeSyncResult {
  profile: CandidateProfile;
  ingestionSummary: IngestionSummary;
}
