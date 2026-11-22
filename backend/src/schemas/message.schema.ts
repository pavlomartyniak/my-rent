import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MongooseSchema, type Types } from 'mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Message {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  /** Може бути порожнім, якщо є вкладення */
  @Prop({ default: '' })
  text: string;

  /** Фото, відео й файли в хмарі (до 5) */
  @Prop({ type: [{ kind: { type: String, enum: ['image', 'video', 'file'] }, url: String, name: String, size: Number, fileId: MongooseSchema.Types.ObjectId, _id: false }], default: [] })
  attachments: { kind: 'image' | 'video' | 'file'; url: string; name: string; size: number; fileId?: Types.ObjectId }[];

  /** Ідентифікатор, який створює застосунок: повторна відправка того ж повідомлення (збій мережі) не дублює його */
  @Prop()
  clientId?: string;

  /** Службове повідомлення (запит, пропозиція, прийняття): це запис домовленості, його не можна змінити чи видалити */
  @Prop()
  system?: boolean;

  /** Посилання зі службового повідомлення на екран застосунку (наприклад, звіт про авто) */
  @Prop({ type: MongooseSchema.Types.Mixed })
  link?: { kind: string; dealId: string; reportId?: string };

  /** Коли текст востаннє змінили (позначка «змінено») */
  @Prop()
  editedAt?: Date;

  /** Коли повідомлення видалили: на його місці лишається слід «Повідомлення видалено», а текст і файли стерті */
  @Prop()
  deletedAt?: Date;

  createdAt: Date;
}

export type MessageDocument = HydratedDocument<Message>;
export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ conversationId: 1, _id: -1 });
MessageSchema.index({ conversationId: 1, senderId: 1, clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } });
