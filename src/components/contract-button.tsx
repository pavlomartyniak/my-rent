import { useRouter } from 'expo-router';

import { Button } from './ui/button';

/** «Переглянути договір»: стоїть на картках прийнятих запитів і пропозицій, щоб договір було видно одразу після прийняття */
export function ContractButton({ dealId }: { dealId: string }) {
  const router = useRouter();
  return <Button title="Переглянути договір" icon="document-text-outline" variant="secondary" onPress={() => router.push({ pathname: '/contracts/[id]', params: { id: dealId } })} />;
}
