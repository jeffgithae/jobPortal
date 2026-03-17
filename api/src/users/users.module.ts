import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CandidateModule } from '../candidate/candidate.module';
import { JobsModule } from '../jobs/jobs.module';
import { AppUser, AppUserSchema } from './schemas/app-user.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    CandidateModule,
    JobsModule,
    MongooseModule.forFeature([
      {
        name: AppUser.name,
        schema: AppUserSchema,
      },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
