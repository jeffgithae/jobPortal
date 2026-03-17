import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JobsService } from '../jobs/services/jobs.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jobsService: JobsService,
  ) {}

  async onModuleInit() {
    await this.usersService.ensureStarterUser();
    await this.jobsService.ensureDefaultSources();
    await this.jobsService.runManualIngestion();

    this.logger.log('Starter users, profiles, and sources are ready, and startup ingestion has completed.');
  }
}
