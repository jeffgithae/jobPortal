import { Injectable } from '@nestjs/common';
import { DEMO_CURATED_JOBS } from '../../shared/demo-data';
import { JobSourceAdapter, NormalizedJobListing } from './job-source-adapter.interface';

@Injectable()
export class MockCuratedAdapter implements JobSourceAdapter {
  readonly type = 'mock-curated' as const;

  async fetchJobs(): Promise<NormalizedJobListing[]> {
    return DEMO_CURATED_JOBS.map((job) => ({
      ...job,
      postedAt: new Date(),
      raw: {
        seed: true,
      },
    }));
  }
}
