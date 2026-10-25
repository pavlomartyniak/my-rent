import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MongooseSchema, type Types } from 'mongoose';

/**
 * Авто, яке орендар взяв в оренду. Створюється автоматично, коли запит на оренду чи пропозицію прийнято.
 * До угоди орендар веде свій облік: заробіток і витрати.
 */
@Schema({ timestamps: true })
export class Deal {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  renterId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Car', required: true })
  carId: Types.ObjectId;

  /** Дані авто на момент угоди: назва, фото, місто */
  @Prop({ required: true })
  title: string;

  @Prop()
  photoUri?: string;

  @Prop({ default: '' })
  city: string;

  /** Ціна оренди за добу, про яку домовились */
  @Prop({ required: true })
  pricePerDay: number;

  /** YYYY-MM-DD */
  @Prop({ required: true })
  startDate: string;

  @Prop({ required: true })
  endDate: string;

  /** Звідки угода: прийнятий запит на оголошення чи прийнята пропозиція на заявку */
  @Prop({ required: true, enum: ['request', 'offer'] })
  source: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  sourceId: Types.ObjectId;

  /** active — оренда діє (чи ще не почалась), terminated — розірвана достроково */
  @Prop({ required: true, enum: ['active', 'terminated'], default: 'active' })
  status: string;

  /** Пропозиція розірвати оренду: діє, доки друга сторона не погодиться чи не відхилить */
  @Prop({ type: { by: { type: String, enum: ['owner', 'renter'] }, at: Date, note: String }, _id: false })
  terminationRequest?: { by: string; at: Date; note: string };

  @Prop({ enum: ['owner', 'renter'] })
  terminatedBy?: string;

  @Prop()
  terminatedAt?: Date;

  @Prop({ default: '' })
  terminationNote: string;

  /** Власник відповів «оренда триває» на підказку звільнити авто після закінчення оренди */
  @Prop({ default: false })
  releaseDismissed: boolean;

  /** Хто прибрав архівну оренду зі свого списку; коли прибрали обидві сторони, запис видаляється */
  @Prop({ type: [String], default: [] })
  hiddenFor: string[];

  createdAt: Date;
}

export type DealDocument = HydratedDocument<Deal>;
export const DealSchema = SchemaFactory.createForClass(Deal);
DealSchema.index({ renterId: 1, createdAt: -1 });
// Одна угода на один прийнятий запит чи пропозицію
DealSchema.index({ source: 1, sourceId: 1 }, { unique: true });
