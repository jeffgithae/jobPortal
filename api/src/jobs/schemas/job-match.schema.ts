import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type JobMatchDocument = HydratedDocument<JobMatch>;

@Schema({ timestamps: true, collection: 'job_matches' })
export class JobMatch {
  @Prop({ required: true, index: true })
  ownerKey: string;

  @Prop({ required: true, index: true })
  sourceJobKey: string;

  @Prop({ required: true, index: true })
  jobPostingId: string;

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

  @Prop({ type: [String], default: [] })
  skills: string[];

  @Prop({ default: 0 })
  matchScore: number;

  @Prop({ type: [String], default: [] })
  matchReasons: string[];

  @Prop({ type: [String], default: [] })
  missingRequirements: string[];

  @Prop({ default: false })
  isRecommended: boolean;

  @Prop()
  postedAt?: Date;
}

export const JobMatchSchema = SchemaFactory.createForClass(JobMatch);
JobMatchSchema.index({ ownerKey: 1, sourceJobKey: 1 }, { unique: true });

