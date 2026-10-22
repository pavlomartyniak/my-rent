import type { SchemaOptions } from 'mongoose';

/**
 * Серіалізація документів для API: `_id` → `id`, посилання на інші документи — рядками,
 * службові й приватні поля прибираються.
 */
export function jsonOptions(refs: string[] = [], hidden: string[] = []): SchemaOptions {
  return {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        for (const key of refs) if (ret[key] != null) ret[key] = String(ret[key]);
        for (const key of ['userId', 'createdAt', 'updatedAt', ...hidden]) delete ret[key];
        return ret;
      },
    },
  };
}
