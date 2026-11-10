/** Скільки символів тексту скарги й знімка зберігаємо */
export const SNAPSHOT_MAX = 300;

/** Знімок для скарги: текст, обрізаний до розумної довжини, без переносів */
export function makeSnapshot(text: string) {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > SNAPSHOT_MAX ? `${flat.slice(0, SNAPSHOT_MAX - 1)}…` : flat;
}

/** Хто з пари заблокований одне одним: ідентифікатори «чужих» сторін усіх блокувань користувача */
export function counterpartIds(me: string, blocks: { blockerId: unknown; blockedId: unknown }[]) {
  const ids = new Set<string>();
  for (const b of blocks) {
    const blocker = String(b.blockerId);
    const blocked = String(b.blockedId);
    ids.add(blocker === me ? blocked : blocker);
  }
  ids.delete(me);
  return [...ids];
}
