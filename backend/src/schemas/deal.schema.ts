import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { ContractTerms } from '../contract/contract.terms';
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

  /** awaiting — чекаємо підписів під договором, active — договір підписано (оренда триває чи ще не почалась), terminated — розірвана достроково */
  @Prop({ required: true, enum: ['awaiting', 'active', 'terminated'], default: 'active' })
  status: string;

  /** Пропозиція розірвати оренду: діє, доки друга сторона не погодиться чи не відхилить */
  @Prop({ type: { by: { type: String, enum: ['owner', 'renter'] }, at: Date, note: String }, _id: false })
  terminationRequest?: { by: string; at: Date; note: string };

  /** Хто розірвав: сторона або система (договір не підписали до початку оренди) */
  @Prop({ enum: ['owner', 'renter', 'system'] })
  terminatedBy?: string;

  @Prop()
  terminatedAt?: Date;

  @Prop({ default: '' })
  terminationNote: string;

  /**
   * Договір оренди: умови (знімок на момент прийняття), їхній відбиток і підписи сторін.
   * Оренди, створені до появи договорів, його не мають.
   */
  @Prop({ type: MongooseSchema.Types.Mixed })
  contract?: {
    terms: ContractTerms;
    hash: string;
    signatures: { owner?: { at: Date; method: string; signatureId: string }; renter?: { at: Date; method: string; signatureId: string } };
    signedAt?: Date;
  };

  /**
   * Стан платежів за графіком договору: скільки кожна сторона підтвердила за кожен платіж. Облік (витрата в орендаря,
   * дохід у власника) створюється за підтвердженнями, а не при підписанні.
   */
  @Prop({ type: MongooseSchema.Types.Mixed })
  payments?: {
    n: number;
    /** Скільки сплатив орендар і скільки отримав власник (за їхніми відповідями) */
    renterPaid: number;
    ownerReceived: number;
    /** Відповідь «ще ні» відкладає запитання до цієї дати (YYYY-MM-DD) */
    renterLaterUntil?: string;
    ownerLaterUntil?: string;
    /** Платіж скасовано (оренду розірвано до його строку) */
    cancelled?: boolean;
  }[];

  /**
   * Застава за договором: чи підтвердила кожна сторона, що її внесено. Лише відмітка: повернення й утримання
   * сторони домовляються самі, застосунок їх не веде. Є лише в оренд із заставою.
   */
  @Prop({ type: { renterPaid: Boolean, ownerReceived: Boolean }, _id: false })
  deposit?: { renterPaid: boolean; ownerReceived: boolean };

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
