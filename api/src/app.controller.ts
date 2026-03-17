import { Controller, Get } from '@nestjs/common';
import { CandidateProfileService } from './candidate/services/candidate-profile.service';
import { JobsService } from './jobs/services/jobs.service';

@Controller('health')
export class AppController {
  constructor(
    private readonly candidateProfileService: CandidateProfileService,
    private readonly jobsService: JobsService,
  ) {}

  @Get()
  async getHealth() {
    const [profile, sources, jobs] = await Promise.all([
      this.candidateProfileService.getPrimaryProfile(),
      this.jobsService.listSources(),
      this.jobsService.getAllJobs(),
    ]);

    return {
      status: 'ok',
      candidate: {
        name: profile.fullName,
        targetRoles: profile.targetRoles,
      },
      sourceCount: sources.length,
      ingestedJobCount: jobs.total,
      generatedAt: new Date().toISOString(),
    };
  }
}
