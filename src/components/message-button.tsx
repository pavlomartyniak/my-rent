import { useState } from 'react';

import { openChat, type ChatContext } from '@/lib/chat';

import { Button } from './ui/button';

/** «Написати»: відкриває чат зі співрозмовником у контексті запиту, пропозиції чи оренди */
export function MessageButton({ context, title = 'Написати' }: { context: ChatContext; title?: string }) {
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    await openChat(context);
    setBusy(false);
  }

  return <Button title={title} icon="chatbubble-ellipses-outline" variant="secondary" disabled={busy} onPress={() => void open()} />;
}
