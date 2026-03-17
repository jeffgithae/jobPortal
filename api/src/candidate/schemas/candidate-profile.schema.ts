import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class EducationRecord {
  @Prop({ required: true })
  institution: string;

  @Prop({ required: true })
  degree: string;

  @Prop()
  period?: string;
}

export const EducationRecordSchema = SchemaFactory.createForClass(EducationRecord);
export type CandidateProfileDocument = HydratedDocument<CandidateProfile>;

@Schema({ timestamps: true, collection: 'candidate_profiles' })
export class CandidateProfile {
  @Prop({ required: true, unique: true })
  ownerKey: string;

  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop()
  phone?: string;

  @Prop()
  headline?: string;

  @Prop()
  summary?: string;

  @Prop()
  location?: string;

  @Prop({ type: [String], default: [] })
  preferredLocations: string[];

  @Prop({ type: [String], default: [] })
  workPreferences: string[];

  @Prop({ default: 0 })
  yearsExperience: number;

  @Prop()
  seniority?: string;

  @Prop({ type: [String], default: [] })
  targetRoles: string[];

  @Prop({ type: [String], default: [] })
  skills: string[];

  @Prop({ type: [String], default: [] })
  certifications: string[];

  @Prop({ type: [String], default: [] })
  languages: string[];

  @Prop({ type: [EducationRecordSchema], default: [] })
  education: EducationRecord[];

  @Prop({ type: [String], default: [] })
  experienceHighlights: string[];

  @Prop()
  resumeText?: string;

  @Prop()
  sourceResumeName?: string;

  @Prop()
  resumeUpdatedAt?: Date;
}

export const CandidateProfileSchema = SchemaFactory.createForClass(CandidateProfile);
