import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import prisma from '../prisma/client';
import { CronScheduleService } from '../services/cron-schedule.service';

const router = Router();
const cronScheduleService = new CronScheduleService();

/**
 * GET /api/workflows/schedules
 * Get all cron job schedules
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('[CronScheduleRoute] GET /schedules - Request received');
    const schedules = await cronScheduleService.getAllSchedules();
    console.log(`[CronScheduleRoute] Returning ${schedules.length} schedules`);

    // Serialize BigInt IDs and ensure all fields are properly serialized
    const serializedSchedules = schedules.map((schedule: any) => ({
      id: schedule.id.toString(),
      name: schedule.name,
      workflowType: schedule.workflowType,
      stations: schedule.stations,
      location: schedule.location,
      dateRangeDays: schedule.dateRangeDays,
      scheduleTime: schedule.scheduleTime,
      timezone: schedule.timezone,
      frequency: schedule.frequency,
      weeklyDays: schedule.weeklyDays || [],
      cronExpression: schedule.cronExpression || null,
      isActive: schedule.isActive,
      description: schedule.description || null,
      lastRunAt: schedule.lastRunAt?.toISOString() || null,
      nextRunAt: schedule.nextRunAt?.toISOString() || null,
      totalRuns: schedule.totalRuns,
      successfulRuns: schedule.successfulRuns,
      failedRuns: schedule.failedRuns,
      createdAt: schedule.createdAt.toISOString(),
      updatedAt: schedule.updatedAt.toISOString(),
      createdBy: schedule.createdBy || null,
    }));

    res.json({
      success: true,
      data: serializedSchedules,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[CronScheduleRoute] Error getting schedules:', errorMessage);
    logger.error('Error getting cron schedules', { error: errorMessage });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get cron schedules',
      details: errorMessage,
    });
  }
});

/**
 * POST /api/workflows/schedules
 * Create a new cron job schedule
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('[CronScheduleRoute] POST /schedules - Request received');
    console.log('[CronScheduleRoute] Request body:', JSON.stringify(req.body, null, 2));

    const {
      name,
      workflowType = 'bulk-add',
      stations,
      location,
      dateRangeDays = 1,
      scheduleTime,
      timezone = 'UTC',
      frequency,
      weeklyDays,
      description,
    } = req.body;

    // Validation
    if (!name || !stations || !location || !scheduleTime || !frequency) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: name, stations, location, scheduleTime, frequency',
      });
      return;
    }

    if (frequency === 'weekly' && (!weeklyDays || weeklyDays.length === 0)) {
      res.status(400).json({
        success: false,
        error: 'weeklyDays is required when frequency is weekly',
      });
      return;
    }

    const schedule = await cronScheduleService.createSchedule({
      name,
      workflowType,
      stations,
      location,
      dateRangeDays,
      scheduleTime,
      timezone,
      frequency,
      weeklyDays: frequency === 'weekly' ? weeklyDays : [],
      description,
    });

    console.log('[CronScheduleRoute] Schedule created:', schedule.id.toString());

    // Serialize the response properly
    const responseData = {
      id: schedule.id.toString(),
      name: schedule.name,
      workflowType: schedule.workflowType,
      stations: schedule.stations,
      location: schedule.location,
      dateRangeDays: schedule.dateRangeDays,
      scheduleTime: schedule.scheduleTime,
      timezone: schedule.timezone,
      frequency: schedule.frequency,
      weeklyDays: schedule.weeklyDays,
      cronExpression: schedule.cronExpression,
      isActive: schedule.isActive,
      description: schedule.description,
      lastRunAt: schedule.lastRunAt?.toISOString() || null,
      nextRunAt: schedule.nextRunAt?.toISOString() || null,
      totalRuns: schedule.totalRuns,
      successfulRuns: schedule.successfulRuns,
      failedRuns: schedule.failedRuns,
      createdAt: schedule.createdAt.toISOString(),
      updatedAt: schedule.updatedAt.toISOString(),
      createdBy: schedule.createdBy || null,
    };

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[CronScheduleRoute] Error creating schedule:', errorMessage);
    logger.error('Error creating cron schedule', { error: errorMessage });
    
    res.status(500).json({
      success: false,
      error: 'Failed to create cron schedule',
      details: errorMessage,
    });
  }
});

/**
 * PUT /api/workflows/schedules/:id
 * Update a cron job schedule
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const idParam = req.params['id'];
    if (!idParam) {
      res.status(400).json({
        success: false,
        error: 'Schedule ID is required',
      });
      return;
    }
    const id = BigInt(idParam);
    console.log(`[CronScheduleRoute] PUT /schedules/${id} - Request received`);
    console.log(`[CronScheduleRoute] Request body:`, JSON.stringify(req.body, null, 2));

    const updateData: any = {};
    if (req.body.name !== undefined) updateData.name = req.body.name;
    // CRITICAL: Always update stations if provided - this ensures unselected stations are removed
    if (req.body.stations !== undefined) {
      // Ensure stations is always an array, even if empty (though validation should prevent empty)
      updateData.stations = Array.isArray(req.body.stations) ? req.body.stations : [];
      console.log(`[CronScheduleRoute] Updating stations:`, updateData.stations);
    } else {
      console.warn(`[CronScheduleRoute] WARNING: stations not provided in update request - will not update stations field`);
    }
    if (req.body.location !== undefined) updateData.location = req.body.location;
    if (req.body.dateRangeDays !== undefined) updateData.dateRangeDays = req.body.dateRangeDays;
    if (req.body.scheduleTime !== undefined) updateData.scheduleTime = req.body.scheduleTime;
    if (req.body.timezone !== undefined) updateData.timezone = req.body.timezone;
    if (req.body.frequency !== undefined) updateData.frequency = req.body.frequency;
    if (req.body.weeklyDays !== undefined) updateData.weeklyDays = req.body.weeklyDays;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;

    console.log(`[CronScheduleRoute] Update data to be applied:`, JSON.stringify(updateData, null, 2));
    const schedule = await cronScheduleService.updateSchedule(id, updateData);
    console.log(`[CronScheduleRoute] Schedule updated successfully. New stations:`, schedule.stations);

    // Serialize the response properly
    const responseData = {
      id: schedule.id.toString(),
      name: schedule.name,
      workflowType: schedule.workflowType,
      stations: schedule.stations,
      location: schedule.location,
      dateRangeDays: schedule.dateRangeDays,
      scheduleTime: schedule.scheduleTime,
      timezone: schedule.timezone,
      frequency: schedule.frequency,
      weeklyDays: schedule.weeklyDays,
      cronExpression: schedule.cronExpression,
      isActive: schedule.isActive,
      description: schedule.description,
      lastRunAt: schedule.lastRunAt?.toISOString() || null,
      nextRunAt: schedule.nextRunAt?.toISOString() || null,
      totalRuns: schedule.totalRuns,
      successfulRuns: schedule.successfulRuns,
      failedRuns: schedule.failedRuns,
      createdAt: schedule.createdAt.toISOString(),
      updatedAt: schedule.updatedAt.toISOString(),
      createdBy: schedule.createdBy || null,
    };

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[CronScheduleRoute] Error updating schedule:', errorMessage);
    logger.error('Error updating cron schedule', { error: errorMessage });
    
    res.status(500).json({
      success: false,
      error: 'Failed to update cron schedule',
      details: errorMessage,
    });
  }
});

/**
 * DELETE /api/workflows/schedules/:id
 * Delete a cron job schedule
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const idParam = req.params['id'];
    if (!idParam) {
      res.status(400).json({
        success: false,
        error: 'Schedule ID is required',
      });
      return;
    }
    const id = BigInt(idParam);
    console.log(`[CronScheduleRoute] DELETE /schedules/${id} - Request received`);

    await cronScheduleService.deleteSchedule(id);

    res.json({
      success: true,
      message: 'Cron schedule deleted successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[CronScheduleRoute] Error deleting schedule:', errorMessage);
    logger.error('Error deleting cron schedule', { error: errorMessage });
    
    res.status(500).json({
      success: false,
      error: 'Failed to delete cron schedule',
      details: errorMessage,
    });
  }
});

export default router;

