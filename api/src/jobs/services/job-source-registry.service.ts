import { Injectable } from '@nestjs/common';
import { JobSourceType } from '../schemas/job-source.schema';
import { GreenhouseBoardAdapter } from '../source-adapters/greenhouse-board.adapter';
import { JobSourceAdapter } from '../source-adapters/job-source-adapter.interface';
import { LeverPostingsAdapter } from '../source-adapters/lever-postings.adapter';
import { MockCuratedAdapter } from '../source-adapters/mock-curated.adapter';

@Injectable()
export class JobSourceRegistryService {
  constructor(
    private readonly mockCuratedAdapter: MockCuratedAdapter,
    private readonly greenhouseBoardAdapter: GreenhouseBoardAdapter,
    private readonly leverPostingsAdapter: LeverPostingsAdapter,
  ) {}

  getAdapter(type: JobSourceType): JobSourceAdapter {
    switch (type) {
      case 'mock-curated':
        return this.mockCuratedAdapter;
      case 'greenhouse-board':
        return this.greenhouseBoardAdapter;
      case 'lever-postings':
        return this.leverPostingsAdapter;
      default:
        throw new Error(`Unsupported job source type: ${type}`);
    }
  }
}
