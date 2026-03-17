import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CandidateProfileService } from '../candidate/services/candidate-profile.service';
import { JobsService } from '../jobs/services/jobs.service';

@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly candidateProfileService: CandidateProfileService,
    private readonly jobsService: JobsService,
  ) {}

  async onModuleInit() {
    await this.candidateProfileService.ensurePrimaryProfile();
    await this.jobsService.ensureDefaultSources();
    await this.jobsService.runManualIngestion();

    this.logger.log('Starter profile and sources are ready, and startup ingestion has completed.');
  }
}
