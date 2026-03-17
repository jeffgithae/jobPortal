import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CandidateProfile, CandidateProfileSchema } from '../candidate/schemas/candidate-profile.schema';
import { AppUser, AppUserSchema } from './schemas/app-user.schema';
import { UsersService } from './users.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: AppUser.name,
        schema: AppUserSchema,
      },
      {
        name: CandidateProfile.name,
        schema: CandidateProfileSchema,
      },
    ]),
  ],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
