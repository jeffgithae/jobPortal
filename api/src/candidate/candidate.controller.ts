import { Body, Controller, Get, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AppUserDocument } from '../users/schemas/app-user.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CandidateProfileService } from './services/candidate-profile.service';

@UseGuards(SessionAuthGuard)
@Controller('profile')
export class CandidateController {
  constructor(private readonly candidateProfileService: CandidateProfileService) {}

  @Get()
  getProfile(@Req() request: Request & { user: AppUserDocument }) {
    return this.candidateProfileService.getPrimaryProfile(request.user.ownerKey);
  }

  @Patch()
  updateProfile(
    @Body() updateProfileDto: UpdateProfileDto,
    @Req() request: Request & { user: AppUserDocument },
  ) {
    return this.candidateProfileService.updatePrimaryProfile(updateProfileDto, request.user.ownerKey);
  }

  @Post('resume/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadResume(
    @UploadedFile()
    file: { buffer: Buffer; mimetype?: string; originalname?: string },
    @Req() request: Request & { user: AppUserDocument },
  ) {
    return this.candidateProfileService.uploadResume(file, request.user.ownerKey);
  }
}
