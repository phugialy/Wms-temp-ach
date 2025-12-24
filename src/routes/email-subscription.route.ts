import { Router, Request, Response } from 'express';
import { emailSubscriptionService } from '../services/email-subscription.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/email/subscriptions
 * Get all email subscriptions
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const activeOnly = req.query['activeOnly'] === 'true';
    const subscriptions = await emailSubscriptionService.getAllSubscriptions(activeOnly);
    
    // Serialize BigInt IDs
    const serialized = subscriptions.map(sub => ({
      ...sub,
      id: sub.id.toString(),
      scheduleIds: sub.scheduleIds.map(id => id.toString()),
      scheduleTime: sub.scheduleTime ? sub.scheduleTime.toISOString().split('T')[1]?.substring(0, 5) || null : null,
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
      lastSentAt: sub.lastSentAt?.toISOString() || null,
    }));

    res.json({
      success: true,
      data: serialized,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[EmailSubscriptionRoute] Error getting subscriptions:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to get email subscriptions',
      details: errorMessage,
    });
  }
});

/**
 * GET /api/email/subscriptions/:id
 * Get a specific subscription
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const idParam = req.params['id'];
    if (!idParam) {
      res.status(400).json({
        success: false,
        error: 'Subscription ID is required',
      });
      return;
    }

    const id = BigInt(idParam);
    const subscription = await emailSubscriptionService.getSubscriptionById(id);

    if (!subscription) {
      res.status(404).json({
        success: false,
        error: 'Subscription not found',
      });
      return;
    }

      // Serialize BigInt IDs
      const serialized = {
        ...subscription,
        id: subscription.id.toString(),
        scheduleIds: subscription.scheduleIds.map(id => id.toString()),
        scheduleTime: subscription.scheduleTime ? subscription.scheduleTime.toISOString().split('T')[1]?.substring(0, 5) || null : null,
        createdAt: subscription.createdAt.toISOString(),
        updatedAt: subscription.updatedAt.toISOString(),
        lastSentAt: subscription.lastSentAt?.toISOString() || null,
      };

    res.json({
      success: true,
      data: serialized,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[EmailSubscriptionRoute] Error getting subscription:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to get email subscription',
      details: errorMessage,
    });
  }
});

/**
 * POST /api/email/subscriptions
 * Create a new email subscription
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      description,
      scheduleIds,
      locationFilter,
      emailRecipients,
      deliveryMode,
      scheduleTime,
      scheduleFrequency,
      scheduleDays,
      timezone,
      emailOnSuccess,
      emailOnFailure,
      summaryOnly,
      createdBy,
    } = req.body;

    if (!name || !emailRecipients || !Array.isArray(emailRecipients) || emailRecipients.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Name and at least one email recipient are required',
      });
      return;
    }

    if (!deliveryMode || !['immediate', 'scheduled'].includes(deliveryMode)) {
      res.status(400).json({
        success: false,
        error: 'deliveryMode must be "immediate" or "scheduled"',
      });
      return;
    }

    if (deliveryMode === 'scheduled' && (!scheduleTime || !scheduleFrequency)) {
      res.status(400).json({
        success: false,
        error: 'scheduleTime and scheduleFrequency are required for scheduled delivery mode',
      });
      return;
    }

    const params = {
      name,
      description,
      scheduleIds: scheduleIds ? scheduleIds.map((id: string) => BigInt(id)) : undefined,
      locationFilter,
      emailRecipients,
      deliveryMode,
      scheduleTime,
      scheduleFrequency,
      scheduleDays,
      timezone,
      emailOnSuccess,
      emailOnFailure,
      summaryOnly,
      createdBy,
    };

    const subscription = await emailSubscriptionService.createSubscription(params);

    // Serialize response
    const serialized = {
      ...subscription,
      id: subscription.id.toString(),
      scheduleIds: subscription.scheduleIds.map(id => id.toString()),
      scheduleTime: subscription.scheduleTime ? subscription.scheduleTime.toISOString().split('T')[1]?.substring(0, 5) || null : null,
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
    };

    res.json({
      success: true,
      data: serialized,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[EmailSubscriptionRoute] Error creating subscription:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to create email subscription',
      details: errorMessage,
    });
  }
});

/**
 * PUT /api/email/subscriptions/:id
 * Update an email subscription
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const idParam = req.params['id'];
    if (!idParam) {
      res.status(400).json({
        success: false,
        error: 'Subscription ID is required',
      });
      return;
    }

    const id = BigInt(idParam);
    const {
      name,
      description,
      scheduleIds,
      locationFilter,
      emailRecipients,
      deliveryMode,
      scheduleTime,
      scheduleFrequency,
      scheduleDays,
      timezone,
      emailOnSuccess,
      emailOnFailure,
      summaryOnly,
      isActive,
    } = req.body;

    const params: any = {};
    if (name !== undefined) params.name = name;
    if (description !== undefined) params.description = description;
    if (scheduleIds !== undefined) {
      params.scheduleIds = scheduleIds.map((id: string) => BigInt(id));
    }
    if (locationFilter !== undefined) params.locationFilter = locationFilter;
    if (emailRecipients !== undefined) params.emailRecipients = emailRecipients;
    if (deliveryMode !== undefined) params.deliveryMode = deliveryMode;
    if (scheduleTime !== undefined) params.scheduleTime = scheduleTime;
    if (scheduleFrequency !== undefined) params.scheduleFrequency = scheduleFrequency;
    if (scheduleDays !== undefined) params.scheduleDays = scheduleDays;
    if (timezone !== undefined) params.timezone = timezone;
    if (emailOnSuccess !== undefined) params.emailOnSuccess = emailOnSuccess;
    if (emailOnFailure !== undefined) params.emailOnFailure = emailOnFailure;
    if (summaryOnly !== undefined) params.summaryOnly = summaryOnly;
    if (isActive !== undefined) params.isActive = isActive;

    const subscription = await emailSubscriptionService.updateSubscription(id, params);

    // Serialize response
    const serialized = {
      ...subscription,
      id: subscription.id.toString(),
      scheduleIds: subscription.scheduleIds.map(id => id.toString()),
      scheduleTime: subscription.scheduleTime ? subscription.scheduleTime.toISOString().split('T')[1]?.substring(0, 5) || null : null,
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
      lastSentAt: subscription.lastSentAt?.toISOString() || null,
    };

    res.json({
      success: true,
      data: serialized,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[EmailSubscriptionRoute] Error updating subscription:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to update email subscription',
      details: errorMessage,
    });
  }
});

/**
 * DELETE /api/email/subscriptions/:id
 * Delete an email subscription
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const idParam = req.params['id'];
    if (!idParam) {
      res.status(400).json({
        success: false,
        error: 'Subscription ID is required',
      });
      return;
    }

    const id = BigInt(idParam);
    await emailSubscriptionService.deleteSubscription(id);

    res.json({
      success: true,
      message: 'Email subscription deleted successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[EmailSubscriptionRoute] Error deleting subscription:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to delete email subscription',
      details: errorMessage,
    });
  }
});

/**
 * POST /api/email/subscriptions/:id/test
 * Send a test email for a subscription
 */
router.post('/:id/test', async (req: Request, res: Response): Promise<void> => {
  try {
    const idParam = req.params['id'];
    if (!idParam) {
      res.status(400).json({
        success: false,
        error: 'Subscription ID is required',
      });
      return;
    }

    const id = BigInt(idParam);
    const subscription = await emailSubscriptionService.getSubscriptionById(id);

    if (!subscription) {
      res.status(404).json({
        success: false,
        error: 'Subscription not found',
      });
      return;
    }

    // Generate test report for yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isoString = yesterday.toISOString();
    const dateString = isoString.split('T')[0];
    
    if (!dateString) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate test date',
      });
      return;
    }

    const { emailReportService } = await import('../services/email-report.service');
    const sent = await emailReportService.sendDailyReport(
      dateString,
      subscription.emailRecipients,
      subscription.locationFilter || undefined,
      subscription.scheduleIds.length > 0 ? subscription.scheduleIds : undefined
    );

    if (sent) {
      res.json({
        success: true,
        message: 'Test email sent successfully',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to send test email',
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[EmailSubscriptionRoute] Error sending test email:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to send test email',
      details: errorMessage,
    });
  }
});

export default router;

