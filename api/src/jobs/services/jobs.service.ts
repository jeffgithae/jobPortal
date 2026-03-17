import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { CandidateProfileDocument } from '../../candidate/schemas/candidate-profile.schema';
import { CandidateProfileService } from '../../candidate/services/candidate-profile.service';
import { DEFAULT_SOURCE_SEEDS } from '../../shared/demo-data';
import { DEFAULT_INGEST_CRON, DEFAULT_INGEST_TIMEZONE, DEFAULT_MATCH_THRESHOLD } from '../../shared/system-defaults';
import { CreateJobSourceDto } from '../dto/create-job-source.dto';
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

    await this.ingestEnabledSources();
  }

  getSourceCatalog() {
    return SOURCE_CATALOG;
  }

  @Cron(DEFAULT_INGEST_CRON, {
    name: 'daily-job-ingestion',
    timeZone: DEFAULT_INGEST_TIMEZONE,
  })
  async ingestEnabledSources() {
    const sources = await this.jobSourceModel.find({ enabled: true }).sort({ name: 1 });
    const profile = await this.candidateProfileService.getPrimaryProfile();
    let jobsUpserted = 0;
    const sourceResults: Array<Record<string, unknown>> = [];

    for (const source of sources) {
      try {
        const adapter = this.jobSourceRegistryService.getAdapter(source.type);
        const jobs = await adapter.fetchJobs(source);

        for (const job of jobs) {
          await this.upsertJob(source, profile, job);
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

    const rescoredJobs = await this.rescoreExistingJobs(profile);
    const matchedJobs = await this.jobPostingModel.countDocuments({
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
      sourcesRun: sources.length,
      jobsUpserted,
      rescoredJobs,
      matchedJobs,
      sourceResults,
    };
  }

  async runManualIngestion() {
    return this.ingestEnabledSources();
  }

  async getAllJobs(options: PaginatedQueryOptions = {}) {
    const pagination = this.normalizePagination(options.page, options.pageSize);
    const filter = this.buildJobFilter({ realOnly: options.realOnly });

    return this.paginateJobs(filter, pagination.page, pagination.pageSize);
  }

  async getMatches(options: MatchQueryOptions = {}) {
    const pagination = this.normalizePagination(options.page, options.pageSize);
    const filter = this.buildJobFilter({
      threshold: options.threshold ?? DEFAULT_MATCH_THRESHOLD,
      realOnly: options.realOnly,
    });

    return this.paginateJobs(filter, pagination.page, pagination.pageSize);
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

  private buildJobFilter(options: { threshold?: number; realOnly?: boolean }) {
    const filter: FilterQuery<JobPostingDocument> = {};

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

  private async paginateJobs(
    filter: FilterQuery<JobPostingDocument>,
    page: number,
    pageSize: number,
  ) {
    const [total, items] = await Promise.all([
      this.jobPostingModel.countDocuments(filter),
      this.jobPostingModel
        .find(filter)
        .sort({ matchScore: -1, createdAt: -1 })
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

  private async rescoreExistingJobs(candidateProfile: CandidateProfileDocument) {
    const jobs = await this.jobPostingModel.find();

    if (jobs.length === 0) {
      return 0;
    }

    const operations = jobs.map((job) => {
      const normalizedJob = {
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
      const match = this.matchingService.scoreJob(candidateProfile, normalizedJob, DEFAULT_MATCH_THRESHOLD);

      return {
        updateOne: {
          filter: { _id: job._id },
          update: {
            $set: {
              matchScore: match.totalScore,
              matchReasons: match.reasons,
              missingRequirements: match.missingRequirements,
              isRecommended: match.isRecommended,
            },
          },
        },
      };
    });

    await this.jobPostingModel.bulkWrite(operations);
    return operations.length;
  }

  private async upsertJob(
    source: JobSourceDocument,
    candidateProfile: CandidateProfileDocument,
    job: NormalizedJobListing,
  ) {
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
    const match = this.matchingService.scoreJob(candidateProfile, normalizedJob, DEFAULT_MATCH_THRESHOLD);

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
          matchScore: match.totalScore,
          matchReasons: match.reasons,
          missingRequirements: match.missingRequirements,
          isRecommended: match.isRecommended,
          raw: job.raw ?? {},
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
}
