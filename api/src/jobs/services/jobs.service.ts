import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { CandidateProfileDocument } from '../../candidate/schemas/candidate-profile.schema';
import { CandidateProfileService } from '../../candidate/services/candidate-profile.service';
import { DEFAULT_SOURCE_SEEDS } from '../../shared/demo-data';
import { DEFAULT_INGEST_CRON, DEFAULT_INGEST_TIMEZONE, DEFAULT_MATCH_THRESHOLD, DEFAULT_OWNER_KEY } from '../../shared/system-defaults';
import { CreateJobSourceDto } from '../dto/create-job-source.dto';
import { JobMatch, JobMatchDocument } from '../schemas/job-match.schema';
import { JobPosting, JobPostingDocument } from '../schemas/job-posting.schema';
import { JobSource, JobSourceDocument } from '../schemas/job-source.schema';
import { SOURCE_CATALOG } from '../source-catalog';
import { NormalizedJobListing } from '../source-adapters/job-source-adapter.interface';
import { JobIntelligenceService } from './job-intelligence.service';
import { MatchingService } from './matching.service';
import { JobSourceRegistryService } from './job-source-registry.service';

interface PaginatedQueryOptions {
  page?: number;
  pageSize?: number;
  realOnly?: boolean;
}

interface MatchQueryOptions extends PaginatedQueryOptions {
  threshold?: number;
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private readonly defaultPageSize = 12;
  private readonly maxPageSize = 50;

  constructor(
    @InjectModel(JobSource.name)
    private readonly jobSourceModel: Model<JobSourceDocument>,
    @InjectModel(JobPosting.name)
    private readonly jobPostingModel: Model<JobPostingDocument>,
    @InjectModel(JobMatch.name)
    private readonly jobMatchModel: Model<JobMatchDocument>,
    private readonly candidateProfileService: CandidateProfileService,
    private readonly jobSourceRegistryService: JobSourceRegistryService,
    private readonly jobIntelligenceService: JobIntelligenceService,
    private readonly matchingService: MatchingService,
  ) {}

  async ensureDefaultSources() {
    await Promise.all(
      DEFAULT_SOURCE_SEEDS.map((source) =>
        this.jobSourceModel.findOneAndUpdate(
          { name: source.name, type: source.type },
          { $setOnInsert: source },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        ),
      ),
    );
  }

  async bootstrapInitialJobs() {
    const count = await this.jobPostingModel.countDocuments();

    if (count > 0) {
      return;
    }

    await this.ingestEnabledSources(DEFAULT_OWNER_KEY);
  }

  getSourceCatalog() {
    return SOURCE_CATALOG;
  }

