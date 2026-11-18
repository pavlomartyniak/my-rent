export type RentPurpose = 'taxi' | 'delivery' | 'personal' | 'business';
export const PURPOSE_LABELS: Record<RentPurpose, string> = { taxi: 'Таксі', delivery: 'Доставка', personal: 'Особисті поїздки', business: 'Робота й бізнес' };

/** Відповіді орендаря «зі слів»: вибираються зі списків, сервіс їх не перевіряє. Порожній рядок чи масив — не вказано. */
export type RenterAnswers = {
  purposes: RentPurpose[];
  licenseCategories: string[];
  accidents: string;
  rentExperience: string;
  occupation: string;
  rentTerm: string;
  depositReady: string;
  transmission: string;
};

/** Відповіді власника «зі слів»: те, що орендар хоче знати про нього до запиту */
export type OwnerAnswers = {
  replyTime: string;
  handover: string;
  hostingExperience: string;
  insurances: string[];
  serviceCare: string;
  mileageLimit: string;
  abroad: string;
};

export type Answers = RenterAnswers & OwnerAnswers;

/** Питання анкети (орендаря чи власника): з них будується і форма, і блок «Відомості» в профілі, тому текст в одному місці */
export type Question = { key: keyof Answers; label: string; /** Підпис у профілі */ shown: string; icon: string; multi?: boolean; hint?: string; options: { value: string; label: string }[] };

export const RENTER_QUESTIONS: Question[] = [
  { key: 'purposes', label: 'Для чого потрібне авто', shown: 'Орендує для', icon: 'car-sport-outline', multi: true, hint: 'Можна вибрати кілька', options: Object.entries(PURPOSE_LABELS).map(([value, label]) => ({ value, label })) },
  { key: 'licenseCategories', label: 'Категорії водійських прав', shown: 'Категорії прав', icon: 'card-outline', multi: true, options: [{ value: 'B', label: 'B (легкові)' }, { value: 'C', label: 'C (вантажні)' }, { value: 'D', label: 'D (автобуси)' }] },
  { key: 'accidents', label: 'Чи були ДТП за останні 3 роки', shown: 'ДТП за 3 роки', icon: 'shield-checkmark-outline', options: [{ value: 'none', label: 'Не було' }, { value: 'one', label: 'Одне' }, { value: 'several', label: 'Кілька' }] },
  { key: 'rentExperience', label: 'Чи орендували авто раніше', shown: 'Досвід оренди', icon: 'key-outline', options: [{ value: 'none', label: 'Ще ні' }, { value: 'few', label: 'Кілька разів' }, { value: 'regular', label: 'Регулярно' }] },
  { key: 'occupation', label: 'Чим займаєтесь', shown: 'Зайнятість', icon: 'briefcase-outline', options: [{ value: 'employee', label: 'Працюю за наймом' }, { value: 'fop', label: 'ФОП' }, { value: 'business', label: 'Власний бізнес' }, { value: 'driver', label: 'Водій (таксі, доставка)' }, { value: 'student', label: 'Навчаюсь' }, { value: 'other', label: 'Інше' }] },
  { key: 'rentTerm', label: 'На який строк зазвичай берете авто', shown: 'Звичайний строк', icon: 'calendar-outline', options: [{ value: 'week', label: 'До тижня' }, { value: 'month', label: '1–4 тижні' }, { value: 'long', label: 'Місяць і більше' }] },
  { key: 'depositReady', label: 'Чи готові внести заставу', shown: 'Застава', icon: 'wallet-outline', options: [{ value: 'yes', label: 'Так, готовий(а)' }, { value: 'discuss', label: 'Залежить від суми' }] },
  { key: 'transmission', label: 'Яка коробка передач підходить', shown: 'Коробка передач', icon: 'settings-outline', options: [{ value: 'auto', label: 'Автомат' }, { value: 'manual', label: 'Механіка' }, { value: 'both', label: 'Будь-яка' }] },
];

