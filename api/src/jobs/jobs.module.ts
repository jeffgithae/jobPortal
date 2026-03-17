import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CandidateModule } from '../candidate/candidate.module';
import { JobsController } from './jobs.controller';
import { JobMatch, JobMatchSchema } from './schemas/job-match.schema';
import { JobPosting, JobPostingSchema } from './schemas/job-posting.schema';
import { JobSource, JobSourceSchema } from './schemas/job-source.schema';
import { GreenhouseBoardAdapter } from './source-adapters/greenhouse-board.adapter';
import { LeverPostingsAdapter } from './source-adapters/lever-postings.adapter';
import { MockCuratedAdapter } from './source-adapters/mock-curated.adapter';
import { JobIntelligenceService } from './services/job-intelligence.service';
import { JobsService } from './services/jobs.service';
import { MatchingService } from './services/matching.service';
import { JobSourceRegistryService } from './services/job-source-registry.service';

@Module({
  imports: [
    CandidateModule,
    MongooseModule.forFeature([
      {
        name: JobSource.name,
        schema: JobSourceSchema,
      },
      {
        name: JobPosting.name,
        schema: JobPostingSchema,
      },
      {
        name: JobMatch.name,
        schema: JobMatchSchema,
      },
    ]),
  ],
  controllers: [JobsController],
  providers: [
    JobsService,
    JobIntelligenceService,
    MatchingService,
    JobSourceRegistryService,
    MockCuratedAdapter,
    GreenhouseBoardAdapter,
    LeverPostingsAdapter,
  ],
  exports: [JobsService],
})
export class JobsModule {}
