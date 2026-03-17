import { Controller, Get } from '@nestjs/common';
import { JobsService } from './jobs/services/jobs.service';
import { UsersService } from './users/users.service';

@Controller('health')
export class AppController {
  constructor(
    private readonly usersService: UsersService,
    private readonly jobsService: JobsService,
  ) {}

  @Get()
  async getHealth() {
    const [users, sources, jobs] = await Promise.all([
      this.usersService.listUsers(),
      this.jobsService.listSources(),
      this.jobsService.getAllJobs(),
    ]);

    return {
      status: 'ok',
      usersCount: users.length,
      sourceCount: sources.length,
      ingestedJobCount: jobs.total,
      generatedAt: new Date().toISOString(),
    };
  }
}
