import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export const JOB_SOURCE_TYPES = ['mock-curated', 'greenhouse-board', 'lever-postings', 'ashby-board', 'djinni-search'] as const;
export type JobSourceType = (typeof JOB_SOURCE_TYPES)[number];
export type JobSourceDocument = HydratedDocument<JobSource>;

@Schema({ timestamps: true, collection: 'job_sources' })
export class JobSource {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: JOB_SOURCE_TYPES })
  type: JobSourceType;

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ default: '0 2 * * *' })
  runCron: string;

  @Prop({ default: 'Africa/Nairobi' })
  timeZone: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  config: Record<string, unknown>;

  @Prop()
  lastRunAt?: Date;

  @Prop()
  lastRunStatus?: string;

  @Prop()
  lastRunError?: string;
}

export const JobSourceSchema = SchemaFactory.createForClass(JobSource);

