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
  // Only allow POST requests (Vercel cron jobs send POST)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify this is a cron job request (optional security check)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get configuration from environment variables or request body
    const stations = req.body?.stations || process.env.CRON_STATIONS?.split(',') || [];
    const dateFrom = req.body?.dateFrom || getDefaultDateFrom();
    const dateTo = req.body?.dateTo || getDefaultDateTo();
    const location = req.body?.location || process.env.CRON_DEFAULT_LOCATION || 'Default Location';

    if (!stations || stations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No stations configured. Set CRON_STATIONS environment variable or provide in request body.'
      });
    }

    // Call your workflow API endpoint
    const workflowApiUrl = process.env.WORKFLOW_API_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/api/workflows/bulk-add`
      : 'http://localhost:3001/api/workflows/bulk-add';

    const response = await fetch(workflowApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_KEY || ''}`
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

