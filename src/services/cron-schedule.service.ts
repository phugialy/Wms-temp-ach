import prisma from '../prisma/client';
import { logger } from '../utils/logger';
import * as cron from 'node-cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

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
    if (existing.isActive && (updateData.isActive === false || updateData.scheduleTime || updateData.frequency)) {
      await this.stopSchedule(id);
    }

    const schedule = await prisma.cronJobSchedule.update({
      where: { id },
      data: updateData,
    });

    // Start cron job if it's now active
    if (schedule.isActive && (!existing.isActive || updateData.scheduleTime || updateData.frequency)) {
      await this.startSchedule(id);
    }

    logger.info(`Updated cron schedule: ${schedule.name} (ID: ${schedule.id})`);
    return schedule;
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
        const dateTo = dayjs().tz(schedule.timezone);
        const dateFrom = dateTo.subtract(schedule.dateRangeDays, 'day');

        // Execute workflow
        const result = await workflowEngine.executeBulkAddWorkflow({
          stations: schedule.stations,
          dateFrom: dateFrom.format('YYYY-MM-DD'),
          dateTo: dateTo.format('YYYY-MM-DD'),
          location: schedule.location,
          triggerSource: 'scheduled-cron',
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

