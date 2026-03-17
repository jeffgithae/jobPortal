import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AppUserDocument = HydratedDocument<AppUser>;

@Schema({ timestamps: true, collection: 'users' })
export class AppUser {
  @Prop({ required: true, unique: true, index: true })
  ownerKey: string;

  @Prop({ required: true, trim: true })
  displayName: string;

  @Prop({ required: true, lowercase: true, trim: true, unique: true })
  email: string;

  @Prop({ default: false })
  seeded: boolean;
}

export const AppUserSchema = SchemaFactory.createForClass(AppUser);
