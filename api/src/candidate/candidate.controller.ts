import { Body, Controller, DefaultValuePipe, Get, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DEFAULT_OWNER_KEY } from '../shared/system-defaults';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CandidateProfileService } from './services/candidate-profile.service';

@Controller('profile')
export class CandidateController {
  constructor(private readonly candidateProfileService: CandidateProfileService) {}

  @Get()
  getProfile(@Query('userKey', new DefaultValuePipe(DEFAULT_OWNER_KEY)) userKey: string) {
    return this.candidateProfileService.getPrimaryProfile(userKey);
  }

  @Patch()
  updateProfile(
    @Body() updateProfileDto: UpdateProfileDto,
    @Query('userKey', new DefaultValuePipe(DEFAULT_OWNER_KEY)) userKey: string,
  ) {
    return this.candidateProfileService.updatePrimaryProfile(updateProfileDto, userKey);
  }

  @Post('resume/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadResume(
    @UploadedFile()
    file: { buffer: Buffer; mimetype?: string; originalname?: string },
    @Query('userKey', new DefaultValuePipe(DEFAULT_OWNER_KEY)) userKey: string,
  ) {
    return this.candidateProfileService.uploadResume(file, userKey);
  }
}
