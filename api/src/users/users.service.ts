import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CandidateProfileService } from '../candidate/services/candidate-profile.service';
import { JobsService } from '../jobs/services/jobs.service';
import { DEMO_USER_SEED } from '../shared/demo-data';
import { DEFAULT_OWNER_KEY } from '../shared/system-defaults';
import { CreateUserDto } from './dto/create-user.dto';
import { AppUser, AppUserDocument } from './schemas/app-user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(AppUser.name)
    private readonly appUserModel: Model<AppUserDocument>,
    private readonly candidateProfileService: CandidateProfileService,
    private readonly jobsService: JobsService,
  ) {}

  async ensureStarterUser() {
    await this.appUserModel.findOneAndUpdate(
      { ownerKey: DEFAULT_OWNER_KEY },
      { $setOnInsert: DEMO_USER_SEED },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await this.candidateProfileService.ensurePrimaryProfile(DEFAULT_OWNER_KEY);
  }

  async listUsers() {
    await this.ensureStarterUser();
    return this.appUserModel.find().sort({ seeded: -1, displayName: 1 });
  }

  async createUser(createUserDto: CreateUserDto) {
    const email = createUserDto.email.trim().toLowerCase();
    const displayName = createUserDto.displayName.trim();
    const existingEmailUser = await this.appUserModel.findOne({ email });

    if (existingEmailUser) {
      throw new BadRequestException('A user with that email already exists.');
    }

    const ownerKey = await this.generateOwnerKey(displayName, email);
    const user = await this.appUserModel.create({
      ownerKey,
      displayName,
      email,
      seeded: false,
    });

    await this.candidateProfileService.createProfileForUser({
      ownerKey,
      fullName: displayName,
      email,
    });
    await this.jobsService.rescoreOwnerMatches(ownerKey);

    return user;
  }

  private async generateOwnerKey(displayName: string, email: string) {
    const base = this.slugify(displayName) || this.slugify(email.split('@')[0] ?? 'user') || 'user';
    let suffix = 0;

    while (true) {
      const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
      const exists = await this.appUserModel.exists({ ownerKey: candidate });

      if (!exists) {
        return candidate;
      }

      suffix += 1;
    }
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
  }
}
