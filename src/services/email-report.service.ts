import { logger } from '../utils/logger';
import prisma from '../prisma/client';
import dayjs from 'dayjs';
import { emailService } from './email.service';

export interface ExecutionGroup {
  scheduleName: string;
  scheduleTime: string;
  stations: string[];
  executions: Array<{
    id: string;
    startedAt: string | null;
    completedAt: string | null;
    durationMs: number | null;
    devicesFound: number;
    devicesAdded: number;
    devicesFailed: number;
    status: string;
    errorMessage: string | null;
  }>;
  totals: {
    devicesFound: number;
    devicesAdded: number;
    devicesFailed: number;
    devicesProcessed: number;
    executionCount: number;
    successCount: number;
    failureCount: number;
    totalDurationMs: number;
  };
}

export interface DailyReportData {
  date: string;
  location: string | null;
  groups: ExecutionGroup[];
  overallTotals: {
    devicesFound: number;
    devicesAdded: number;
    devicesFailed: number;
    devicesProcessed: number;
    executionCount: number;
    successCount: number;
    failureCount: number;
    totalDurationMs: number;
  };
}

export class EmailReportService {
  /**
   * Generate daily report grouped by stations
   */
  async generateDailyReportByStations(
    date: string, 
    location?: string, 
    scheduleIds?: bigint[]
  ): Promise<DailyReportData | null> {
    try {
      const startOfDay = dayjs(date).startOf('day').toDate();
      const endOfDay = dayjs(date).endOf('day').toDate();

      logger.info('[EmailReportService] Generating daily report', {
        date,
        location,
        scheduleIds: scheduleIds?.map(id => id.toString()),
        startOfDay: startOfDay.toISOString(),
        endOfDay: endOfDay.toISOString(),
      });

      // Fetch executions for the date
      const whereClause: any = {
        completedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          in: ['completed', 'failed'],
        },
      };

      if (location) {
        whereClause.location = location;
      }

      // Filter by schedule IDs if provided
      if (scheduleIds && scheduleIds.length > 0) {
        whereClause.scheduleId = {
          in: scheduleIds,
        };
        logger.info('[EmailReportService] Filtering by schedule IDs:', scheduleIds.map(id => id.toString()));
      }

      const executions = await prisma.cronJobExecution.findMany({
        where: whereClause,
        include: {
          schedule: {
            select: {
              id: true,
              name: true,
              scheduleTime: true,
              frequency: true,
            },
          },
        },
        orderBy: {
          completedAt: 'desc',
        },
      });

      if (executions.length === 0) {
        logger.info('[EmailReportService] No executions found for date:', date);
        return null;
      }

      // Group by schedule name (which typically includes station info)
      const groupsMap = new Map<string, ExecutionGroup>();

      for (const exec of executions) {
        const scheduleName = exec.schedule?.name || 'Manual Trigger';
        const scheduleTime = exec.schedule?.scheduleTime || 'N/A';

        if (!groupsMap.has(scheduleName)) {
          groupsMap.set(scheduleName, {
            scheduleName,
            scheduleTime,
            stations: exec.stations,
            executions: [],
            totals: {
              devicesFound: 0,
              devicesAdded: 0,
              devicesFailed: 0,
              devicesProcessed: 0,
              executionCount: 0,
              successCount: 0,
              failureCount: 0,
              totalDurationMs: 0,
            },
          });
        }

        const group = groupsMap.get(scheduleName)!;
        group.executions.push({
          id: exec.id.toString(),
          startedAt: exec.startedAt?.toISOString() || null,
          completedAt: exec.completedAt?.toISOString() || null,
          durationMs: exec.durationMs,
          devicesFound: exec.devicesFound,
          devicesAdded: exec.devicesAdded,
          devicesFailed: exec.devicesFailed,
          status: exec.status,
          errorMessage: exec.errorMessage,
        });

        // Update totals
        group.totals.devicesFound += exec.devicesFound;
        group.totals.devicesAdded += exec.devicesAdded;
        group.totals.devicesFailed += exec.devicesFailed;
        group.totals.devicesProcessed += exec.devicesProcessed;
        group.totals.executionCount += 1;
        if (exec.status === 'completed') {
          group.totals.successCount += 1;
        } else {
          group.totals.failureCount += 1;
        }
        group.totals.totalDurationMs += exec.durationMs || 0;
      }

      const groups = Array.from(groupsMap.values());

      // Calculate overall totals
      const overallTotals = groups.reduce(
        (acc, group) => ({
          devicesFound: acc.devicesFound + group.totals.devicesFound,
          devicesAdded: acc.devicesAdded + group.totals.devicesAdded,
          devicesFailed: acc.devicesFailed + group.totals.devicesFailed,
          devicesProcessed: acc.devicesProcessed + group.totals.devicesProcessed,
          executionCount: acc.executionCount + group.totals.executionCount,
          successCount: acc.successCount + group.totals.successCount,
          failureCount: acc.failureCount + group.totals.failureCount,
          totalDurationMs: acc.totalDurationMs + group.totals.totalDurationMs,
        }),
        {
          devicesFound: 0,
          devicesAdded: 0,
          devicesFailed: 0,
          devicesProcessed: 0,
          executionCount: 0,
          successCount: 0,
          failureCount: 0,
          totalDurationMs: 0,
        }
      );

      return {
        date,
        location: location || null,
        groups,
        overallTotals,
      };
    } catch (error) {
      logger.error('[EmailReportService] Error generating daily report:', error);
      throw error;
    }
  }

  /**
   * Generate HTML email template for daily report
   */
  generateDailyReportHTML(reportData: DailyReportData): string {
    const formattedDate = dayjs(reportData.date).format('MMMM DD, YYYY');
    const successRate =
      reportData.overallTotals.executionCount > 0
        ? ((reportData.overallTotals.successCount / reportData.overallTotals.executionCount) * 100).toFixed(1)
        : '0.0';
    const avgDurationSeconds = Math.round(
      reportData.overallTotals.executionCount > 0
        ? reportData.overallTotals.totalDurationMs / reportData.overallTotals.executionCount / 1000
        : 0
    );

    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #1890ff;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #1890ff;
      margin: 0;
      font-size: 24px;
    }
    .header .date {
      color: #666;
      font-size: 14px;
      margin-top: 8px;
    }
    .summary {
      background-color: #f0f7ff;
      border-left: 4px solid #1890ff;
      padding: 15px;
      margin-bottom: 30px;
      border-radius: 4px;
    }
    .summary-item {
      display: flex;
      justify-content: space-between;
      margin: 8px 0;
    }
    .summary-label {
      font-weight: 600;
      color: #555;
    }
    .summary-value {
      color: #1890ff;
      font-weight: 700;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background-color: #fff;
    }
    th {
      background-color: #1890ff;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e8e8e8;
    }
    tr:hover {
      background-color: #f5f5f5;
    }
    .total-row {
      background-color: #f0f7ff;
      font-weight: 700;
    }
    .total-row td {
      border-top: 2px solid #1890ff;
      border-bottom: 2px solid #1890ff;
    }
    .status-success {
      color: #52c41a;
      font-weight: 600;
    }
    .status-failed {
      color: #ff4d4f;
      font-weight: 600;
    }
    .details-section {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e8e8e8;
    }
    .execution-item {
      background-color: #fafafa;
      padding: 15px;
      margin: 10px 0;
      border-radius: 4px;
      border-left: 3px solid #1890ff;
    }
    .execution-item h3 {
      margin: 0 0 10px 0;
      color: #1890ff;
      font-size: 16px;
    }
    .execution-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 10px;
      font-size: 13px;
      color: #666;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e8e8e8;
      color: #999;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 DAILY EXECUTION REPORT</h1>
      <div class="date">${formattedDate}</div>
    </div>

    <div class="summary">
      <div class="summary-item">
        <span class="summary-label">📍 Location:</span>
        <span class="summary-value">${reportData.location || 'All Locations'}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">⏰ Generated:</span>
        <span class="summary-value">${dayjs().format('MMMM DD, YYYY [at] HH:mm')} UTC</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">📊 Success Rate:</span>
        <span class="summary-value">${successRate}% (${reportData.overallTotals.successCount}/${reportData.overallTotals.executionCount})</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">⏱️ Average Duration:</span>
        <span class="summary-value">${avgDurationSeconds} seconds</span>
      </div>
    </div>

    <h2 style="color: #333; margin-top: 30px;">Execution Summary by Station</h2>
    <table>
      <thead>
        <tr>
          <th>Cron Job</th>
          <th>Found</th>
          <th>Added</th>
          <th>Failed</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
