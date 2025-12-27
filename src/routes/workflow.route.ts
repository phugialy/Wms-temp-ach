import { Router, Request, Response } from 'express';
import { WorkflowEngineService } from '../services/workflow-engine.service';
import { PhonecheckService } from '../services/phonecheck.service';
import { logger } from '../utils/logger';
import prisma from '../prisma/client';

const router = Router();
const phonecheckService = new PhonecheckService();
const workflowEngine = new WorkflowEngineService(phonecheckService);

/**
 * POST /api/workflows/bulk-add
 * Execute bulk-add workflow automation
 * Designed for Vercel cron job triggers
 */
router.post('/bulk-add', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    console.log('[WorkflowRoute] POST /bulk-add - Request received');
    console.log('[WorkflowRoute] Request body:', JSON.stringify(req.body, null, 2));
    
    const { stations, dateFrom, dateTo, location, triggerSource } = req.body;

    // Validation
    if (!stations || !Array.isArray(stations) || stations.length === 0) {
      console.warn('[WorkflowRoute] Validation failed: stations array is empty or invalid');
      res.status(400).json({
        success: false,
        error: 'Stations array is required and must not be empty'
      });
      return;
    }

    if (!dateFrom || !dateTo) {
      console.warn('[WorkflowRoute] Validation failed: dateFrom or dateTo missing');
      res.status(400).json({
        success: false,
        error: 'dateFrom and dateTo are required (ISO date strings)'
      });
      return;
    }

    if (!location) {
      console.warn('[WorkflowRoute] Validation failed: location missing');
      res.status(400).json({
        success: false,
        error: 'Location is required'
      });
      return;
    }

    console.log('[WorkflowRoute] Validation passed, starting workflow execution');
    logger.info('🚀 Workflow API: Starting bulk-add workflow', {
      stations,
      dateFrom,
      dateTo,
      location,
      triggerSource: triggerSource || 'api'
    });

    // Execute workflow
    console.log('[WorkflowRoute] Calling workflowEngine.executeBulkAddWorkflow...');
    const result = await workflowEngine.executeBulkAddWorkflow({
      stations,
      dateFrom,
      dateTo,
      location,
      triggerSource: triggerSource || 'api'
    });

    const processingTime = Date.now() - startTime;
    console.log('[WorkflowRoute] Workflow execution completed:', {
      success: result.success,
      executionId: result.executionId.toString(),
      status: result.status,
      devicesFound: result.devicesFound,
      devicesAdded: result.devicesAdded,
      devicesFailed: result.devicesFailed,
      durationMs: result.durationMs,
      processingTime
    });

    // Determine response message based on result
    let message: string;
    if (!result.success) {
      message = `Workflow completed with errors: ${result.devicesFailed} devices failed`;
    } else if (result.devicesFound === 0) {
      message = `Workflow completed successfully: No devices found for the specified date range (this is expected if no devices were processed that day)`;
    } else if (result.devicesAdded > 0) {
      message = `Workflow completed: ${result.devicesAdded} devices added successfully`;
    } else {
      message = `Workflow completed: ${result.devicesFound} devices found, ${result.devicesProcessed} processed`;
    }

    res.status(result.success ? 200 : 500).json({
      success: result.success,
      executionId: result.executionId.toString(),
      status: result.status,
      data: {
        devicesFound: result.devicesFound,
        devicesProcessed: result.devicesProcessed,
        devicesAdded: result.devicesAdded,
        devicesFailed: result.devicesFailed,
        durationMs: result.durationMs,
        processingTime,
        note: result.devicesFound === 0 ? 'Zero devices found is a valid, successful scenario - not a failure' : undefined
      },
      error: result.errorMessage,
      errorDetails: result.errorDetails,
      message
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : String(error);
    
    logger.error('❌ Workflow API Error:', {
      error: errorMessage,
      stack: errorStack,
      body: req.body,
      processingTime: Date.now() - startTime
    });

    console.error('❌ Workflow API Error Details:', {
      message: errorMessage,
      stack: errorStack,
      body: req.body
    });

    res.status(500).json({
      success: false,
      error: 'Workflow execution failed',
      details: errorMessage,
      message: `Failed to execute workflow: ${errorMessage}`,
      processingTime: Date.now() - startTime
    });
  }
});

/**
 * GET /api/workflows/executions
 * Get workflow execution history
 */
