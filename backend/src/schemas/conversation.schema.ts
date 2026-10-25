import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MongooseSchema, type Types } from 'mongoose';

/** Переписка власника з орендарем. Одна на пару людей, незалежно від кількості авто чи оренд. */
@Schema({ timestamps: true })
export class Conversation {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  renterId: Types.ObjectId;

  /** Про яке авто йшлося востаннє (з запиту, пропозиції чи оренди) — підпис у списку чатів */
  @Prop({ default: '' })
  contextTitle: string;

  @Prop({
    type: { text: String, senderId: MongooseSchema.Types.ObjectId, at: Date },
    _id: false,
  })
  lastMessage?: { text: string; senderId: Types.ObjectId; at: Date };

  /** Скільки непрочитаних повідомлень у кожної сторони */
  @Prop({ type: { owner: { type: Number, default: 0 }, renter: { type: Number, default: 0 } }, _id: false, default: () => ({ owner: 0, renter: 0 }) })
  unread: { owner: number; renter: number };

  /** Коли кожна сторона востаннє відкривала чат: за цим видно, що її повідомлення прочитано */
  @Prop({ type: { owner: Date, renter: Date }, _id: false, default: () => ({}) })
  lastReadAt: { owner?: Date; renter?: Date };

  @Prop({ required: true, default: () => new Date() })
  lastActivityAt: Date;

  createdAt: Date;
}

export type ConversationDocument = HydratedDocument<Conversation>;
export const ConversationSchema = SchemaFactory.createForClass(Conversation);
ConversationSchema.index({ ownerId: 1, renterId: 1 }, { unique: true });
ConversationSchema.index({ ownerId: 1, lastActivityAt: -1 });
ConversationSchema.index({ renterId: 1, lastActivityAt: -1 });
