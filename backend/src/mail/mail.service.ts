import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Відправка листів через Resend (https://resend.com, безкоштовно до 3 000 листів на місяць).
 * Без RESEND_API_KEY лист лише потрапляє в журнал сервера: так працює локальна розробка й тести.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async send(to: string, subject: string, text: string): Promise<boolean> {
    const key = this.config.get<string>('RESEND_API_KEY')?.trim();
    if (!key) {
      this.logger.warn(`Листа не надіслано (немає RESEND_API_KEY). Кому: ${to}. Тема: ${subject}\n${text}`);
      return false;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: this.config.get<string>('MAIL_FROM')?.trim() || 'Kolo <onboarding@resend.dev>', to, subject, text }),
      });
      if (!res.ok) this.logger.error(`Resend відповів ${res.status}: ${await res.text()}`);
      return res.ok;
    } catch (e) {
      this.logger.error(`Не вдалося надіслати лист: ${(e as Error).message}`);
      return false;
    }
  }
}
