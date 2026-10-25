import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { BASE_URL, getApiToken } from './api';

/** Відповідь /deals/:id/contract */
export type ContractSection = { title: string; paragraphs: string[] };
export type ContractSignature = { at: string; method: string; signatureId: string } | null;

export type ContractView = {
  dealId: string;
  number: string;
  createdAt: string;
  hash: string;
  terms: {
    city: string;
    owner: { name: string; phone: string };
    renter: { name: string; phone: string };
    car: { title: string; vin: string; mileage: number; year: number };
    startDate: string;
    endDate: string;
    days: number;
    pricePerDay: number;
    total: number;
  };
  sections: ContractSection[];
  signatures: { owner: ContractSignature; renter: ContractSignature };
  status: 'awaiting' | 'active' | 'terminated';
  signedAt: string | null;
  mySigned: boolean;
};

export const METHOD_LABEL = (method: string) => (method === 'demo' ? 'підтвердження в застосунку (демо)' : method);

/**
 * Завантажує PDF договору з сервера (з токеном) у кеш пристрою й відкриває системне вікно «Поділитись»:
 * звідти його можна переглянути, зберегти у «Файли» чи надіслати.
 */
export async function downloadContractPdf(dealId: string, number: string) {
  const dir = new Directory(Paths.cache, 'contracts');
  dir.create({ idempotent: true });
  // Стара копія з тим самим іменем (договір підписали вдруге) не заважає: завантажуємо наново
  const target = new File(dir, `${number}.pdf`);
  if (target.exists) target.delete();

  const task = File.createDownloadTask(`${BASE_URL}/deals/${dealId}/contract.pdf`, dir, { headers: { Authorization: `Bearer ${getApiToken() ?? ''}` } });
  const file = await task.downloadAsync();
  if (!file) throw new Error('Не вдалося завантажити договір');
  if (!(await Sharing.isAvailableAsync())) throw new Error('На цьому пристрої не можна поділитись файлом');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Договір ${number}` });
}
