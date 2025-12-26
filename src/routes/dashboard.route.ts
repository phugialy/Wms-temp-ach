import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { logger } from '../utils/logger';

const router = Router();

// Initialize database pool
const pool = new Pool({
  connectionString: process.env['DIRECT_URL'],
  ssl: { rejectUnauthorized: false },
});

/**
 * GET /api/dashboard/cron-jobs-today
 * Get today's cron job execution statistics
 */
router.get('/cron-jobs-today', async (req: Request, res: Response): Promise<void> => {
  try {
    // Get today's date range (start of day to now)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();
    const now = new Date().toISOString();

    // Get all active schedules
    const schedulesQuery = `
      SELECT 
        id,
        name,
        workflow_type,
        stations,
        location,
        schedule_time,
        frequency,
        is_active
      FROM cron_job_schedule
      WHERE is_active = true
      ORDER BY name
    `;

    const { rows: schedules } = await pool.query(schedulesQuery);

    // Get today's executions for each schedule
    const executionsQuery = `
      SELECT 
        schedule_id,
        workflow_type,
        devices_found,
        devices_processed,
        devices_added,
        devices_failed,
        status,
        started_at,
        completed_at,
        duration_ms
      FROM cron_job_execution
      WHERE started_at >= $1::timestamptz
        AND started_at <= $2::timestamptz
        AND schedule_id IS NOT NULL
      ORDER BY started_at DESC
    `;

    const { rows: executions } = await pool.query(executionsQuery, [todayStart, now]);

    // Group executions by schedule_id
    const executionsBySchedule = new Map<bigint, any[]>();
    executions.forEach((exec) => {
      const scheduleId = BigInt(exec.schedule_id);
      if (!executionsBySchedule.has(scheduleId)) {
        executionsBySchedule.set(scheduleId, []);
      }
      executionsBySchedule.get(scheduleId)!.push(exec);
    });

    // Calculate totals for today
    const totalDevicesProcessed = executions.reduce((sum, exec) => sum + (exec.devices_processed || 0), 0);
    const totalDevicesFound = executions.reduce((sum, exec) => sum + (exec.devices_found || 0), 0);
    const totalDevicesAdded = executions.reduce((sum, exec) => sum + (exec.devices_added || 0), 0);
    const totalDevicesFailed = executions.reduce((sum, exec) => sum + (exec.devices_failed || 0), 0);

    // Calculate daily targets based on last 7 days average
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const historicalQuery = `
      SELECT 
        schedule_id,
        DATE(started_at) as execution_date,
        SUM(devices_processed) as daily_processed
      FROM cron_job_execution
      WHERE started_at >= $1::timestamptz
        AND started_at < $2::timestamptz
        AND schedule_id IS NOT NULL
        AND status = 'completed'
      GROUP BY schedule_id, DATE(started_at)
      ORDER BY schedule_id, execution_date DESC
    `;

    const { rows: historicalData } = await pool.query(historicalQuery, [sevenDaysAgo.toISOString(), todayStart]);

    // Calculate average daily processed per schedule
    const dailyTargetsBySchedule = new Map<bigint, number>();
    const scheduleDailyTotals = new Map<bigint, { total: number; days: number }>();

    historicalData.forEach((row) => {
      const scheduleId = BigInt(row.schedule_id);
      const dailyProcessed = parseInt(row.daily_processed) || 0;

      if (!scheduleDailyTotals.has(scheduleId)) {
        scheduleDailyTotals.set(scheduleId, { total: 0, days: 0 });
      }
      const current = scheduleDailyTotals.get(scheduleId)!;
      current.total += dailyProcessed;
      current.days += 1;
    });

    scheduleDailyTotals.forEach((value, scheduleId) => {
      const average = value.days > 0 ? Math.round(value.total / value.days) : 0;
      dailyTargetsBySchedule.set(scheduleId, average);
    });

    // Build job stats with today's data
    const jobStats = schedules.map((schedule) => {
      const scheduleId = BigInt(schedule.id);
      const todayExecutions = executionsBySchedule.get(scheduleId) || [];
      
      // Aggregate today's stats for this schedule
      const todayStats = todayExecutions.reduce(
        (acc, exec) => ({
          devicesFound: acc.devicesFound + (exec.devices_found || 0),
          devicesProcessed: acc.devicesProcessed + (exec.devices_processed || 0),
          devicesAdded: acc.devicesAdded + (exec.devices_added || 0),
          devicesFailed: acc.devicesFailed + (exec.devices_failed || 0),
          executionCount: acc.executionCount + 1,
          lastExecution: exec.started_at > acc.lastExecution ? exec.started_at : acc.lastExecution,
          status: exec.status || 'pending',
        }),
        {
          devicesFound: 0,
          devicesProcessed: 0,
          devicesAdded: 0,
          devicesFailed: 0,
          executionCount: 0,
          lastExecution: null as string | null,
          status: 'pending' as string,
        }
      );

      // Get daily target from historical average
      const dailyTarget = dailyTargetsBySchedule.get(scheduleId) || null;

      return {
        scheduleId: schedule.id.toString(),
        name: schedule.name,
        workflowType: schedule.workflow_type,
        stations: schedule.stations,
        location: schedule.location,
        scheduleTime: schedule.schedule_time,
        frequency: schedule.frequency,
        isActive: schedule.is_active,
        // Today's stats
        today: {
          devicesFound: todayStats.devicesFound,
          devicesProcessed: todayStats.devicesProcessed,
          devicesAdded: todayStats.devicesAdded,
          devicesFailed: todayStats.devicesFailed,
          executionCount: todayStats.executionCount,
          lastExecution: todayStats.lastExecution,
          status: todayStats.status,
        },
        // Daily target based on 7-day average
        dailyTarget,
      };
    });

    res.json({
      success: true,
      data: {
        date: today.toISOString().split('T')[0],
        totals: {
          devicesProcessed: totalDevicesProcessed,
          devicesFound: totalDevicesFound,
          devicesAdded: totalDevicesAdded,
          devicesFailed: totalDevicesFailed,
          executionCount: executions.length,
        },
        jobs: jobStats,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[DashboardRoute] Error fetching cron jobs today:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cron job statistics',
      details: errorMessage,
    });
  }
});

export default router;

