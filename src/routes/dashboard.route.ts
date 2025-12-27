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

/**
 * GET /api/dashboard/imei-processing-stats
 * Get comprehensive IMEI processing statistics with date ranges
 * Query params: station (optional), startDate (optional), endDate (optional)
 */
router.get('/imei-processing-stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const { station, startDate, endDate } = req.query;

    // Build WHERE clause
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (station) {
      whereClause += ` AND $${paramIndex} = ANY(stations)`;
      queryParams.push(station);
      paramIndex++;
    }

    if (startDate) {
      whereClause += ` AND date_from >= $${paramIndex}::date`;
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND date_to <= $${paramIndex}::date`;
      queryParams.push(endDate);
      paramIndex++;
    }

    // Get all executions with IMEI counts and date ranges
    const executionsQuery = `
      SELECT 
        id,
        workflow_type,
        trigger_source,
        status,
        schedule_id,
        stations,
        date_from,
        date_to,
        location,
        devices_found,
        devices_processed,
        devices_added,
        devices_failed,
        started_at,
        completed_at,
        duration_ms,
        metadata,
        created_at
      FROM cron_job_execution
      ${whereClause}
      ORDER BY started_at DESC NULLS LAST, created_at DESC
    `;

    const { rows: executions } = await pool.query(executionsQuery, queryParams);

    // Calculate totals
    const totals = executions.reduce(
      (acc, exec) => ({
        totalExecutions: acc.totalExecutions + 1,
        totalDevicesFound: acc.totalDevicesFound + (exec.devices_found || 0),
        totalDevicesProcessed: acc.totalDevicesProcessed + (exec.devices_processed || 0),
        totalDevicesAdded: acc.totalDevicesAdded + (exec.devices_added || 0),
        totalDevicesFailed: acc.totalDevicesFailed + (exec.devices_failed || 0),
      }),
      {
        totalExecutions: 0,
        totalDevicesFound: 0,
        totalDevicesProcessed: 0,
        totalDevicesAdded: 0,
        totalDevicesFailed: 0,
      }
    );

    // Helper function to normalize date to string (YYYY-MM-DD)
    // Handles PostgreSQL DATE columns which can be returned as strings or Date objects
    const normalizeDate = (date: any): string | null => {
      if (!date) return null;
      
      // If it's already a string
      if (typeof date === 'string') {
        // Extract date part (handle both 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:mm:ss' formats)
        const datePart = date.split('T')[0];
        // Validate it's a proper date format
        if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          return datePart;
        }
        return null;
      }
      
      // If it's a Date object
      if (date instanceof Date) {
        // Check if it's a valid date
        if (isNaN(date.getTime())) {
          return null;
        }
        const isoString = date.toISOString();
        const dateStr = isoString.split('T')[0];
        // toISOString() always returns a string, so split('T')[0] will always exist
        return (dateStr as string) || null;
      }
      
      // Try to convert to Date first, then format
      try {
        const dateObj = new Date(date);
        if (!isNaN(dateObj.getTime())) {
          const isoString = dateObj.toISOString();
          const dateStr = isoString.split('T')[0];
          // toISOString() always returns a string, so split('T')[0] will always exist
          return (dateStr as string) || null;
        }
      } catch (e) {
        // Ignore conversion errors
      }
      
      return null;
    };

    // Get date range (earliest date_from to latest date_to)
    // NOTE: Each execution should process only ONE day (dateFrom === dateTo)
    // The overall range shows the span of all executions, not a single execution's range
    const dateRanges = executions
      .filter((e) => e.date_from || e.date_to)
      .map((e) => {
        const from = normalizeDate(e.date_from);
        const to = normalizeDate(e.date_to || e.date_from);
        // Check if this execution spans multiple days (shouldn't happen for cron jobs)
        const isSingleDay = from === to || (from && to && from === to);
        return {
          from,
          to,
          isSingleDay,
        };
      });

    const earliestDate = dateRanges.length > 0
      ? dateRanges.reduce((earliest, range) => {
          const fromDate = range.from;
          return !earliest || (fromDate && fromDate < earliest) ? fromDate : earliest;
        }, null as string | null)
      : null;

    const latestDate = dateRanges.length > 0
      ? dateRanges.reduce((latest, range) => {
          const toDate = range.to;
          return !latest || (toDate && toDate > latest) ? toDate : latest;
        }, null as string | null)
      : null;

    // Count executions that span multiple days (should be 0 for proper cron jobs)
    const multiDayExecutions = dateRanges.filter(r => !r.isSingleDay).length;

    // Extract unique IMEIs from metadata (if available)
    const allImeis = new Set<string>();
    executions.forEach((exec) => {
      if (exec.metadata && typeof exec.metadata === 'object') {
        const metadata = exec.metadata as any;
        if (metadata.devices && Array.isArray(metadata.devices)) {
          metadata.devices.forEach((device: any) => {
            if (device.imei) {
              allImeis.add(device.imei);
            }
          });
        }
      }
    });

    // Group by station
    const stationStats = new Map<string, {
      station: string;
      executions: number;
      devicesFound: number;
      devicesProcessed: number;
      devicesAdded: number;
      devicesFailed: number;
      dateRanges: Array<{ from: string | null; to: string | null }>;
    }>();

    executions.forEach((exec) => {
      const stations = exec.stations || [];
      stations.forEach((station: string) => {
        if (!stationStats.has(station)) {
          stationStats.set(station, {
            station,
            executions: 0,
            devicesFound: 0,
            devicesProcessed: 0,
            devicesAdded: 0,
            devicesFailed: 0,
            dateRanges: [],
          });
        }
        const stats = stationStats.get(station)!;
        stats.executions += 1;
        stats.devicesFound += exec.devices_found || 0;
        stats.devicesProcessed += exec.devices_processed || 0;
        stats.devicesAdded += exec.devices_added || 0;
        stats.devicesFailed += exec.devices_failed || 0;
        if (exec.date_from || exec.date_to) {
        stats.dateRanges.push({
          from: normalizeDate(exec.date_from),
          to: normalizeDate(exec.date_to || exec.date_from),
        });
        }
      });
    });

    // Format executions with metadata extraction
    const formattedExecutions = executions.map((exec) => {
      let imeiCountFromMetadata = 0;
      let uniqueImeisFromMetadata: string[] = [];

      if (exec.metadata && typeof exec.metadata === 'object') {
        const metadata = exec.metadata as any;
        if (metadata.devices && Array.isArray(metadata.devices)) {
          uniqueImeisFromMetadata = metadata.devices
            .map((d: any) => d.imei)
            .filter((imei: any) => imei);
          imeiCountFromMetadata = uniqueImeisFromMetadata.length;
        } else if (metadata.totalDevices) {
          imeiCountFromMetadata = metadata.totalDevices;
        }
      }

      return {
        id: exec.id.toString(),
        workflowType: exec.workflow_type,
        triggerSource: exec.trigger_source,
        status: exec.status,
        scheduleId: exec.schedule_id ? exec.schedule_id.toString() : null,
        stations: exec.stations || [],
        dateFrom: normalizeDate(exec.date_from),
        dateTo: normalizeDate(exec.date_to || exec.date_from),
        isSingleDay: (() => {
          const from = normalizeDate(exec.date_from);
          const to = normalizeDate(exec.date_to || exec.date_from);
          return from === to;
        })(),
        location: exec.location,
        devicesFound: exec.devices_found || 0,
        devicesProcessed: exec.devices_processed || 0,
        devicesAdded: exec.devices_added || 0,
        devicesFailed: exec.devices_failed || 0,
        startedAt: exec.started_at,
        completedAt: exec.completed_at,
        durationMs: exec.duration_ms,
        imeiCountFromMetadata,
        uniqueImeisFromMetadata: uniqueImeisFromMetadata.slice(0, 100), // Limit to first 100 for response size
        createdAt: exec.created_at,
      };
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalExecutions: totals.totalExecutions,
          totalDevicesFound: totals.totalDevicesFound,
          totalDevicesProcessed: totals.totalDevicesProcessed,
          totalDevicesAdded: totals.totalDevicesAdded,
          totalDevicesFailed: totals.totalDevicesFailed,
          uniqueImeisInMetadata: allImeis.size,
          dateRange: {
            from: earliestDate,
            to: latestDate,
            note: earliestDate && latestDate && earliestDate !== latestDate
              ? `Overall range across ${totals.totalExecutions} executions. Each execution processes ONE day only.`
              : 'Single day or no date range',
          },
          multiDayExecutions: multiDayExecutions,
          warning: multiDayExecutions > 0
            ? `${multiDayExecutions} execution(s) span multiple days - this should not happen for cron jobs`
            : null,
        },
        byStation: Array.from(stationStats.values()).map((stats) => ({
          ...stats,
          dateRange: stats.dateRanges.length > 0
            ? {
                from: stats.dateRanges.reduce((earliest, range) => 
                  !earliest || (range.from && range.from < earliest) ? range.from : earliest, 
                  null as string | null
                ),
                to: stats.dateRanges.reduce((latest, range) => 
                  !latest || (range.to && range.to > latest) ? range.to : latest, 
                  null as string | null
                ),
              }
            : null,
        })),
        executions: formattedExecutions,
      },
      filters: {
        station: station || null,
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[DashboardRoute] Error fetching IMEI processing stats:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch IMEI processing statistics',
      details: errorMessage,
    });
  }
});

export default router;