router.get('/executions', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    // Cap limit to prevent timeout (max 100 records)
    const requestedLimit = parseInt(req.query['limit'] as string) || 50;
    const limit = Math.min(requestedLimit, 100);
    const offset = parseInt(req.query['offset'] as string) || 0;
    
    // Optional date filtering
    const dateFrom = req.query['dateFrom'] ? new Date(req.query['dateFrom'] as string) : undefined;
    const dateTo = req.query['dateTo'] ? new Date(req.query['dateTo'] as string) : undefined;

    console.log(`[WorkflowRoute] GET /executions - limit=${limit}, offset=${offset}`, {
      dateFrom: dateFrom?.toISOString(),
      dateTo: dateTo?.toISOString()
    });
    
    const executions = await workflowEngine.getExecutionHistory(limit, offset, dateFrom, dateTo);
    console.log(`[WorkflowRoute] Returning ${executions.length} executions (took ${Date.now() - startTime}ms)`);

    // Serialize BigInt IDs and dates properly, include schedule info
    const serializedExecutions = executions.map(execution => ({
      ...execution,
      id: execution.id.toString(),
      scheduleId: execution.scheduleId?.toString() || null,
      scheduleName: execution.schedule?.name || null,
      scheduleTime: execution.schedule?.scheduleTime || null,
      scheduleFrequency: execution.schedule?.frequency || null,
      dateFrom: execution.dateFrom?.toISOString() || null,
      dateTo: execution.dateTo?.toISOString() || null,
      startedAt: execution.startedAt?.toISOString() || null,
      completedAt: execution.completedAt?.toISOString() || null,
      createdAt: execution.createdAt?.toISOString() || null,
      updatedAt: execution.updatedAt?.toISOString() || null,
      schedule: undefined, // Remove nested object, we've extracted what we need
    }));

    res.json({
      success: true,
      data: serializedExecutions,
      pagination: {
        limit,
        offset,
        total: executions.length
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[WorkflowRoute] Error getting execution history:', {
      message: errorMessage,
      stack: errorStack,
      query: req.query,
      processingTime: Date.now() - startTime
    });
    logger.error('Error getting execution history', { error: errorMessage, stack: errorStack });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get execution history',
      details: errorMessage
    });
  }
});

/**
 * GET /api/workflows/executions/:id
 * Get specific execution details
 */
router.get('/executions/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const idParam = req.params['id'];
    if (!idParam) {
      res.status(400).json({
        success: false,
        error: 'Execution ID is required'
      });
      return;
    }
    
    const id = BigInt(idParam);
    const execution = await workflowEngine.getExecutionById(id);

    if (!execution) {
      res.status(404).json({
        success: false,
        error: 'Execution not found'
      });
      return;
    }

    // Serialize BigInt IDs and dates properly
    const serializedExecution = {
      ...execution,
      id: execution.id.toString(),
      dateFrom: execution.dateFrom?.toISOString() || null,
      dateTo: execution.dateTo?.toISOString() || null,
      startedAt: execution.startedAt?.toISOString() || null,
      completedAt: execution.completedAt?.toISOString() || null,
      createdAt: execution.createdAt?.toISOString() || null,
      updatedAt: execution.updatedAt?.toISOString() || null
    };

    res.json({
      success: true,
      data: serializedExecution
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Error getting execution details', { error: errorMessage, id: req.params['id'] });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get execution details',
      details: errorMessage
    });
  }
});

/**
 * GET /api/workflows/executions/:id/devices
 * Get devices processed in a specific execution
 */
