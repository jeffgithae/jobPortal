import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DEMO_PROFILE_SEED, DEMO_USER_SEED } from '../shared/demo-data';
import { CandidateProfile, CandidateProfileDocument } from '../candidate/schemas/candidate-profile.schema';
import { AppUser, AppUserDocument } from './schemas/app-user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(AppUser.name)
    private readonly appUserModel: Model<AppUserDocument>,
    @InjectModel(CandidateProfile.name)
    private readonly candidateProfileModel: Model<CandidateProfileDocument>,
  ) {}

  async ensureStarterUser() {
    const [hasExistingUser, hasExistingProfile] = await Promise.all([
      this.appUserModel.exists({}),
      this.candidateProfileModel.exists({}),
    ]);

    if (hasExistingUser || hasExistingProfile) {
      return;
    }

    await this.appUserModel.create({
      ...DEMO_USER_SEED,
      email: DEMO_USER_SEED.email.trim().toLowerCase(),
    });

    await this.candidateProfileModel.create({
      ...DEMO_PROFILE_SEED,
      email: DEMO_PROFILE_SEED.email.trim().toLowerCase(),
    });
  }

  async countUsers() {
    await this.ensureStarterUser();
    return this.appUserModel.countDocuments();
  }

  async findByEmail(email: string) {
    return this.appUserModel.findOne({ email: email.trim().toLowerCase() });
  }

  async findByOwnerKey(ownerKey: string) {
    return this.appUserModel.findOne({ ownerKey });
  }

  async findBySessionTokenHash(sessionTokenHash: string) {
    return this.appUserModel.findOne({
      sessionTokenHash,
      sessionExpiresAt: {
        $gt: new Date(),
      },
    });
  }

  async createUserAccount(input: {
    displayName: string;
    email: string;
    passwordSalt: string;
    passwordHash: string;
  }) {
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();
    const existingEmailUser = await this.appUserModel.findOne({ email });

    if (existingEmailUser) {
      throw new BadRequestException('A user with that email already exists.');
    }

    const ownerKey = await this.generateOwnerKey(displayName, email);
    const user = await this.appUserModel.create({
      ownerKey,
      displayName,
      email,
      passwordSalt: input.passwordSalt,
      passwordHash: input.passwordHash,
      seeded: false,
    });

    await this.candidateProfileModel.findOneAndUpdate(
      { ownerKey },
      {
        $setOnInsert: {
          ownerKey,
          fullName: displayName,
          email,
          preferredLocations: [],
          workPreferences: [],
          yearsExperience: 0,
          targetRoles: [],
          skills: [],
          certifications: [],
          languages: [],
          education: [],
          experienceHighlights: [],
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return user;
  }

  async saveSession(userId: string, sessionTokenHash: string, sessionExpiresAt: Date) {
    return this.appUserModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          sessionTokenHash,
          sessionExpiresAt,
          lastLoginAt: new Date(),
        },
      },
      { new: true },
    );
  }

  async clearSession(userId: string) {
    return this.appUserModel.findByIdAndUpdate(
      userId,
      {
        $unset: {
          sessionTokenHash: 1,
          sessionExpiresAt: 1,
        },
      },
      { new: true },
    );
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
