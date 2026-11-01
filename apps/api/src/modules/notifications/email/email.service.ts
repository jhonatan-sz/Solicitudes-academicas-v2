import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { IEmailProvider, EmailOptions } from './email.interface';

@Injectable()
export class EmailService implements IEmailProvider {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn(
        'RESEND_API_KEY not configured — emails will be skipped',
      );
    }
  }

  async send(options: EmailOptions): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `Email skipped (no API key): "${options.subject}" → ${options.to}`,
      );
      return;
    }

    try {
      const { error } = await this.resend.emails.send({
        from: 'Solicitudes Académicas <no-reply@solicitudes-academicas.edu.co>',
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content.toString('base64'),
        })),
      });

      if (error) {
        throw new Error(`Resend: ${error.name}: ${error.message}`);
      }

      this.logger.log(`Email sent: "${options.subject}" → ${options.to}`);
    } catch (err) {
      this.logger.error(
        `Failed to send email "${options.subject}" → ${options.to}: ${err}`,
      );
      throw err;
    }
  }
}
