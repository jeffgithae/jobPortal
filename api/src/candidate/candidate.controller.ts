import { Body, Controller, Get, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CandidateProfileService } from './services/candidate-profile.service';

@Controller('profile')
export class CandidateController {
  constructor(private readonly candidateProfileService: CandidateProfileService) {}

  @Get()
  getProfile() {
    return this.candidateProfileService.getPrimaryProfile();
  }

  @Patch()
  updateProfile(@Body() updateProfileDto: UpdateProfileDto) {
    return this.candidateProfileService.updatePrimaryProfile(updateProfileDto);
  }

  @Post('resume/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadResume(
    @UploadedFile()
    file: { buffer: Buffer; mimetype?: string; originalname?: string },
  ) {
    return this.candidateProfileService.uploadResume(file);
  }
}