  @Cron(DEFAULT_INGEST_CRON, {
    name: 'daily-job-ingestion',
    timeZone: DEFAULT_INGEST_TIMEZONE,
  })
  async ingestEnabledSources(summaryOwnerKey = DEFAULT_OWNER_KEY) {
    const sources = await this.jobSourceModel.find({ enabled: true }).sort({ name: 1 });
    let jobsUpserted = 0;
    const sourceResults: Array<Record<string, unknown>> = [];

    for (const source of sources) {
      try {
        const adapter = this.jobSourceRegistryService.getAdapter(source.type);
        const jobs = await adapter.fetchJobs(source);

        for (const job of jobs) {
          await this.upsertJob(source, job);
          jobsUpserted += 1;
        }

        source.lastRunAt = new Date();
        source.lastRunStatus = 'success';
        source.lastRunError = undefined;
        await source.save();

        sourceResults.push({
          sourceId: source.id,
          sourceName: source.name,
          fetchedJobs: jobs.length,
          status: 'success',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown ingestion error';
        source.lastRunAt = new Date();
        source.lastRunStatus = 'failed';
        source.lastRunError = message;
        await source.save();

        sourceResults.push({
          sourceId: source.id,
          sourceName: source.name,
          fetchedJobs: 0,
          status: 'failed',
          error: message,
        });

        this.logger.warn(`Failed to ingest source ${source.name}: ${message}`);
      }
    }

    const rescoredJobs = await this.rescoreAllUserMatches();
    const matchedJobs = await this.jobMatchModel.countDocuments({
      ownerKey: summaryOwnerKey,
      matchScore: {
        $gte: DEFAULT_MATCH_THRESHOLD,
      },
    });

    return {
      ranAt: new Date().toISOString(),
      schedule: {
        cron: DEFAULT_INGEST_CRON,
        timeZone: DEFAULT_INGEST_TIMEZONE,
      },
      ownerKey: summaryOwnerKey,
      sourcesRun: sources.length,
      jobsUpserted,
      rescoredJobs,
      matchedJobs,
      sourceResults,
    };
  }

  async runManualIngestion(ownerKey = DEFAULT_OWNER_KEY) {
    return this.ingestEnabledSources(ownerKey);
  }

  async rescoreOwnerMatches(ownerKey = DEFAULT_OWNER_KEY) {
    const [profile, jobs] = await Promise.all([
      this.candidateProfileService.getPrimaryProfile(ownerKey),
      this.jobPostingModel.find(),
    ]);

    if (jobs.length === 0) {
      return 0;
    }

    const operations = jobs.map((job) => this.toMatchOperation(profile, job));
    await this.jobMatchModel.bulkWrite(operations);
    return operations.length;
  }

  async getAllJobs(ownerKey = DEFAULT_OWNER_KEY, options: PaginatedQueryOptions = {}) {
    await this.candidateProfileService.getPrimaryProfile(ownerKey);

    const pagination = this.normalizePagination(options.page, options.pageSize);
    const filter = this.buildMatchFilter(ownerKey, { realOnly: options.realOnly });

    return this.paginateMatches(filter, pagination.page, pagination.pageSize);
  }

  async getMatches(ownerKey = DEFAULT_OWNER_KEY, options: MatchQueryOptions = {}) {
    await this.candidateProfileService.getPrimaryProfile(ownerKey);

    const pagination = this.normalizePagination(options.page, options.pageSize);
    const filter = this.buildMatchFilter(ownerKey, {
      threshold: options.threshold ?? DEFAULT_MATCH_THRESHOLD,
      realOnly: options.realOnly,
    });

    return this.paginateMatches(filter, pagination.page, pagination.pageSize);
  }

  async listSources() {
    return this.jobSourceModel.find().sort({ enabled: -1, name: 1 });
  }

  async createSource(createJobSourceDto: CreateJobSourceDto) {
    const source = new this.jobSourceModel({
      runCron: DEFAULT_INGEST_CRON,
      timeZone: DEFAULT_INGEST_TIMEZONE,
      enabled: true,
      ...createJobSourceDto,
    });

    return source.save();
  }

  private async ensureOwnerMatchesInitialized(ownerKey: string) {
    const [matchCount, jobCount] = await Promise.all([
      this.jobMatchModel.countDocuments({ ownerKey }),
      this.jobPostingModel.countDocuments(),
    ]);

    if (matchCount === 0 && jobCount > 0) {
      await this.rescoreOwnerMatches(ownerKey);
    }
  }
  private buildMatchFilter(ownerKey: string, options: { threshold?: number; realOnly?: boolean }) {
    const filter: FilterQuery<JobMatchDocument> = {
      ownerKey,
    };

    if (typeof options.threshold === 'number') {
      filter.matchScore = {
        $gte: options.threshold,
      };
    }

    if (options.realOnly) {
      filter.sourceType = {
        $ne: 'mock-curated',
      };
    }

    return filter;
  }

  private normalizePagination(page?: number, pageSize?: number) {
    const normalizedPage = Number.isFinite(page) ? Math.max(1, Number(page)) : 1;
    const normalizedPageSize = Number.isFinite(pageSize)
      ? Math.min(this.maxPageSize, Math.max(1, Number(pageSize)))
      : this.defaultPageSize;

    return {
      page: normalizedPage,
      pageSize: normalizedPageSize,
    };
  }

  private async paginateMatches(
    filter: FilterQuery<JobMatchDocument>,
    page: number,
    pageSize: number,
  ) {
    const [total, items] = await Promise.all([
      this.jobMatchModel.countDocuments(filter),
      this.jobMatchModel
        .find(filter)
        .sort({ matchScore: -1, postedAt: -1, updatedAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  private async rescoreAllUserMatches() {
    const [profiles, jobs] = await Promise.all([
      this.candidateProfileService.listProfiles(),
      this.jobPostingModel.find(),
    ]);

    if (profiles.length === 0 || jobs.length === 0) {
      return 0;
    }

    const operations = profiles.flatMap((profile) => jobs.map((job) => this.toMatchOperation(profile, job)));
    await this.jobMatchModel.bulkWrite(operations);
    return operations.length;
  }

  private toMatchOperation(candidateProfile: CandidateProfileDocument, job: JobPostingDocument) {
    const normalizedJob = this.toNormalizedJob(job);
    const match = this.matchingService.scoreJob(candidateProfile, normalizedJob, DEFAULT_MATCH_THRESHOLD);

    return {
      updateOne: {
        filter: { ownerKey: candidateProfile.ownerKey, sourceJobKey: job.sourceJobKey },
        update: {
          $set: {
            jobPostingId: job._id.toString(),
            ownerKey: candidateProfile.ownerKey,
            sourceJobKey: job.sourceJobKey,
            externalId: job.externalId,
            sourceType: job.sourceType,
            sourceName: job.sourceName,
            title: job.title,
            company: job.company,
            location: job.location,
            remote: job.remote,
            employmentType: job.employmentType,
            url: job.url,
            skills: job.skills ?? [],
            matchScore: match.totalScore,
            matchReasons: match.reasons,
            missingRequirements: match.missingRequirements,
            isRecommended: match.isRecommended,
            postedAt: job.postedAt,
          },
        },
        upsert: true,
      },
    };
  }

  private toNormalizedJob(job: JobPostingDocument): NormalizedJobListing {
    return {
      externalId: job.externalId,
      title: job.title,
      company: job.company,
      location: job.location,
      remote: job.remote,
      employmentType: job.employmentType,
      url: job.url,
      description: job.description ?? '',
      requirements: job.requirements ?? [],
      skills: job.skills ?? [],
      minExperienceYears: job.minExperienceYears,
      seniority: job.seniority,
      postedAt: job.postedAt,
      raw: job.raw ?? {},
    };
  }

  private async upsertJob(source: JobSourceDocument, job: NormalizedJobListing) {
    const description = this.jobIntelligenceService.toPlainText(job.description);
    const skills = [...new Set([...(job.skills ?? []), ...this.jobIntelligenceService.extractSkills(job.title, description)])];
    const normalizedJob = {
      ...job,
      description,
      skills,
      requirements: job.requirements ?? [],
      minExperienceYears: job.minExperienceYears ?? this.jobIntelligenceService.extractYearsExperience(description),
      seniority: job.seniority ?? this.jobIntelligenceService.inferSeniority(job.title, description),
      remote: job.remote ?? this.jobIntelligenceService.inferRemote(job.location, description),
    };

    return this.jobPostingModel.findOneAndUpdate(
      { sourceJobKey: `${source.type}:${job.externalId}` },
      {
        $set: {
          externalId: job.externalId,
          sourceType: source.type,
          sourceName: source.name,
          title: job.title,
          company: job.company,
          location: job.location,
          remote: normalizedJob.remote,
          employmentType: job.employmentType ?? this.jobIntelligenceService.inferEmploymentType(description),
          url: job.url,
          description,
          requirements: normalizedJob.requirements,
          skills,
          minExperienceYears: normalizedJob.minExperienceYears,
          seniority: normalizedJob.seniority,
          postedAt: job.postedAt,
          fetchedAt: new Date(),
          raw: job.raw ?? {},
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
}


