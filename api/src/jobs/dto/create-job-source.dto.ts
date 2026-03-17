import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { JOB_SOURCE_TYPES } from '../schemas/job-source.schema';
import type { JobSourceType } from '../schemas/job-source.schema';

export class CreateJobSourceDto {
  @IsString()
  name: string;

  @IsIn(JOB_SOURCE_TYPES)
  type: JobSourceType;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  runCron?: string;

  @IsOptional()
  @IsString()
  timeZone?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

