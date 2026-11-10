import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MongooseSchema, type Types } from 'mongoose';

/** Користувач заблокував іншого: вони більше не бачать оголошень одне одного й не можуть писати чи надсилати запити */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Block {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  blockerId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  blockedId: Types.ObjectId;

  createdAt: Date;
}

export type BlockDocument = HydratedDocument<Block>;
export const BlockSchema = SchemaFactory.createForClass(Block);
BlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
BlockSchema.index({ blockedId: 1 });
