import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MongooseSchema, type Types } from 'mongoose';

export type ChatContext = { title: string; photoUri?: string; city: string; pricePerDay: number; startDate: string; endDate: string };

/**
 * Окрема розмова під кожен запит на оренду чи пропозицію (і оренду, що з них виросла).
 * Так розмови про різні авто не змішуються, а в кожній видно, про яке авто йдеться.
 */
@Schema({ timestamps: true })
export class Conversation {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  renterId: Types.ObjectId;

  /** З чого виникла розмова: запит орендаря на оголошення чи пропозиція власника на заявку */
  @Prop({ enum: ['request', 'offer'] })
  sourceKind?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  sourceId?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Car' })
  carId?: Types.ObjectId;

  /** Дані про авто й умови на момент початку розмови: показуються в шапці чату, навіть якщо запит уже видалено */
  @Prop({
    type: { title: String, photoUri: String, city: String, pricePerDay: Number, startDate: String, endDate: String },
    _id: false,
  })
  context?: ChatContext;

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

  /** Хто видалив розмову зі свого списку; нове повідомлення від співрозмовника повертає її */
  @Prop({ type: [String], default: [] })
  hiddenFor: string[];

  /** Коли сторона видалила розмову: старіші повідомлення вона більше не бачить */
  @Prop({ type: { owner: Date, renter: Date }, _id: false, default: () => ({}) })
  clearedAt: { owner?: Date; renter?: Date };

  @Prop({ required: true, default: () => new Date() })
  lastActivityAt: Date;

  createdAt: Date;
}

export type ConversationDocument = HydratedDocument<Conversation>;
export const ConversationSchema = SchemaFactory.createForClass(Conversation);
// Одна розмова на запит чи пропозицію (старі розмови без джерела не враховуються)
ConversationSchema.index({ sourceKind: 1, sourceId: 1 }, { unique: true, partialFilterExpression: { sourceId: { $type: 'objectId' } } });
ConversationSchema.index({ ownerId: 1, lastActivityAt: -1 });
ConversationSchema.index({ renterId: 1, lastActivityAt: -1 });
