import { Body, Controller, DefaultValuePipe, Get, ParseIntPipe, Post, Query } from '@nestjs/common';
import { DEFAULT_MATCH_THRESHOLD } from '../shared/system-defaults';
import { CreateJobSourceDto } from './dto/create-job-source.dto';
import { JobsService } from './services/jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  getJobs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('pageSize', new DefaultValuePipe(12), ParseIntPipe)
    pageSize: number,
    @Query('realOnly') realOnly?: string,
  ) {
    return this.jobsService.getAllJobs({
      page,
      pageSize,
      realOnly: realOnly === 'true',
    });
  }

  @Get('matches')
  getMatches(
    @Query('threshold', new DefaultValuePipe(DEFAULT_MATCH_THRESHOLD), ParseIntPipe)
    threshold: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('pageSize', new DefaultValuePipe(12), ParseIntPipe)
    pageSize: number,
    @Query('realOnly') realOnly?: string,
  ) {
    return this.jobsService.getMatches({
      threshold,
      page,
      pageSize,
      realOnly: realOnly === 'true',
    });
  }

  @Get('sources')
  getSources() {
    return this.jobsService.listSources();
  }

  @Get('source-catalog')
  getSourceCatalog() {
    return this.jobsService.getSourceCatalog();
  }

  @Post('sources')
  createSource(@Body() createJobSourceDto: CreateJobSourceDto) {
    return this.jobsService.createSource(createJobSourceDto);
  }

  @Post('ingest/run')
  runManualIngestion() {
    return this.jobsService.runManualIngestion();
  }
}
