import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CandidateController } from './candidate.controller';
import { CandidateProfile, CandidateProfileSchema } from './schemas/candidate-profile.schema';
import { CandidateProfileService } from './services/candidate-profile.service';
import { ResumeParserService } from './services/resume-parser.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: CandidateProfile.name,
        schema: CandidateProfileSchema,
      },
    ]),
  ],
  controllers: [CandidateController],
  providers: [CandidateProfileService, ResumeParserService],
  exports: [CandidateProfileService],
})
export class CandidateModule {}
