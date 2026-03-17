import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DEMO_PROFILE_SEED } from '../../shared/demo-data';
import { DEFAULT_OWNER_KEY } from '../../shared/system-defaults';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { CandidateProfile, CandidateProfileDocument } from '../schemas/candidate-profile.schema';
import { ResumeParserService } from './resume-parser.service';

type UploadedResumeFile = {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
};

@Injectable()
export class CandidateProfileService {
  constructor(
    @InjectModel(CandidateProfile.name)
    private readonly candidateProfileModel: Model<CandidateProfileDocument>,
    private readonly resumeParserService: ResumeParserService,
  ) {}

  async ensurePrimaryProfile(ownerKey = DEFAULT_OWNER_KEY) {
    return this.candidateProfileModel.findOneAndUpdate(
      { ownerKey },
      { $setOnInsert: DEMO_PROFILE_SEED },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  async getPrimaryProfile(ownerKey = DEFAULT_OWNER_KEY) {
    const profile = await this.ensurePrimaryProfile(ownerKey);

    if (!profile) {
      throw new BadRequestException('Unable to load the primary candidate profile.');
    }

    return profile;
  }

  async updatePrimaryProfile(updateProfileDto: UpdateProfileDto, ownerKey = DEFAULT_OWNER_KEY) {
    const profile = await this.getPrimaryProfile(ownerKey);

    Object.assign(profile, {
      ...updateProfileDto,
      preferredLocations: this.mergeList(profile.preferredLocations, updateProfileDto.preferredLocations),
      workPreferences: this.mergeList(profile.workPreferences, updateProfileDto.workPreferences),
      targetRoles: this.mergeList(profile.targetRoles, updateProfileDto.targetRoles),
      skills: this.mergeList(profile.skills, updateProfileDto.skills),
      certifications: this.mergeList(profile.certifications, updateProfileDto.certifications),
      languages: this.mergeList(profile.languages, updateProfileDto.languages),
      experienceHighlights: this.mergeList(profile.experienceHighlights, updateProfileDto.experienceHighlights),
    });

    return profile.save();
  }

  async uploadResume(file: UploadedResumeFile, ownerKey = DEFAULT_OWNER_KEY) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('A resume file is required.');
    }

    const profile = await this.getPrimaryProfile(ownerKey);
    const parsedResume = await this.resumeParserService.parseResumeBuffer(
      file.buffer,
      file.mimetype,
      file.originalname,
    );
    const missingRequiredFields = this.getMissingRequiredResumeFields(parsedResume);

    if (missingRequiredFields.length > 0) {
      throw new BadRequestException(
        `Resume upload rejected. Could not extract required fields: ${missingRequiredFields.join(', ')}.`,
      );
    }

    profile.fullName = parsedResume.fullName!;
    profile.email = parsedResume.email!;
    profile.phone = parsedResume.phone;
    profile.headline = parsedResume.headline;
    profile.summary = parsedResume.summary;
    profile.location = parsedResume.location;
    profile.yearsExperience = parsedResume.yearsExperience ?? 0;
    profile.seniority = parsedResume.seniority;
    profile.preferredLocations = this.replaceList(parsedResume.preferredLocations);
    profile.workPreferences = this.replaceList(parsedResume.workPreferences);
    profile.targetRoles = this.replaceList(parsedResume.targetRoles);
    profile.skills = this.replaceList(parsedResume.skills);
    profile.certifications = this.replaceList(parsedResume.certifications);
    profile.languages = this.replaceList(parsedResume.languages);
    profile.education = [];
    profile.experienceHighlights = this.replaceList(parsedResume.experienceHighlights);
    profile.resumeText = parsedResume.resumeText;
    profile.sourceResumeName = parsedResume.sourceResumeName ?? file.originalname ?? profile.sourceResumeName;
    profile.resumeUpdatedAt = new Date();

    return profile.save();
  }

  private mergeList(current: string[] = [], next?: string[]) {
    return [...new Set([...(current ?? []), ...(next ?? [])].filter(Boolean))];
  }

  private replaceList(next?: string[]) {
    return [...new Set((next ?? []).map((entry) => entry?.trim()).filter(Boolean) as string[])];
  }

  private getMissingRequiredResumeFields(parsedResume: { fullName?: string; email?: string }) {
    const missingFields: string[] = [];

    if (!parsedResume.fullName?.trim()) {
      missingFields.push('fullName');
    }

    if (!parsedResume.email?.trim()) {
      missingFields.push('email');
    }

    return missingFields;
  }
}
