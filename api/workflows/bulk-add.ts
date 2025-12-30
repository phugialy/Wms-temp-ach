/**
 * Vercel Serverless Function for Bulk-Add Workflow Automation
 * This endpoint is triggered by Vercel Cron Jobs
 * 
 * Configure cron schedule in vercel.json
 * Example: Run daily at 2 AM UTC
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

    // Call your workflow API endpoint (use POST to the Express route)
    // Note: We're calling the Express app route, not making an external HTTP call
    // The Express route will handle the actual workflow execution
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : process.env.WORKFLOW_API_URL || 'http://localhost:3001';

    const workflowApiUrl = `${baseUrl}/api/workflows/bulk-add`;
    
    console.log('[VercelCron] Calling workflow API:', workflowApiUrl);
    console.log('[VercelCron] Parameters:', { stations, dateFrom, dateTo, location });

    const response = await fetch(workflowApiUrl, {
      method: 'POST', // Express route expects POST for workflow execution
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_KEY || process.env.CRON_SECRET || ''}`
      },
      body: JSON.stringify({
        stations,
        dateFrom,
        dateTo,
        location,
        triggerSource: 'vercel-cron'
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: 'Workflow execution failed',
        details: result
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Workflow executed successfully',
      executionId: result.executionId,
      data: result.data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cron job execution error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
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