export const OWNER_QUESTIONS: Question[] = [
  { key: 'replyTime', label: 'Як швидко відповідаєте на запити', shown: 'Відповідає', icon: 'chatbubble-ellipses-outline', options: [{ value: 'instant', label: 'Одразу' }, { value: 'hour', label: 'Протягом години' }, { value: 'day', label: 'Протягом дня' }] },
  { key: 'handover', label: 'Як передаєте авто', shown: 'Передача авто', icon: 'key-outline', options: [{ value: 'onsite', label: 'Зустріч на місці' }, { value: 'delivery', label: 'Привожу авто' }, { value: 'both', label: 'Обидва варіанти' }] },
  { key: 'hostingExperience', label: 'Як давно здаєте авто', shown: 'Досвід здачі', icon: 'ribbon-outline', options: [{ value: 'new', label: 'Тільки починаю' }, { value: 'year', label: 'До року' }, { value: 'years', label: '1–3 роки' }, { value: 'long', label: 'Понад 3 роки' }] },
  { key: 'insurances', label: 'Страхування авто', shown: 'Страхування', icon: 'shield-checkmark-outline', multi: true, hint: 'Можна вибрати обидва', options: [{ value: 'osago', label: 'ОСЦПВ' }, { value: 'kasko', label: 'КАСКО' }] },
  { key: 'serviceCare', label: 'Хто обслуговує авто', shown: 'Обслуговування', icon: 'construct-outline', options: [{ value: 'official', label: 'Офіційний сервіс' }, { value: 'trusted', label: 'Перевірений сервіс' }, { value: 'asneeded', label: 'За потреби' }] },
  { key: 'mileageLimit', label: 'Ліміт пробігу за добу', shown: 'Пробіг', icon: 'speedometer-outline', options: [{ value: 'unlimited', label: 'Без обмежень' }, { value: 'limited', label: 'Є ліміт' }] },
  { key: 'abroad', label: 'Виїзд за кордон', shown: 'Виїзд за кордон', icon: 'airplane-outline', options: [{ value: 'allowed', label: 'Дозволено' }, { value: 'agreement', label: 'За домовленістю' }, { value: 'forbidden', label: 'Заборонено' }] },
];

/** Питання анкети для ролі: орендар чи власник */
export const questionsFor = (role: string): Question[] => (role === 'owner' ? OWNER_QUESTIONS : RENTER_QUESTIONS);

/** Необов'язкові дані профілю: показуються іншим на сторінці профілю */
export type ProfileExtras = Answers & { city: string; photoUri: string; about: string; /** Рік, з якого водить; null — не вказано */ drivingSince: number | null };

/** Порожні відповіді: початковий стан форми */
export const EMPTY_EXTRAS: ProfileExtras = { city: '', photoUri: '', about: '', drivingSince: null, purposes: [], licenseCategories: [], accidents: '', rentExperience: '', occupation: '', rentTerm: '', depositReady: '', transmission: '', replyTime: '', handover: '', hostingExperience: '', insurances: [], serviceCare: '', mileageLimit: '', abroad: '' };

/** Чи є хоч одна відповідь анкети для цієї ролі */
export const hasAnswers = (a: Partial<Answers>, role: string) => questionsFor(role).some((q) => (Array.isArray(a[q.key]) ? (a[q.key] as unknown[]).length > 0 : !!a[q.key]));

export type Profile = { firstName: string; lastName: string; middleName: string; phone: string } & Partial<ProfileExtras>;

/** Той самий шаблон, що й на сервері: цифри, +, пробіли, дужки, дефіси; 7–20 символів */
const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/;

/** Телефон обов'язковий */
export const isValidPhone = (phone: string) => PHONE_PATTERN.test(phone.trim());
export const phoneError = (phone: string) => (!phone.trim() ? 'Вкажіть номер телефону' : isValidPhone(phone) ? '' : 'Невірний формат телефону');

export const fullName = (p: Pick<Profile, 'firstName' | 'lastName'>) => [p.firstName, p.lastName].filter(Boolean).join(' ');
