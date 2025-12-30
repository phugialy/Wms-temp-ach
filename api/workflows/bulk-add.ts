/**
 * Vercel Serverless Function for Bulk-Add Workflow Automation
 * This endpoint is triggered by Vercel Cron Jobs
 * 
 * Configure cron schedule in vercel.json
 * Example: Run daily at 2 AM UTC
 * 
 * IMPORTANT: This function directly calls the workflow engine service
 * instead of making HTTP requests to avoid circular dependencies and routing issues.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Vercel cron jobs send GET requests by default
  // Allow both GET and POST for flexibility
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify CRON_SECRET ONLY for GET requests (Vercel cron jobs)
  // POST requests are manual triggers from the UI and should NOT require CRON_SECRET
  if (req.method === 'GET') {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing CRON_SECRET' });
    }
  }

  try {
    // Get configuration from environment variables, request body (POST), or query params (GET)
    const isGet = req.method === 'GET';
    const stations = isGet 
      ? (req.query.stations as string)?.split(',') || process.env.CRON_STATIONS?.split(',') || []
      : req.body?.stations || process.env.CRON_STATIONS?.split(',') || [];
    const dateFrom = isGet
      ? (req.query.dateFrom as string) || getDefaultDateFrom()
      : req.body?.dateFrom || getDefaultDateFrom();
    const dateTo = isGet
      ? (req.query.dateTo as string) || getDefaultDateTo()
      : req.body?.dateTo || getDefaultDateTo();
    const location = isGet
      ? (req.query.location as string) || process.env.CRON_DEFAULT_LOCATION || 'Default Location'
      : req.body?.location || process.env.CRON_DEFAULT_LOCATION || 'Default Location';

    if (!stations || stations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No stations configured. Set CRON_STATIONS environment variable or provide in request body.'
      });
    }

    console.log('[VercelCron] Executing workflow directly (no HTTP call)');
    console.log('[VercelCron] Parameters:', { stations, dateFrom, dateTo, location });

    // Directly import and use the workflow engine service (compiled JavaScript)
    // This avoids HTTP circular calls and routing issues
    const path = require('path');
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;
    
    let WorkflowEngineService: any;
    let PhonecheckService: any;
    
    if (isProduction) {
      // Production: Load from compiled dist/
      try {
        const workflowEngineModule = require(path.join(process.cwd(), 'dist/services/workflow-engine.service.js'));
        const phonecheckModule = require(path.join(process.cwd(), 'dist/services/phonecheck.service.js'));
        WorkflowEngineService = workflowEngineModule.WorkflowEngineService || workflowEngineModule.default?.WorkflowEngineService;
        PhonecheckService = phonecheckModule.PhonecheckService || phonecheckModule.default?.PhonecheckService;
      } catch (err) {
        console.error('[VercelCron] Failed to load compiled services:', err);
        // Fallback: try relative path
        WorkflowEngineService = require('../../dist/services/workflow-engine.service.js').WorkflowEngineService;
        PhonecheckService = require('../../dist/services/phonecheck.service.js').PhonecheckService;
      }
    } else {
      // Development: Use TypeScript with ts-node
      if (!require.extensions['.ts']) {
        require('ts-node/register/transpile-only');
      }
      WorkflowEngineService = require('../../src/services/workflow-engine.service').WorkflowEngineService;
      PhonecheckService = require('../../src/services/phonecheck.service').PhonecheckService;
    }

    // Initialize services and execute workflow
    const phonecheckService = new PhonecheckService();
    const workflowEngine = new WorkflowEngineService(phonecheckService);

    const result = await workflowEngine.executeBulkAddWorkflow({
      stations: Array.isArray(stations) ? stations : [stations],
      dateFrom,
      dateTo,
      location,
      triggerSource: 'vercel-cron'
    });

    return res.status(200).json({
      success: true,
      message: 'Workflow executed successfully',
      executionId: result.executionId?.toString(),
      data: {
        devicesFound: result.devicesFound,
        devicesProcessed: result.devicesProcessed,
        devicesAdded: result.devicesAdded,
        devicesFailed: result.devicesFailed,
        durationMs: result.durationMs,
        status: result.status
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cron job execution error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: errorMessage,
      stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
    });
  }
}

/**
 * Get default dateFrom (yesterday)
 */
function getDefaultDateFrom(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

/**
 * Get default dateTo (today)
 */
function getDefaultDateTo(): string {
  return new Date().toISOString().split('T')[0];
}



