import prisma from '../prisma/client';
import { logger } from '../utils/logger';
import * as cron from 'node-cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { emailReportService } from './email-report.service';
import { emailSubscriptionService } from './email-subscription.service';
import type { WorkflowExecutionResult } from './workflow-engine.service';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Cron Schedule Service
 * Manages cron job schedules and their execution
 */
export class CronScheduleService {
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Generate cron expression from schedule configuration
   */
  private generateCronExpression(
    scheduleTime: string,
    frequency: 'daily' | 'weekly',
    weeklyDays?: number[]
  ): string {
    const [hours, minutes] = scheduleTime.split(':').map(Number);
    
    if (frequency === 'daily') {
      // Daily: "0 2 * * *" (every day at 2:00 AM)
      return `${minutes} ${hours} * * *`;
    } else if (frequency === 'weekly' && weeklyDays && weeklyDays.length > 0) {
      // Weekly: "0 2 * * 1,2,3" (Monday, Tuesday, Wednesday at 2:00 AM)
      // node-cron uses 0-6 for Sunday-Saturday
      const days = weeklyDays.join(',');
      return `${minutes} ${hours} * * ${days}`;
    }
    
    throw new Error('Invalid schedule configuration');
  }

  /**
   * Calculate next run time
   */
  private calculateNextRun(
    scheduleTime: string,
    frequency: 'daily' | 'weekly',
    weeklyDays?: number[],
    timezone: string = 'UTC'
  ): Date {
    const timeParts = scheduleTime.split(':').map(Number);
    const hours = timeParts[0];
    const minutes = timeParts[1];
    
    if (hours === undefined || minutes === undefined || isNaN(hours) || isNaN(minutes)) {
      throw new Error(`Invalid schedule time format: ${scheduleTime}. Expected HH:mm format.`);
    }
    
    const now = dayjs().tz(timezone);
    
    if (frequency === 'daily') {
      let nextRun = now.hour(hours).minute(minutes).second(0).millisecond(0);
      if (nextRun.isBefore(now)) {
        nextRun = nextRun.add(1, 'day');
      }
      return nextRun.toDate();
    } else if (frequency === 'weekly' && weeklyDays && weeklyDays.length > 0) {
      // Find next matching day
      let nextRun = now.hour(hours).minute(minutes).second(0).millisecond(0);
      
      for (let i = 0; i < 7; i++) {
        const checkDate = nextRun.add(i, 'day');
        const dayOfWeek = checkDate.day(); // 0=Sunday, 6=Saturday
        if (weeklyDays.includes(dayOfWeek) && checkDate.isAfter(now)) {
          return checkDate.toDate();
        }
      }
      
      // If no match found in next 7 days, find first day in next week
      const firstDay = Math.min(...weeklyDays);
      nextRun = now.day(firstDay).hour(hours).minute(minutes).second(0).millisecond(0);
      if (nextRun.isBefore(now)) {
        nextRun = nextRun.add(1, 'week');
      }
      return nextRun.toDate();
    }
    
    throw new Error('Invalid schedule configuration');
  }