`;

    // Add rows for each group
    for (const group of reportData.groups) {
      const statusClass = group.totals.failureCount === 0 ? 'status-success' : 'status-failed';
      const statusText = group.totals.failureCount === 0 ? '✅ All Success' : `⚠️ ${group.totals.failureCount} Failed`;
      
      html += `
        <tr>
          <td><strong>${group.scheduleName}</strong><br><small style="color: #999;">${group.scheduleTime}</small></td>
          <td>${group.totals.devicesFound.toLocaleString()}</td>
          <td>${group.totals.devicesAdded.toLocaleString()}</td>
          <td>${group.totals.devicesFailed.toLocaleString()}</td>
          <td class="${statusClass}">${statusText}</td>
        </tr>
      `;
    }

    // Add total row
    html += `
        <tr class="total-row">
          <td><strong>TOTAL</strong></td>
          <td>${reportData.overallTotals.devicesFound.toLocaleString()}</td>
          <td>${reportData.overallTotals.devicesAdded.toLocaleString()}</td>
          <td>${reportData.overallTotals.devicesFailed.toLocaleString()}</td>
          <td>${reportData.overallTotals.executionCount} executions</td>
        </tr>
      </tbody>
    </table>
`;

    // Add detailed breakdown
    if (reportData.groups.length > 0) {
      html += `
    <div class="details-section">
      <h2 style="color: #333;">Detailed Breakdown</h2>
