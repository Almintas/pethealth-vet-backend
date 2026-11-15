import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SendMailParams = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendMailResult = { ok: true } | { ok: false; error: string };

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * Minimal transactional email over Resend's HTTP API (no SDK dependency).
 * Disabled unless RESEND_API_KEY and RESEND_FROM_EMAIL are set.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey() && this.fromEmail());
  }

  async send(params: SendMailParams): Promise<SendMailResult> {
    const apiKey = this.apiKey();
    const from = this.fromEmail();
    if (!apiKey || !from) {
      return { ok: false, error: 'Email delivery is not configured.' };
    }

    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ from, ...params }),
      });
      if (!response.ok) {
        const error = `Resend responded with HTTP ${response.status}`;
        this.logger.warn(error);
        return { ok: false, error };
      }
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email: ${message}`);
      return { ok: false, error: message };
    }
  }

  private apiKey(): string | undefined {
    return (
      this.configService.get<string>('RESEND_API_KEY')?.trim() || undefined
    );
  }

  private fromEmail(): string | undefined {
    return (
      this.configService.get<string>('RESEND_FROM_EMAIL')?.trim() || undefined
    );
  }
}
