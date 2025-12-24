import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  fromName?: string;
}

type EmailProvider = 'smtp' | 'mailtrap-api';

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured: boolean = false;
  private provider: EmailProvider = 'smtp';
  private mailtrapApiToken: string | null = null;
  private mailtrapApiUrl: string = 'https://send.api.mailtrap.io/api/send';

  constructor() {
    this.initializeService();
  }

  private initializeService() {
    // Check which provider to use
    // Default to Mailtrap API if API token is present, otherwise default to SMTP
    let emailProvider = process.env['EMAIL_PROVIDER']?.toLowerCase() as EmailProvider;
    
    // Auto-detect: If API token exists and no provider specified, use API
    if (!emailProvider) {
      const hasApiToken = !!(process.env['MAILTRAP_API_TOKEN'] || 
                             process.env['SMTP_MAILTRAP_API'] || 
                             process.env['SMPTP_MAILTRAP_API']);
      emailProvider = hasApiToken ? 'mailtrap-api' : 'smtp';
    }
    
    this.provider = emailProvider;

    if (emailProvider === 'mailtrap-api') {
      this.initializeMailtrapApi();
    } else {
      this.initializeTransporter();
    }
  }

  private initializeMailtrapApi() {
    // Support both typo (SMPTP) and correct (SMTP) env var names
    const apiToken = process.env['MAILTRAP_API_TOKEN'] || 
                     process.env['SMTP_MAILTRAP_API'] || 
                     process.env['SMPTP_MAILTRAP_API'];

    if (!apiToken) {
      logger.warn('[EmailService] Mailtrap API token not found. Email functionality disabled.');
      logger.warn('[EmailService] Required env var: MAILTRAP_API_TOKEN or SMTP_MAILTRAP_API');
      this.isConfigured = false;
      return;
    }

    this.mailtrapApiToken = apiToken;
    this.isConfigured = true;
    logger.info('[EmailService] Mailtrap API initialized successfully');
  }

  private initializeTransporter() {
    const smtpHost = process.env['SMTP_HOST'];
    const smtpPort = process.env['SMTP_PORT'] ? parseInt(process.env['SMTP_PORT'], 10) : 587;
    const smtpSecure = process.env['SMTP_SECURE'] === 'true';
    const smtpUser = process.env['SMTP_USER'];
    const smtpPass = process.env['SMTP_PASS'];

    if (!smtpHost || !smtpUser || !smtpPass) {
      logger.warn('[EmailService] SMTP configuration incomplete. Email functionality disabled.');
      logger.warn('[EmailService] Required env vars: SMTP_HOST, SMTP_USER, SMTP_PASS');
      this.isConfigured = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        // Add timeout and connection options
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });

      this.isConfigured = true;
      logger.info('[EmailService] Email service initialized successfully (SMTP)', {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
      });
    } catch (error) {
      logger.error('[EmailService] Failed to initialize email transporter:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Verify connection (SMTP or Mailtrap API)
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.isConfigured) {
      logger.warn('[EmailService] Cannot verify connection - email service not configured');
      return false;
    }

    if (this.provider === 'mailtrap-api') {
      // For API, we can't really verify without sending a test email
      // Just check if token is present
      return this.mailtrapApiToken !== null;
    }

    if (!this.transporter) {
      logger.warn('[EmailService] Cannot verify connection - SMTP transporter not initialized');
      return false;
    }

    try {
      await this.transporter.verify();
      logger.info('[EmailService] SMTP connection verified successfully');
      return true;
    } catch (error) {
      logger.error('[EmailService] SMTP connection verification failed:', error);
      return false;
    }
  }

  /**
   * Send email via SMTP or Mailtrap API
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isConfigured) {
      logger.warn('[EmailService] Email service not configured. Skipping email send.');
      logger.warn('[EmailService] Attempted to send:', {
        to: options.to,
        subject: options.subject,
      });
      return false;
    }

    // Check if email reports are enabled
    if (process.env['EMAIL_REPORTS_ENABLED'] === 'false') {
      logger.info('[EmailService] Email reports disabled via EMAIL_REPORTS_ENABLED=false');
      return false;
    }

    if (this.provider === 'mailtrap-api') {
      return this.sendViaMailtrapApi(options);
    } else {
      return this.sendViaSMTP(options);
    }
  }

  /**
   * Send email via Mailtrap API
   */
  private async sendViaMailtrapApi(options: EmailOptions): Promise<boolean> {
    if (!this.mailtrapApiToken) {
      logger.error('[EmailService] Mailtrap API token not configured');
      return false;
    }

    try {
      const fromEmail = options.from || process.env['EMAIL_FROM'] || 'noreply@example.com';
      const fromName = options.fromName || process.env['EMAIL_FROM_NAME'] || 'WMS System';
      const recipients = Array.isArray(options.to) ? options.to : [options.to];

      // Mailtrap API payload (matches official Mailtrap API format)
      const payload: any = {
        from: {
          email: fromEmail,
          name: fromName,
        },
        to: recipients.map(email => ({ email })),
        subject: options.subject,
        text: options.text || this.htmlToText(options.html),
      };

      // Add HTML if provided
      if (options.html) {
        payload.html = options.html;
      }

      // Add category for tracking (optional)
      if (process.env['MAILTRAP_CATEGORY']) {
        payload.category = process.env['MAILTRAP_CATEGORY'];
      }

      const response = await fetch(this.mailtrapApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.mailtrapApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('[EmailService] Mailtrap API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        return false;
      }

      const result = await response.json();
      logger.info('[EmailService] Email sent successfully via Mailtrap API', {
        to: options.to,
        subject: options.subject,
        messageIds: result.message_ids,
      });
      return true;
    } catch (error) {
      logger.error('[EmailService] Failed to send email via Mailtrap API:', error);
      logger.error('[EmailService] Email options:', {
        to: options.to,
        subject: options.subject,
      });
      return false;
    }
  }

  /**
   * Send email via SMTP
   */
  private async sendViaSMTP(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      logger.error('[EmailService] SMTP transporter not initialized');
      return false;
    }

    try {
      const fromEmail = options.from || process.env['EMAIL_FROM'] || process.env['SMTP_USER'];
      const fromName = options.fromName || process.env['EMAIL_FROM_NAME'] || 'WMS System';

      const mailOptions = {
        from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.htmlToText(options.html),
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info('[EmailService] Email sent successfully via SMTP', {
        to: options.to,
        subject: options.subject,
        messageId: info.messageId,
      });
      return true;
    } catch (error) {
      logger.error('[EmailService] Failed to send email via SMTP:', error);
      logger.error('[EmailService] Email options:', {
        to: options.to,
        subject: options.subject,
      });
      return false;
    }
  }

  /**
   * Send email to multiple recipients
   */
  async sendBulkEmail(recipients: string[], subject: string, html: string, text?: string): Promise<boolean> {
    if (recipients.length === 0) {
      logger.warn('[EmailService] No recipients provided for bulk email');
      return false;
    }

    return this.sendEmail({
      to: recipients,
      subject,
      html,
      text,
    });
  }

  /**
   * Simple HTML to text converter (basic implementation)
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  /**
   * Check if email service is configured and ready
   */
  isReady(): boolean {
    if (this.provider === 'mailtrap-api') {
      return this.isConfigured && this.mailtrapApiToken !== null;
    }
    return this.isConfigured && this.transporter !== null;
  }

  /**
   * Get current email provider
   */
  getProvider(): EmailProvider {
    return this.provider;
  }
}

// Export singleton instance
export const emailService = new EmailService();

