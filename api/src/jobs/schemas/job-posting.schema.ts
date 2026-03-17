import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type JobPostingDocument = HydratedDocument<JobPosting>;

@Schema({ timestamps: true, collection: 'job_postings' })
export class JobPosting {
  @Prop({ required: true, unique: true, index: true })
  sourceJobKey: string;

  @Prop({ required: true })
  externalId: string;

  @Prop({ required: true })
  sourceType: string;

  @Prop({ required: true })
  sourceName: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  company: string;

  @Prop()
  location?: string;

  @Prop({ default: false })
  remote: boolean;

  @Prop()
  employmentType?: string;

  @Prop()
  url?: string;

  @Prop()
  description?: string;

  @Prop({ type: [String], default: [] })
  requirements: string[];

  @Prop({ type: [String], default: [] })
  skills: string[];

  @Prop()
  minExperienceYears?: number;

  @Prop()
  seniority?: string;

  @Prop()
  postedAt?: Date;

  @Prop()
  fetchedAt?: Date;

  @Prop({ default: 0 })
  matchScore: number;

  @Prop({ type: [String], default: [] })
  matchReasons: string[];

  @Prop({ type: [String], default: [] })
  missingRequirements: string[];

  @Prop({ default: false })
  isRecommended: boolean;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  raw: Record<string, unknown>;
}

export const JobPostingSchema = SchemaFactory.createForClass(JobPosting);