router.get('/executions/:id/devices', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const executionIdParam = req.params['id'];
    if (!executionIdParam) {
      res.status(400).json({
        success: false,
        error: 'Execution ID is required'
      });
      return;
    }

    const executionId = BigInt(executionIdParam);
    console.log(`[WorkflowRoute] GET /executions/${executionId}/devices - Request received`);
    
    const execution = await workflowEngine.getExecutionById(executionId);
    
    if (!execution) {
      res.status(404).json({
        success: false,
        error: 'Execution not found'
      });
      return;
    }

    // Extract devices from metadata
    let devices = (execution.metadata as any)?.devices || [];
    const totalDevices = (execution.metadata as any)?.totalDevices || devices.length;

    console.log(`[WorkflowRoute] Found ${devices.length} devices in metadata for execution ${executionId}`);

    // Fallback: If no devices in metadata but devices were added, try to query from Item table
    // This handles older executions that don't have metadata
    if (devices.length === 0 && execution.devicesAdded > 0) {
      console.log(`[WorkflowRoute] No devices in metadata, querying from Item table as fallback...`);
      console.log(`[WorkflowRoute] Execution details:`, {
        executionId: executionId.toString(),
        devicesAdded: execution.devicesAdded,
        location: execution.location,
        startedAt: execution.startedAt?.toISOString(),
        completedAt: execution.completedAt?.toISOString(),
        createdAt: execution.createdAt.toISOString()
      });
      
      try {
        // Query items created around the execution time
        const executionStart = execution.startedAt || execution.createdAt;
        const executionEnd = execution.completedAt || new Date(execution.createdAt.getTime() + 10 * 60 * 1000); // Default 10 min window
        
        // Add a larger buffer (15 minutes before/after) to catch devices
        const queryStart = new Date(executionStart);
        queryStart.setMinutes(queryStart.getMinutes() - 15);
        const queryEnd = new Date(executionEnd);
        queryEnd.setMinutes(queryEnd.getMinutes() + 15);

        console.log(`[WorkflowRoute] Querying items between ${queryStart.toISOString()} and ${queryEnd.toISOString()}`);

        // Build where clause - be more flexible with location
        const whereClause: any = {
          createdAt: {
            gte: queryStart,
            lte: queryEnd
          }
        };

        // Only filter by location if it's provided and not null
        if (execution.location) {
          whereClause.location = execution.location;
        }

        const items = await prisma.item.findMany({
          where: whereClause,
          take: Math.min(execution.devicesAdded, 1000), // Limit to 1000
          orderBy: { createdAt: 'asc' },
          select: {
            imei: true,
            model: true,
            capacity: true,
            color: true,
            carrier: true,
            createdAt: true,
            location: true
          }
        });

        console.log(`[WorkflowRoute] Found ${items.length} items from database query`);

        if (items.length > 0) {
          // Also get product info for brand
          const imeis = items.map(i => i.imei);
          const products = await prisma.product.findMany({
            where: { imei: { in: imeis } },
            select: { imei: true, brand: true }
          });

          const brandMap = new Map(products.map(p => [p.imei, p.brand]));

          // Convert to device format
          devices = items.map(item => ({
            imei: item.imei,
            station: execution.stations[0] || 'unknown', // Use first station as fallback
            brand: brandMap.get(item.imei) || 'N/A',
            model: item.model || 'N/A',
            capacity: item.capacity || 'N/A',
            color: item.color || 'N/A',
            carrier: item.carrier || 'N/A',
            processedAt: item.createdAt ? item.createdAt.toISOString() : new Date().toISOString()
          }));

          console.log(`[WorkflowRoute] Successfully converted ${devices.length} devices from Item table fallback`);
        } else {
          console.warn(`[WorkflowRoute] No items found in database for execution ${executionId}. This might be because:`);
          console.warn(`  - Items were created outside the time window`);
          console.warn(`  - Location filter didn't match (location: ${execution.location})`);
          console.warn(`  - Items don't have createdAt timestamps`);
        }
      } catch (fallbackError: any) {
        console.error('[WorkflowRoute] Error querying devices from Item table:', {
          message: fallbackError.message,
          stack: fallbackError.stack,
          executionId: executionId.toString()
        });
        // Continue with empty devices array
      }
    }

    console.log(`[WorkflowRoute] Returning ${devices.length} devices for execution ${executionId}`);

    res.json({
      success: true,
      data: {
        devices,
        total: totalDevices,
        shown: devices.length,
        executionId: executionId.toString()
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[WorkflowRoute] Error getting execution devices:', {
      message: errorMessage,
      stack: errorStack,
      executionId: req.params['id'],
      processingTime: Date.now() - startTime
    });
    logger.error('Error getting execution devices', { error: errorMessage, stack: errorStack });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get execution devices',
      details: errorMessage
    });
  }
});

/**
 * GET /api/workflows/stations/stats
 * Get device statistics grouped by station/worker
 */
router.get('/stations/stats', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    console.log('[WorkflowRoute] GET /stations/stats - Request received');
    
    const dateFrom = req.query['dateFrom'] ? new Date(req.query['dateFrom'] as string) : undefined;
    const dateTo = req.query['dateTo'] ? new Date(req.query['dateTo'] as string) : undefined;

    const stats = await workflowEngine.getDeviceStatsByStation(dateFrom, dateTo);
    console.log('[WorkflowRoute] Station stats retrieved:', {
      stationCount: stats.stations.length,
      totalDevices: stats.total
    });

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[WorkflowRoute] Error getting station stats:', {
      message: errorMessage,
      stack: errorStack,
      processingTime: Date.now() - startTime
    });
    logger.error('Error getting station stats', { error: errorMessage, stack: errorStack });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get station statistics',
      details: errorMessage
    });
  }
});

/**
 * GET /api/workflows/stats
 * Get workflow execution statistics
 */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    console.log('[WorkflowRoute] GET /stats - Request received');
    const stats = await workflowEngine.getExecutionStats();
    console.log('[WorkflowRoute] Stats retrieved:', stats);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[WorkflowRoute] Error getting workflow stats:', {
      message: errorMessage,
      stack: errorStack,
      processingTime: Date.now() - startTime
    });
    logger.error('Error getting workflow stats', { error: errorMessage, stack: errorStack });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get workflow statistics',
      details: errorMessage
    });
  }
});

export default router;

