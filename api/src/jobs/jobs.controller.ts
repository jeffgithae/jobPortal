import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CandidateProfileService } from '../candidate/services/candidate-profile.service';
import { DEFAULT_MATCH_THRESHOLD, DEFAULT_OWNER_KEY } from '../shared/system-defaults';
import { CreateJobSourceDto } from './dto/create-job-source.dto';
import { JobsService } from './services/jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly candidateProfileService: CandidateProfileService,
  ) {}

  @Get()
  getJobs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('pageSize', new DefaultValuePipe(12), ParseIntPipe)
    pageSize: number,
    @Query('realOnly') realOnly?: string,
    @Query('userKey') userKey = DEFAULT_OWNER_KEY,
  ) {
    return this.jobsService.getAllJobs(userKey, {
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
    @Query('userKey') userKey = DEFAULT_OWNER_KEY,
  ) {
    return this.jobsService.getMatches(userKey, {
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
  runManualIngestion(@Query('userKey') userKey = DEFAULT_OWNER_KEY) {
    return this.jobsService.runManualIngestion(userKey);
  }

  @Post('resume-sync')
  @UseInterceptors(FileInterceptor('file'))
  async syncResumeAndIngestion(
    @UploadedFile()
    file: { buffer: Buffer; mimetype?: string; originalname?: string },
    @Query('userKey') userKey = DEFAULT_OWNER_KEY,
  ) {
    const profile = await this.candidateProfileService.uploadResume(file, userKey);
    const ingestionSummary = await this.jobsService.runManualIngestion(userKey);

    return {
      profile,
      ingestionSummary,
    };
  }
}
