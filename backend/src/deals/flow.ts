import type { Model } from 'mongoose';

/** Роздільна здатність посилань зі службових повідомлень: екран, на який веде кнопка в чаті */
export type FlowLink = 'condition' | 'condition-confirm' | 'legal' | 'contract';

/**
 * Атомарно «займає» повідомлення про крок для оренди: true лише першому, хто його позначив. Так кожне службове повідомлення
 * потрапляє в чат один раз, навіть коли дію повторюють чи два запити приходять одночасно.
 */
export async function claimFlow(deals: Model<any>, dealId: string, key: string): Promise<boolean> {
  const r = await deals.updateOne({ _id: dealId, [`flow.${key}`]: { $exists: false } }, { $set: { [`flow.${key}`]: new Date() } }, { timestamps: false }).exec();
  return r.modifiedCount > 0;
}

export const dmy = (iso: string) => iso.split('-').reverse().join('.');
