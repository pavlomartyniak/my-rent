import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MongooseSchema, type Types } from 'mongoose';

/**
 * Страховий поліс авто: сам файл зберігається в нашій базі (а не в публічній хмарі), бо в полісі є персональні дані.
 * На одне авто один файл; віддається лише власнику авто й орендарю з чинною орендою цього авто.
 */
@Schema({ timestamps: { createdAt: 'uploadedAt', updatedAt: false } })
export class InsuranceFile {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Car', required: true, unique: true })
  carId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  mime: string;

  @Prop({ required: true })
  size: number;

  @Prop({ type: Buffer, required: true })
  data: Buffer;

  /** До якої дати діє поліс (YYYY-MM-DD), необов'язково */
  @Prop()
  validUntil?: string;

  uploadedAt: Date;
}

export type InsuranceFileDocument = HydratedDocument<InsuranceFile>;
export const InsuranceFileSchema = SchemaFactory.createForClass(InsuranceFile);