`;

      for (const group of reportData.groups) {
        html += `
      <div class="execution-item">
        <h3>🔹 ${group.scheduleName}</h3>
        <div class="execution-meta">
          <div><strong>Schedule:</strong> ${group.scheduleTime}</div>
          <div><strong>Stations:</strong> ${group.stations.join(', ')}</div>
          <div><strong>Executions:</strong> ${group.totals.executionCount}</div>
          <div><strong>Duration:</strong> ${Math.round(group.totals.totalDurationMs / group.totals.executionCount / 1000)}s avg</div>
        </div>
        <div style="margin-top: 10px;">
          <strong>Devices:</strong> ${group.totals.devicesAdded} added, ${group.totals.devicesFailed} failed, 
          ${group.totals.devicesFound - group.totals.devicesAdded - group.totals.devicesFailed} skipped
        </div>
      </div>
`;
      }

      html += `
    </div>
`;
    }

    html += `
    <div class="footer">
      <p>📧 This is an automated report from WMS Cron Job System</p>
      <p>🔗 View full details in the dashboard</p>
    </div>
  </div>
</body>
</html>
`;

    return html;
  }

  /**
   * Send daily report email
   */
  async sendDailyReport(
    date: string, 
    recipients: string[], 
    location?: string, 
    scheduleIds?: bigint[]
  ): Promise<boolean> {
    try {
      const reportData = await this.generateDailyReportByStations(date, location, scheduleIds);

      if (!reportData) {
        logger.info('[EmailReportService] No report data to send for date:', date);
        return false;
      }

      const formattedDate = dayjs(date).format('MMMM DD, YYYY');
      const subject = `📊 Daily Execution Report - ${formattedDate}`;
      const html = this.generateDailyReportHTML(reportData);

      return await emailService.sendBulkEmail(recipients, subject, html);
    } catch (error) {
      logger.error('[EmailReportService] Error sending daily report:', error);
      return false;
    }
  }
}

export const emailReportService = new EmailReportService();

