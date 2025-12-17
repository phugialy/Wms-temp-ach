import { Router, Request, Response } from 'express';
import { WorkflowEngineService } from '../services/workflow-engine.service';
import { PhonecheckService } from '../services/phonecheck.service';
import { logger } from '../utils/logger';

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
    const { stations, dateFrom, dateTo, location, triggerSource } = req.body;

    // Validation
    if (!stations || !Array.isArray(stations) || stations.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Stations array is required and must not be empty'
      });
      return;
    }

    if (!dateFrom || !dateTo) {
      res.status(400).json({
        success: false,
        error: 'dateFrom and dateTo are required (ISO date strings)'
      });
      return;
    }

    if (!location) {
      res.status(400).json({
        success: false,
        error: 'Location is required'
      });
      return;
    }

    logger.info('🚀 Workflow API: Starting bulk-add workflow', {
      stations,
      dateFrom,
      dateTo,
      location,
      triggerSource: triggerSource || 'api'
    });

    // Execute workflow
    const result = await workflowEngine.executeBulkAddWorkflow({
      stations,
      dateFrom,
      dateTo,
      location,
      triggerSource: triggerSource || 'api'
    });

    const processingTime = Date.now() - startTime;

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
        processingTime
      },
      error: result.errorMessage,
      errorDetails: result.errorDetails,
      message: result.success
        ? `Workflow completed: ${result.devicesAdded} devices added successfully`
        : `Workflow completed with errors: ${result.devicesFailed} devices failed`
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('❌ Workflow API Error:', {
      error: errorMessage,
      body: req.body,
      processingTime: Date.now() - startTime
    });

    res.status(500).json({
      success: false,
      error: 'Workflow execution failed',
      details: errorMessage,
      processingTime: Date.now() - startTime
    });
  }
});

/**
 * GET /api/workflows/executions
 * Get workflow execution history
 */
router.get('/executions', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query['limit'] as string) || 50;
    const offset = parseInt(req.query['offset'] as string) || 0;

    const executions = await workflowEngine.getExecutionHistory(limit, offset);

    res.json({
      success: true,
      data: executions,
      pagination: {
        limit,
        offset,
        total: executions.length
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Error getting execution history', { error: errorMessage });
    
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

    res.json({
      success: true,
      data: execution
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
 * GET /api/workflows/stats
 * Get workflow execution statistics
 */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await workflowEngine.getExecutionStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Error getting workflow stats', { error: errorMessage });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get workflow statistics',
      details: errorMessage
    });
  }
});

export default router;

