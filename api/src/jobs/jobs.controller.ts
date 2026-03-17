import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CandidateProfileService } from '../candidate/services/candidate-profile.service';
import { DEFAULT_MATCH_THRESHOLD } from '../shared/system-defaults';
import { AppUserDocument } from '../users/schemas/app-user.schema';
import { CreateJobSourceDto } from './dto/create-job-source.dto';
import { JobsService } from './services/jobs.service';

@UseGuards(SessionAuthGuard)
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
    @Req() request: Request & { user: AppUserDocument },
    @Query('realOnly') realOnly?: string,
  ) {
    return this.jobsService.getAllJobs(request.user.ownerKey, {
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
    @Req() request: Request & { user: AppUserDocument },
    @Query('realOnly') realOnly?: string,
  ) {
    return this.jobsService.getMatches(request.user.ownerKey, {
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
  runManualIngestion(@Req() request: Request & { user: AppUserDocument }) {
    return this.jobsService.runManualIngestion(request.user.ownerKey);
  }

  @Post('resume-sync')
  @UseInterceptors(FileInterceptor('file'))
  async syncResumeAndIngestion(
    @UploadedFile()
    file: { buffer: Buffer; mimetype?: string; originalname?: string },
    @Req() request: Request & { user: AppUserDocument },
  ) {
    const profile = await this.candidateProfileService.uploadResume(file, request.user.ownerKey);
    const ingestionSummary = await this.jobsService.runManualIngestion(request.user.ownerKey);

    return {
      profile,
      ingestionSummary,
    };
  }
}
