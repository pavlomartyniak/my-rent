import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MongooseSchema, type Types } from 'mongoose';

/**
 * Файл, доданий до повідомлення чату. Лежить у нашій базі (а не в публічній хмарі) і віддається лише учасникам розмови, як
 * страховий поліс. До повідомлення файл прив'язується, коли воно надіслане; непривязані (завантажили й не надіслали) прибираються.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class ChatFile {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Conversation', required: true, index: true })
  conversationId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  uploaderId: Types.ObjectId;

  /** Повідомлення, до якого прикріплено файл; порожнє, поки його не надіслано */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Message', index: true })
  messageId?: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  mime: string;

  @Prop({ required: true })
  size: number;

  @Prop({ type: Buffer, required: true })
  data: Buffer;

  createdAt: Date;
}

export type ChatFileDocument = HydratedDocument<ChatFile>;
export const ChatFileSchema = SchemaFactory.createForClass(ChatFile);
ChatFileSchema.index({ createdAt: 1 });
