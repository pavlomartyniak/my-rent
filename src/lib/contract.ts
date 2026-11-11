import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { BASE_URL, getApiToken } from './api';

/** Відповідь /deals/:id/contract */
export type ContractSection = { title: string; paragraphs: string[] };
export type ContractSignature = { at: string; method: string; signatureId: string; /** Частково прихована пошта, на яку приходив код */ email?: string } | null;

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
  /** Вікно підписання: договір підписують під час зустрічі, тож воно відкривається за добу до початку оренди */
  signing: { opensAt: string; closesAt: string; state: 'early' | 'open' | 'late' };
  /** Одностороння відмова від договору, якщо була: хто, чому, коли отримано й коли договір буде розірвано (через 12 год після отримання) */
  withdrawal: { by: 'owner' | 'renter'; ground: string; groundLabel: string; note: string; at: string; delivered: boolean; readAt: string | null; effectiveAt: string } | null;
};

/** Підстави відмови від договору (їх перевіряє сервер): окремо для власника й орендаря */
export const OWNER_GROUNDS = [
  { value: 'payment_overdue', title: 'Прострочка оплати понад 2 дні', hint: 'Орендар не сплатив платіж, строк якого минув більш як два дні тому.' },
  { value: 'third_party', title: 'Авто передано іншій особі', hint: 'Орендар без вашої згоди віддав авто третій особі.' },
  { value: 'driver_missing', title: 'Орендар не виходить на зв’язок', hint: 'Водій зник, не відповідає на дзвінки й повідомлення більше доби.' },
  { value: 'license_revoked', title: 'Позбавлення права керування', hint: 'Орендаря позбавили посвідчення водія.' },
  { value: 'accident_fault', title: 'ДТП з вини орендаря', hint: 'Орендар спричинив аварію.' },
] as const;
export const RENTER_GROUNDS = [
  { value: 'car_unusable', title: 'Авто непридатне з вини власника', hint: 'Авто не можна використовувати понад 3 доби з причин, за які відповідає власник.' },
  { value: 'false_warranties', title: 'Гарантії власника недостовірні', hint: 'Власник не мав права передавати авто: застава банку, спільне майно без згоди, арешт.' },
  { value: 'force_majeure', title: 'Непереборна сила', hint: 'Конкретна подія унеможливила виконання: обстріл, вилучення авто, призов на службу. Потрібні докази.' },
] as const;
export type WithdrawGround = (typeof OWNER_GROUNDS)[number]['value'] | (typeof RENTER_GROUNDS)[number]['value'];

export const METHOD_LABEL = (method: string) => (method === 'email_otp' ? 'підтвердження кодом з e-mail' : method === 'demo' ? 'підтвердження в застосунку' : method);

/** Завантажує PDF із сервера (з токеном) у кеш пристрою й відкриває системне вікно «Поділитись»: звідти його можна переглянути, зберегти чи надіслати */
async function downloadPdf(urlPath: string, fileName: string, dialogTitle: string) {
  const dir = new Directory(Paths.cache, 'contracts');
  dir.create({ idempotent: true });
  // Стара копія з тим самим іменем (документ підписали вдруге) не заважає: завантажуємо наново
  const target = new File(dir, `${fileName}.pdf`);
  if (target.exists) target.delete();

  const task = File.createDownloadTask(`${BASE_URL}${urlPath}`, dir, { headers: { Authorization: `Bearer ${getApiToken() ?? ''}` } });
  const file = await task.downloadAsync();
  if (!file) throw new Error('Не вдалося завантажити файл');
  if (!(await Sharing.isAvailableAsync())) throw new Error('На цьому пристрої не можна поділитись файлом');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
}

/** PDF договору */
export async function downloadContractPdf(dealId: string, number: string) {
  await downloadPdf(`/deals/${dealId}/contract.pdf`, number, `Договір ${number}`);
}
