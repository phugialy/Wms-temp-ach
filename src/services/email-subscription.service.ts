import { logger } from '../utils/logger';
import prisma from '../prisma/client';
import dayjs from 'dayjs';
import { emailReportService } from './email-report.service';
import type { WorkflowExecutionResult } from './workflow-engine.service';

export interface CreateEmailSubscriptionParams {
  name: string;
  description?: string;
  scheduleIds?: bigint[]; // Empty array = all schedules
  locationFilter?: string;
  emailRecipients: string[];
  deliveryMode: 'immediate' | 'scheduled';
  scheduleTime?: string; // HH:mm format
  scheduleFrequency?: 'daily' | 'weekly' | 'monthly';
  scheduleDays?: number[]; // For weekly: [1,2,3] = Mon, Tue, Wed
  timezone?: string;
  emailOnSuccess?: boolean;
  emailOnFailure?: boolean;
  summaryOnly?: boolean;
  createdBy?: string;
}

export interface UpdateEmailSubscriptionParams extends Partial<CreateEmailSubscriptionParams> {
  isActive?: boolean;
}

export class EmailSubscriptionService {
  /**
   * Create a new email subscription
   */
  async createSubscription(params: CreateEmailSubscriptionParams) {
    logger.info('[EmailSubscriptionService] Creating email subscription', {
      name: params.name,
      deliveryMode: params.deliveryMode,
      recipientCount: params.emailRecipients.length,
    });

    // Validate email recipients
    if (!params.emailRecipients || params.emailRecipients.length === 0) {
      throw new Error('At least one email recipient is required');
    }

    // Validate scheduled mode requirements
    if (params.deliveryMode === 'scheduled') {
      if (!params.scheduleTime) {
        throw new Error('scheduleTime is required for scheduled delivery mode');
      }
      if (!params.scheduleFrequency) {
        throw new Error('scheduleFrequency is required for scheduled delivery mode');
      }
    }

    const subscription = await prisma.emailReportSubscription.create({
      data: {
        name: params.name,
        description: params.description,
        scheduleIds: params.scheduleIds || [],
        locationFilter: params.locationFilter,
        emailRecipients: params.emailRecipients,
        deliveryMode: params.deliveryMode,
        scheduleTime: params.scheduleTime ? this.parseTimeToDate(params.scheduleTime) : null,
        scheduleFrequency: params.scheduleFrequency,
        scheduleDays: params.scheduleDays || [],
        timezone: params.timezone || 'UTC',
        emailOnSuccess: params.emailOnSuccess !== false,
        emailOnFailure: params.emailOnFailure !== false,
        summaryOnly: params.summaryOnly || false,
        createdBy: params.createdBy,
      },
    });

    logger.info(`[EmailSubscriptionService] Created subscription: ${subscription.name} (ID: ${subscription.id})`);
    return subscription;
  }

  /**
   * Update an email subscription
   */
  async updateSubscription(id: bigint, params: UpdateEmailSubscriptionParams) {
    const existing = await this.getSubscriptionById(id);
    if (!existing) {
      throw new Error('Subscription not found');
    }

    logger.info(`[EmailSubscriptionService] Updating subscription ${id}`, params);

    const updateData: any = {};
    if (params.name !== undefined) updateData.name = params.name;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.scheduleIds !== undefined) updateData.scheduleIds = params.scheduleIds;
    if (params.locationFilter !== undefined) updateData.locationFilter = params.locationFilter;
    if (params.emailRecipients !== undefined) {
      if (params.emailRecipients.length === 0) {
        throw new Error('At least one email recipient is required');
      }
      updateData.emailRecipients = params.emailRecipients;
    }
    if (params.deliveryMode !== undefined) updateData.deliveryMode = params.deliveryMode;
    if (params.scheduleTime !== undefined) {
      updateData.scheduleTime = params.scheduleTime ? this.parseTimeToDate(params.scheduleTime) : null;
    }
    if (params.scheduleFrequency !== undefined) updateData.scheduleFrequency = params.scheduleFrequency;
    if (params.scheduleDays !== undefined) updateData.scheduleDays = params.scheduleDays;
    if (params.timezone !== undefined) updateData.timezone = params.timezone;
    if (params.emailOnSuccess !== undefined) updateData.emailOnSuccess = params.emailOnSuccess;
    if (params.emailOnFailure !== undefined) updateData.emailOnFailure = params.emailOnFailure;
    if (params.summaryOnly !== undefined) updateData.summaryOnly = params.summaryOnly;
    if (params.isActive !== undefined) updateData.isActive = params.isActive;

