import { Router, Request, Response } from 'express';
import { emailService } from '../services/email.service';
import { emailReportService } from '../services/email-report.service';
import { logger } from '../utils/logger';
import dayjs from 'dayjs';

const router = Router();

/**
 * GET /api/email/test
 * Test email service configuration
 */
router.get('/test', async (req: Request, res: Response): Promise<void> => {
  try {
    const isReady = emailService.isReady();
    if (!isReady) {
      res.status(503).json({
        success: false,
        error: 'Email service not configured',
        message: 'Please configure email settings in environment variables',
        provider: emailService.getProvider(),
      });
      return;
    }

    const verified = await emailService.verifyConnection();
    const provider = emailService.getProvider();
    res.json({
      success: true,
      configured: isReady,
      connectionVerified: verified,
      provider: provider,
      message: verified
        ? `Email service is configured and connection verified (${provider})`
        : `Email service is configured but connection verification failed (${provider})`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[EmailRoute] Error testing email service:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to test email service',
      details: errorMessage,
    });
  }
});

/**
 * POST /api/email/test-send
 * Send a test email
 */
router.post('/test-send', async (req: Request, res: Response): Promise<void> => {
  try {
    const { to, subject } = req.body;

    if (!to) {
      res.status(400).json({
        success: false,
        error: 'Email recipient (to) is required',
      });
      return;
    }

    const testSubject = subject || 'Test Email from WMS System';
    const testHTML = `
      <html>
        <body>
          <h2>Test Email</h2>
          <p>This is a test email from the WMS Cron Job System.</p>
          <p>If you received this, your email configuration is working correctly!</p>
          <p><strong>Sent at:</strong> ${dayjs().format('YYYY-MM-DD HH:mm:ss UTC')}</p>
        </body>
      </html>
    `;

    const sent = await emailService.sendEmail({
      to,
      subject: testSubject,
      html: testHTML,
    });

    if (sent) {
      res.json({
        success: true,
        message: 'Test email sent successfully',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to send test email. Check server logs for details.',
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[EmailRoute] Error sending test email:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to send test email',
      details: errorMessage,
    });
  }
});

/**
 * POST /api/email/report/daily
 * Generate and send a daily report
 */
router.post('/report/daily', async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, recipients, location } = req.body;

    if (!date) {
      res.status(400).json({
        success: false,
        error: 'Date is required (YYYY-MM-DD format)',
      });
      return;
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Recipients array is required and must not be empty',
      });
      return;
    }

    const sent = await emailReportService.sendDailyReport(date, recipients, location);

    if (sent) {
      res.json({
        success: true,
        message: 'Daily report sent successfully',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to send daily report. Check server logs for details.',
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[EmailRoute] Error sending daily report:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to send daily report',
      details: errorMessage,
    });
  }
});

export default router;