  /**
   * Get all schedules
   */
  async getAllSchedules() {
    return await prisma.cronJobSchedule.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get schedule by ID
   */
  async getScheduleById(id: bigint) {
    return await prisma.cronJobSchedule.findUnique({
      where: { id },
    });
  }

  /**
   * Create a new schedule
   */
  async createSchedule(data: {
    name: string;
    workflowType?: string;
    stations: string[];
    location: string;
    dateRangeDays: number;
    scheduleTime: string;
    timezone?: string;
    frequency: 'daily' | 'weekly';
    weeklyDays?: number[];
    description?: string;
  }) {
    const cronExpression = this.generateCronExpression(
      data.scheduleTime,
      data.frequency,
      data.weeklyDays
    );

    const nextRunAt = this.calculateNextRun(
      data.scheduleTime,
      data.frequency,
      data.weeklyDays,
      data.timezone
    );

    const schedule = await prisma.cronJobSchedule.create({
      data: {
        name: data.name,
        workflowType: data.workflowType || 'bulk-add',
        stations: data.stations,
        location: data.location,
        dateRangeDays: data.dateRangeDays,
        scheduleTime: data.scheduleTime,
        timezone: data.timezone || 'UTC',
        frequency: data.frequency,
        weeklyDays: data.weeklyDays || [],
        cronExpression,
        isActive: true,
        description: data.description,
        nextRunAt,
      },
    });

    // Start the cron job if active (non-blocking - don't fail the request if this fails)
    if (schedule.isActive) {
      this.startSchedule(schedule.id).catch((error) => {
        logger.error(`Failed to start cron job for schedule ${schedule.id}:`, error);
        // Don't throw - the schedule was created successfully, just log the error
      });
    }

    logger.info(`Created cron schedule: ${schedule.name} (ID: ${schedule.id})`);
    return schedule;
  }

  /**
   * Update a schedule
   */
  async updateSchedule(id: bigint, updateData: any) {
    const existing = await this.getScheduleById(id);
    if (!existing) {
      throw new Error('Schedule not found');
    }

    logger.info(`[CronScheduleService] Updating schedule ${id}`, {
      existingStations: existing.stations,
      updateDataStations: updateData.stations,
      updateDataKeys: Object.keys(updateData)
    });

    // Regenerate cron expression if schedule time or frequency changed
    if (updateData.scheduleTime || updateData.frequency || updateData.weeklyDays) {
      const scheduleTime = updateData.scheduleTime || existing.scheduleTime;
      const frequency = updateData.frequency || existing.frequency;
      const weeklyDays = updateData.weeklyDays !== undefined ? updateData.weeklyDays : existing.weeklyDays;
      
      updateData.cronExpression = this.generateCronExpression(scheduleTime, frequency, weeklyDays);
      updateData.nextRunAt = this.calculateNextRun(
        scheduleTime,
        frequency,
        weeklyDays,
        updateData.timezone || existing.timezone
      );
    }

    // Stop existing cron job if schedule changed or is being deactivated
    // Also stop if stations changed to ensure new stations are used
    if (existing.isActive && (
      updateData.isActive === false || 
      updateData.scheduleTime || 
      updateData.frequency ||
      (updateData.stations && JSON.stringify(updateData.stations) !== JSON.stringify(existing.stations))
    )) {
      logger.info(`[CronScheduleService] Stopping schedule ${id} due to configuration change`);
      await this.stopSchedule(id);
    }

    const schedule = await prisma.cronJobSchedule.update({
      where: { id },
      data: updateData,
    });

    logger.info(`[CronScheduleService] Schedule ${id} updated in database`, {
      name: schedule.name,
      stations: schedule.stations,
      stationsCount: schedule.stations.length
    });

    // Start cron job if it's now active
    // Restart if stations changed to ensure new stations are used
    if (schedule.isActive && (
      !existing.isActive || 
      updateData.scheduleTime || 
      updateData.frequency ||
      (updateData.stations && JSON.stringify(updateData.stations) !== JSON.stringify(existing.stations))
    )) {
      logger.info(`[CronScheduleService] Starting/restarting schedule ${id} with stations:`, schedule.stations);
      await this.startSchedule(id);
    }

    logger.info(`Updated cron schedule: ${schedule.name} (ID: ${schedule.id})`);
    return schedule;
  }

  /**
   * Send email report after execution
   */
  private async sendExecutionEmail(
    schedule: any,
    result: WorkflowExecutionResult,
    executionDate: string
  ): Promise<void> {
    try {
      // Check if email is enabled for this schedule
      const emailRecipients = schedule.emailRecipients || [];
      if (emailRecipients.length === 0) {
        logger.debug(`[CronSchedule] No email recipients configured for schedule ${schedule.name}`);
        return;
      }

      // Check if we should send email based on success/failure settings
      const shouldSendOnSuccess = schedule.emailOnSuccess !== false; // Default to true
      const shouldSendOnFailure = schedule.emailOnFailure !== false; // Default to true

      if (result.success && !shouldSendOnSuccess) {
        logger.debug(`[CronSchedule] Email on success disabled for schedule ${schedule.name}`);
        return;
      }

      if (!result.success && !shouldSendOnFailure) {
        logger.debug(`[CronSchedule] Email on failure disabled for schedule ${schedule.name}`);
        return;
      }

      logger.info(`[CronSchedule] Sending email report for schedule ${schedule.name}`, {
        recipients: emailRecipients,
        success: result.success,
      });

      // Generate and send daily report for the execution date
      const emailSent = await emailReportService.sendDailyReport(
        executionDate,
        emailRecipients,
        schedule.location
      );

      if (emailSent) {
        logger.info(`[CronSchedule] Email report sent successfully for schedule ${schedule.name}`);
      } else {
        logger.warn(`[CronSchedule] Failed to send email report for schedule ${schedule.name}`);
      }
    } catch (error) {
      // Don't fail the cron job if email sending fails
      logger.error(`[CronSchedule] Error sending email report for schedule ${schedule.name}:`, error);
    }
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(id: bigint) {
    // Stop cron job if running
    await this.stopSchedule(id);

    await prisma.cronJobSchedule.delete({
      where: { id },
    });

    logger.info(`Deleted cron schedule (ID: ${id})`);
  }

  /**
   * Start a cron schedule (register with node-cron)
   */
  async startSchedule(id: bigint) {
    const schedule = await this.getScheduleById(id);
    if (!schedule || !schedule.cronExpression) {
      throw new Error('Schedule not found or invalid cron expression');
    }

    // Stop existing job if any
    await this.stopSchedule(id);

    // Import workflow service dynamically to avoid circular dependency
    const { WorkflowEngineService } = await import('./workflow-engine.service');
    const { PhonecheckService } = await import('./phonecheck.service');
    const phonecheckService = new PhonecheckService();
    const workflowEngine = new WorkflowEngineService(phonecheckService);

    const job = cron.schedule(schedule.cronExpression, async () => {
      try {
        logger.info(`[CronSchedule] Executing scheduled job: ${schedule.name} (ID: ${schedule.id})`);
        
        // Calculate date range based on dateRangeDays
        // Phonecheck API requires same date for from/to
        // Start time: 00:00:00 (or 01:00:00 for past dates)
        // End time: schedule.scheduleTime (the time when this cron job runs, e.g., 19:01)
        const now = dayjs().tz(schedule.timezone);
        
        let targetDate: dayjs.Dayjs;
        let startTime: string;
        
        if (schedule.dateRangeDays === 0) {
          // Process today: from 00:00 to schedule time
          targetDate = now;
          startTime = '00:00:00';
        } else {
          // Process past date: from 01:00 to schedule time (but on the target date)
          targetDate = now.subtract(schedule.dateRangeDays, 'day');
          startTime = '01:00:00';
        }
        
        // Both dates are the same calendar date (Phonecheck API requirement)
        // CRITICAL: Each cron job execution processes exactly ONE day
        // Start: 00:00:00 (or 01:00:00 for past dates)
        // End: schedule.scheduleTime (e.g., 19:01 when the job runs)
        const dateString = targetDate.format('YYYY-MM-DD');
        const endTime = schedule.scheduleTime; // HH:mm format (e.g., "19:01")
        
        logger.info(`[CronSchedule] Date range calculated: ${dateString} ${startTime} to ${dateString} ${endTime}`, {
          dateRangeDays: schedule.dateRangeDays,
          targetDate: dateString,
          startTime,
          endTime: endTime,
          scheduleTime: schedule.scheduleTime,
          note: 'Single day processing - dateFrom === dateTo, end time = schedule run time'
        });

        // CRITICAL: Re-fetch schedule from database to ensure we have the latest stations
        // This prevents using stale data if the schedule was updated after the cron job was created
        const currentSchedule = await this.getScheduleById(schedule.id);
        if (!currentSchedule) {
          logger.error(`[CronSchedule] Schedule ${schedule.id} not found in database, skipping execution`);
          return;
        }

        // Execute workflow with schedule ID for proper indexing and tracking
        // This ensures the execution is linked to this schedule in the database
        logger.info(`[CronSchedule] Executing workflow with scheduleId: ${currentSchedule.id}`, {
          scheduleId: currentSchedule.id.toString(),
          scheduleName: currentSchedule.name,
          stations: currentSchedule.stations,
          stationsCount: currentSchedule.stations.length,
          location: currentSchedule.location,
          dateRange: dateString,
        });
        
        // Verify stations array is valid
        if (!Array.isArray(currentSchedule.stations) || currentSchedule.stations.length === 0) {
          logger.error(`[CronSchedule] Invalid stations array for schedule ${currentSchedule.id}:`, currentSchedule.stations);
          throw new Error(`Invalid stations configuration for schedule ${currentSchedule.name}`);
        }
        
        const result = await workflowEngine.executeBulkAddWorkflow({
          stations: currentSchedule.stations, // Use fresh data from database
          dateFrom: dateString, // Same date for both
          dateTo: dateString,   // Same date for both (Phonecheck API requirement)
          location: currentSchedule.location,
          triggerSource: 'scheduled-cron',
          scheduleId: currentSchedule.id, // CRITICAL: Link execution to schedule for proper indexing
          runTime: endTime, // Pass the schedule time as end time (e.g., "19:01")
        });

        // Update schedule stats
        await prisma.cronJobSchedule.update({
          where: { id: schedule.id },
          data: {
            lastRunAt: new Date(),
            nextRunAt: this.calculateNextRun(
              schedule.scheduleTime,
              schedule.frequency as 'daily' | 'weekly',
              schedule.weeklyDays,
              schedule.timezone
            ),
            totalRuns: { increment: 1 },
            successfulRuns: result.success ? { increment: 1 } : undefined,
            failedRuns: result.success ? undefined : { increment: 1 },
          },
        });

        logger.info(`[CronSchedule] Completed scheduled job: ${schedule.name} - ${result.success ? 'Success' : 'Failed'}`);

        // Send email reports (both per-schedule and subscription-based)
        // 1. Per-schedule email (backward compatibility)
        await this.sendExecutionEmail(currentSchedule, result, dateString);
        
        // 2. Subscription-based emails (new system)
        await emailSubscriptionService.handleImmediateEmail(
          {
            id: result.executionId,
            scheduleId: currentSchedule.id,
            status: result.status,
            completedAt: new Date(),
            location: currentSchedule.location,
          },
          result
        );
      } catch (error) {
        logger.error(`[CronSchedule] Error executing scheduled job: ${schedule.name}`, error);
        
        // Update failed runs
        await prisma.cronJobSchedule.update({
          where: { id: schedule.id },
          data: {
            lastRunAt: new Date(),
            totalRuns: { increment: 1 },
            failedRuns: { increment: 1 },
          },
        });
      }
    }, {
      timezone: schedule.timezone,
    });

    this.cronJobs.set(id.toString(), job);
    logger.info(`[CronSchedule] Started cron job for schedule: ${schedule.name} (ID: ${schedule.id})`);
  }

  /**
   * Manually trigger/run a schedule immediately
   */
  async triggerSchedule(id: bigint): Promise<{ success: boolean; executionId?: bigint; error?: string }> {
    try {
      const schedule = await this.getScheduleById(id);
      if (!schedule) {
        return { success: false, error: 'Schedule not found' };
      }

      logger.info(`[CronSchedule] Manually triggering schedule: ${schedule.name} (ID: ${schedule.id})`);

      // Import workflow service dynamically to avoid circular dependency
      const { WorkflowEngineService } = await import('./workflow-engine.service');
      const { PhonecheckService } = await import('./phonecheck.service');
      const phonecheckService = new PhonecheckService();
      const workflowEngine = new WorkflowEngineService(phonecheckService);

      // Calculate date range based on dateRangeDays (same logic as scheduled execution)
      // For manual trigger of a schedule, use the schedule's run time as end time
      const now = dayjs().tz(schedule.timezone);
      
      let targetDate: dayjs.Dayjs;
      let startTime: string;
      
      if (schedule.dateRangeDays === 0) {
        targetDate = now;
        startTime = '00:00:00';
      } else {
        targetDate = now.subtract(schedule.dateRangeDays, 'day');
        startTime = '01:00:00';
      }
      
      const dateString = targetDate.format('YYYY-MM-DD');
      const endTime = schedule.scheduleTime; // Use schedule's run time as end time (e.g., "19:01")

      logger.info(`[CronSchedule] Manual trigger - Date range: ${dateString} ${startTime} to ${dateString} ${endTime}`, {
        scheduleId: schedule.id.toString(),
        scheduleName: schedule.name,
        stations: schedule.stations,
        location: schedule.location,
        dateRange: dateString,
        scheduleTime: endTime,
      });

      // Verify stations array is valid
      if (!Array.isArray(schedule.stations) || schedule.stations.length === 0) {
        logger.error(`[CronSchedule] Invalid stations array for schedule ${schedule.id}:`, schedule.stations);
        return { success: false, error: `Invalid stations configuration for schedule ${schedule.name}` };
      }

      // Execute workflow
      const result = await workflowEngine.executeBulkAddWorkflow({
        stations: schedule.stations,
        dateFrom: dateString,
        dateTo: dateString,
        location: schedule.location,
        triggerSource: 'manual-trigger',
        scheduleId: schedule.id,
        runTime: endTime, // Pass the schedule time as end time (e.g., "19:01")
      });

      // Update schedule stats
      await prisma.cronJobSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: new Date(),
          nextRunAt: this.calculateNextRun(
            schedule.scheduleTime,
            schedule.frequency as 'daily' | 'weekly',
            schedule.weeklyDays,
            schedule.timezone
          ),
          totalRuns: { increment: 1 },
          successfulRuns: result.success ? { increment: 1 } : undefined,
          failedRuns: result.success ? undefined : { increment: 1 },
        },
      });

      logger.info(`[CronSchedule] Manual trigger completed: ${schedule.name} - ${result.success ? 'Success' : 'Failed'}`);

      // Send email reports
      await this.sendExecutionEmail(schedule, result, dateString);
      
      const { emailSubscriptionService } = await import('./email-subscription.service');
      await emailSubscriptionService.handleImmediateEmail(
        {
          id: result.executionId,
          scheduleId: schedule.id,
          status: result.status,
          completedAt: new Date(),
          location: schedule.location,
        },
        result
      );

      return { success: result.success, executionId: result.executionId };
    } catch (error) {
      logger.error(`[CronSchedule] Error manually triggering schedule ${id}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Update failed runs
      try {
        await prisma.cronJobSchedule.update({
          where: { id },
          data: {
            lastRunAt: new Date(),
            totalRuns: { increment: 1 },
            failedRuns: { increment: 1 },
          },
        });
      } catch (updateError) {
        logger.error(`[CronSchedule] Error updating schedule stats after failure:`, updateError);
      }
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Manually trigger all active schedules
   */
  async triggerAllSchedules(): Promise<{ 
    total: number; 
    successful: number; 
    failed: number; 
    results: Array<{ scheduleId: string; scheduleName: string; success: boolean; error?: string }> 
  }> {
    try {
      const schedules = await this.getAllSchedules();
      const activeSchedules = schedules.filter(s => s.isActive);

      logger.info(`[CronSchedule] Manually triggering all schedules: ${activeSchedules.length} active schedules`);

      const results: Array<{ scheduleId: string; scheduleName: string; success: boolean; error?: string }> = [];
      let successful = 0;
      let failed = 0;

      // Trigger all schedules sequentially to avoid overwhelming the system
      for (const schedule of activeSchedules) {
        try {
          const result = await this.triggerSchedule(schedule.id);
          results.push({
            scheduleId: schedule.id.toString(),
            scheduleName: schedule.name,
            success: result.success,
            error: result.error,
          });
          
          if (result.success) {
            successful++;
          } else {
            failed++;
          }

          // Small delay between triggers to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          logger.error(`[CronSchedule] Error triggering schedule ${schedule.id}:`, errorMessage);
          results.push({
            scheduleId: schedule.id.toString(),
            scheduleName: schedule.name,
            success: false,
            error: errorMessage,
          });
          failed++;
        }
      }

      logger.info(`[CronSchedule] Manual trigger all completed: ${successful} successful, ${failed} failed out of ${activeSchedules.length} total`);

      return {
        total: activeSchedules.length,
        successful,
        failed,
        results,
      };
    } catch (error) {
      logger.error('[CronSchedule] Error triggering all schedules:', error);
      throw error;
    }
  }

  /**
   * Stop a cron schedule
   */
  async stopSchedule(id: bigint) {
    const job = this.cronJobs.get(id.toString());
    if (job) {
      job.stop();
      this.cronJobs.delete(id.toString());
      logger.info(`[CronSchedule] Stopped cron job for schedule ID: ${id}`);
    }
  }

  /**
   * Initialize all active schedules on server start
   */
  async initializeAllSchedules() {
    const activeSchedules = await prisma.cronJobSchedule.findMany({
      where: { isActive: true },
    });

    logger.info(`[CronSchedule] Initializing ${activeSchedules.length} active schedules`);
    
    for (const schedule of activeSchedules) {
      try {
        await this.startSchedule(schedule.id);
      } catch (error) {
        logger.error(`[CronSchedule] Failed to initialize schedule: ${schedule.name}`, error);
      }
    }
  }
}