    const subscription = await prisma.emailReportSubscription.update({
      where: { id },
      data: updateData,
    });

    logger.info(`[EmailSubscriptionService] Updated subscription: ${subscription.name} (ID: ${subscription.id})`);
    return subscription;
  }

  /**
   * Get subscription by ID
   */
  async getSubscriptionById(id: bigint) {
    return await prisma.emailReportSubscription.findUnique({
      where: { id },
    });
  }

  /**
   * Get all subscriptions
   */
  async getAllSubscriptions(activeOnly: boolean = false) {
    const where = activeOnly ? { isActive: true } : {};
    return await prisma.emailReportSubscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete a subscription
   */
  async deleteSubscription(id: bigint) {
    const subscription = await this.getSubscriptionById(id);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    await prisma.emailReportSubscription.delete({
      where: { id },
    });

    logger.info(`[EmailSubscriptionService] Deleted subscription: ${subscription.name} (ID: ${id})`);
  }

  /**
   * Handle immediate email delivery after execution
   */
  async handleImmediateEmail(
    execution: {
      id: bigint;
      scheduleId: bigint | null;
      status: string;
      completedAt: Date | null;
      location: string | null;
    },
    result: WorkflowExecutionResult
  ): Promise<void> {
    try {
      // Find all active subscriptions with immediate delivery
      const subscriptions = await prisma.emailReportSubscription.findMany({
        where: {
          isActive: true,
          deliveryMode: 'immediate',
        },
      });

      if (subscriptions.length === 0) {
        logger.debug('[EmailSubscriptionService] No active immediate subscriptions found');
        return;
      }

      logger.info(`[EmailSubscriptionService] Checking ${subscriptions.length} immediate subscriptions`);

      for (const subscription of subscriptions) {
        // Check if this execution matches the subscription
        if (!this.matchesSubscription(execution, subscription)) {
          continue;
        }

        // Check email preferences
        if (result.success && !subscription.emailOnSuccess) {
          logger.debug(`[EmailSubscriptionService] Skipping subscription ${subscription.id} - emailOnSuccess disabled`);
          continue;
        }

        if (!result.success && !subscription.emailOnFailure) {
          logger.debug(`[EmailSubscriptionService] Skipping subscription ${subscription.id} - emailOnFailure disabled`);
          continue;
        }

        logger.info(`[EmailSubscriptionService] Sending immediate email for subscription: ${subscription.name}`, {
          subscriptionId: subscription.id.toString(),
          executionId: execution.id.toString(),
          recipients: subscription.emailRecipients,
        });

        // Generate and send report
        if (subscription.summaryOnly) {
          // Generate summary report (aggregated)
          const executionDate = execution.completedAt 
            ? dayjs(execution.completedAt).format('YYYY-MM-DD')
            : dayjs().format('YYYY-MM-DD');
          
          await emailReportService.sendDailyReport(
            executionDate,
            subscription.emailRecipients,
            subscription.locationFilter || execution.location || undefined,
            subscription.scheduleIds.length > 0 ? subscription.scheduleIds : undefined
          );
        } else {
          // Generate single execution report
          const executionDate = execution.completedAt 
            ? dayjs(execution.completedAt).format('YYYY-MM-DD')
            : dayjs().format('YYYY-MM-DD');
          
          // For immediate, we'll send a single execution report
          // This could be enhanced to generate a single-execution report
          await emailReportService.sendDailyReport(
            executionDate,
            subscription.emailRecipients,
            subscription.locationFilter || execution.location || undefined,
            subscription.scheduleIds.length > 0 ? subscription.scheduleIds : undefined
          );
        }

        // Update last sent timestamp
        await prisma.emailReportSubscription.update({
          where: { id: subscription.id },
          data: { lastSentAt: new Date() },
        });
      }
    } catch (error) {
      logger.error('[EmailSubscriptionService] Error handling immediate email:', error);
      // Don't throw - we don't want to fail the execution if email fails
    }
  }

  /**
   * Check if execution matches subscription criteria
   */
  private matchesSubscription(
    execution: {
      scheduleId: bigint | null;
      location: string | null;
    },
    subscription: {
      scheduleIds: bigint[];
      locationFilter: string | null;
    }
  ): boolean {
    // Check schedule IDs
    if (subscription.scheduleIds.length > 0) {
      // If subscription has specific schedules, execution must match
      if (!execution.scheduleId || !subscription.scheduleIds.includes(execution.scheduleId)) {
        return false;
      }
    }
    // If scheduleIds is empty, it means "all schedules" - so it matches

    // Check location filter
    if (subscription.locationFilter && execution.location !== subscription.locationFilter) {
      return false;
    }

    return true;
  }

  /**
   * Handle scheduled email delivery (called by cron job)
   */
  async handleScheduledEmails(): Promise<void> {
    try {
      const now = dayjs();
      const currentTime = now.format('HH:mm');
      const currentDayOfWeek = now.day(); // 0 = Sunday, 1 = Monday, etc.

      logger.info('[EmailSubscriptionService] Processing scheduled email subscriptions', {
        currentTime,
        currentDayOfWeek,
      });

      // Find all active scheduled subscriptions
      const subscriptions = await prisma.emailReportSubscription.findMany({
        where: {
          isActive: true,
          deliveryMode: 'scheduled',
        },
      });

      if (subscriptions.length === 0) {
        logger.debug('[EmailSubscriptionService] No active scheduled subscriptions found');
        return;
      }

      for (const subscription of subscriptions) {
        if (!subscription.scheduleTime || !subscription.scheduleFrequency) {
          logger.warn(`[EmailSubscriptionService] Subscription ${subscription.id} missing scheduleTime or scheduleFrequency`);
          continue;
        }

        // Check if it's time to send
        const subscriptionTime = dayjs(subscription.scheduleTime).format('HH:mm');
        const shouldSend = this.shouldSendNow(subscription, currentTime, currentDayOfWeek);

        if (!shouldSend) {
          continue;
        }

        logger.info(`[EmailSubscriptionService] Processing scheduled subscription: ${subscription.name}`, {
          subscriptionId: subscription.id.toString(),
          scheduleTime: subscriptionTime,
          frequency: subscription.scheduleFrequency,
        });

        // Calculate date range based on frequency
        const dateRange = this.calculateDateRange(subscription.scheduleFrequency);
        
        // Get executions for the period
        const executions = await this.getExecutionsForPeriod(
          subscription,
          dateRange.from,
          dateRange.to
        );

        if (executions.length === 0) {
          logger.info(`[EmailSubscriptionService] No executions found for subscription ${subscription.id} in period`, {
            from: dateRange.from,
            to: dateRange.to,
          });
          continue;
        }

        // Generate and send aggregated report
        const reportDate = dateRange.to; // Use end date for report
        await emailReportService.sendDailyReport(
          reportDate,
          subscription.emailRecipients,
          subscription.locationFilter || undefined,
          subscription.scheduleIds.length > 0 ? subscription.scheduleIds : undefined
        );

        // Update last sent timestamp
        await prisma.emailReportSubscription.update({
          where: { id: subscription.id },
          data: { lastSentAt: new Date() },
        });

        logger.info(`[EmailSubscriptionService] Sent scheduled email for subscription: ${subscription.name}`);
      }
    } catch (error) {
      logger.error('[EmailSubscriptionService] Error handling scheduled emails:', error);
    }
  }

  /**
   * Check if subscription should send email now
   */
  private shouldSendNow(
    subscription: {
      scheduleTime: Date | null;
      scheduleFrequency: string | null;
      scheduleDays: number[];
    },
    currentTime: string,
    currentDayOfWeek: number
  ): boolean {
    if (!subscription.scheduleTime || !subscription.scheduleFrequency) {
      return false;
    }

    const subscriptionTime = dayjs(subscription.scheduleTime).format('HH:mm');
    
    // Check time matches (within 5 minute window to account for cron timing)
    const timeMatch = Math.abs(
      dayjs(`2000-01-01 ${currentTime}`).diff(dayjs(`2000-01-01 ${subscriptionTime}`), 'minute')
    ) <= 5;

    if (!timeMatch) {
      return false;
    }

    // Check frequency and day
    switch (subscription.scheduleFrequency) {
      case 'daily':
        return true;
      
      case 'weekly':
        // Check if current day is in scheduleDays
        if (subscription.scheduleDays.length === 0) {
          return true; // No day restriction
        }
        return subscription.scheduleDays.includes(currentDayOfWeek);
      
      case 'monthly':
        // Send on first day of month at scheduled time
        return dayjs().date() === 1;
      
      default:
        return false;
    }
  }

  /**
   * Calculate date range for scheduled reports
   */
  private calculateDateRange(frequency: string): { from: string; to: string } {
    const now = dayjs();
    
    switch (frequency) {
      case 'daily':
        // Yesterday to today
        return {
          from: now.subtract(1, 'day').format('YYYY-MM-DD'),
          to: now.format('YYYY-MM-DD'),
        };
      
      case 'weekly':
        // Last 7 days
        return {
          from: now.subtract(7, 'day').format('YYYY-MM-DD'),
          to: now.format('YYYY-MM-DD'),
        };
      
      case 'monthly':
        // Last 30 days
        return {
          from: now.subtract(30, 'day').format('YYYY-MM-DD'),
          to: now.format('YYYY-MM-DD'),
        };
      
      default:
        // Default to daily
        return {
          from: now.subtract(1, 'day').format('YYYY-MM-DD'),
          to: now.format('YYYY-MM-DD'),
        };
    }
  }

  /**
   * Get executions for a period matching subscription criteria
   */
  private async getExecutionsForPeriod(
    subscription: {
      scheduleIds: bigint[];
      locationFilter: string | null;
    },
    dateFrom: string,
    dateTo: string
  ) {
    const whereClause: any = {
      completedAt: {
        gte: dayjs(dateFrom).startOf('day').toDate(),
        lte: dayjs(dateTo).endOf('day').toDate(),
      },
      status: {
        in: ['completed', 'failed'],
      },
    };

    // Filter by schedule IDs if specified
    if (subscription.scheduleIds.length > 0) {
      whereClause.scheduleId = {
        in: subscription.scheduleIds,
      };
    }

    // Filter by location if specified
    if (subscription.locationFilter) {
      whereClause.location = subscription.locationFilter;
    }

    return await prisma.cronJobExecution.findMany({
      where: whereClause,
      orderBy: {
        completedAt: 'desc',
      },
    });
  }

  /**
   * Parse time string (HH:mm) to Date object
   */
  private parseTimeToDate(timeString: string): Date {
    const parts = timeString.split(':');
    const hours = parts[0] ? parseInt(parts[0], 10) : 0;
    const minutes = parts[1] ? parseInt(parts[1], 10) : 0;
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }
}

export const emailSubscriptionService = new EmailSubscriptionService();

