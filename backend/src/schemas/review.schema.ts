import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MongooseSchema, type Types } from 'mongoose';

/** Оцінка після оренди: одна від кожної сторони на оренду. Лише зірки й теги з фіксованого списку. */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Review {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Deal', required: true })
  dealId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  authorId: Types.ObjectId;

  /** Кого оцінили */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  targetId: Types.ObjectId;

  /** Роль оціненого в цій оренді: власник чи орендар */
  @Prop({ required: true, enum: ['owner', 'renter'] })
  targetRole: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ type: [String], default: [] })
  tags: string[];

  createdAt: Date;
}

export type ReviewDocument = HydratedDocument<Review>;
export const ReviewSchema = SchemaFactory.createForClass(Review);
ReviewSchema.index({ dealId: 1, authorId: 1 }, { unique: true });
ReviewSchema.index({ targetId: 1 });
