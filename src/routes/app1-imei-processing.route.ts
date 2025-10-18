import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import UltraFastImeiService, { ImeiInput } from '../services/UltraFastImeiService';

const router = Router();
const imeiService = new UltraFastImeiService();

/**
 * POST /api/imei/bulk-upload
 * Ultra-fast bulk IMEI processing
 * Target: < 50ms response time for 1000+ IMEIs
 */
router.post('/bulk-upload', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Items array is required and must not be empty',
        processingTime: Date.now() - startTime
      });
      return;
    }

    if (items.length > 10000) {
      res.status(400).json({
        success: false,
        error: 'Maximum 10,000 IMEIs per batch',
        processingTime: Date.now() - startTime
      });
      return;
    }

    logger.info(`🚀 BULK UPLOAD: Processing ${items.length} IMEIs`);

    const result = await imeiService.processBulkImeis(items);

    if (result.success) {
      res.json({
        success: true,
        data: {
          batchId: result.batchId,
          totalItems: result.totalItems,
          processedItems: result.processedItems,
          failedItems: result.failedItems,
          processingTime: result.processingTime,
          message: result.message
        },
        processingTime: Date.now() - startTime
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
        data: {
          batchId: result.batchId,
          totalItems: result.totalItems,
          processedItems: result.processedItems,
          failedItems: result.failedItems,
          errors: result.errors,
          processingTime: result.processingTime
        },
        processingTime: Date.now() - startTime
      });
    }

  } catch (error) {
    logger.error('❌ BULK UPLOAD ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
      processingTime: Date.now() - startTime
    });
  }
});

/**
 * POST /api/imei/single
 * Ultra-fast single IMEI processing
 * Target: < 50ms response time
 */
router.post('/single', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const { imei, brand, model, capacity, color, carrier, device_notes, working_status, battery_health, source } = req.body;
    
    if (!imei) {
      res.status(400).json({
        success: false,
        error: 'IMEI is required',
        processingTime: Date.now() - startTime
      });
      return;
    }

    const imeiInput: ImeiInput = {
      imei,
      brand,
      model,
      capacity,
      color,
      carrier,
      device_notes,
      working_status,
      battery_health,
      source: source || 'manual'
    };

    logger.info(`⚡ SINGLE IMEI: Processing ${imei}`);

    const result = await imeiService.processSingleImei(imeiInput);

    if (result.success) {
      res.json({
        success: true,
        data: {
          imei: result.imei,
          processingTime: result.processingTime,
          message: result.message
        },
        processingTime: Date.now() - startTime
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
        data: {
          imei: result.imei,
          processingTime: result.processingTime,
          error: result.error
        },
        processingTime: Date.now() - startTime
      });
    }

  } catch (error) {
    logger.error('❌ SINGLE IMEI ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
      processingTime: Date.now() - startTime
    });
  }
});

/**
 * POST /api/imei/phonecheck
 * Phonecheck integration for single device lookup
 * Target: < 200ms response time
 */
router.post('/phonecheck', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const { imei } = req.body;
    
    if (!imei) {
      res.status(400).json({
        success: false,
        error: 'IMEI is required',
        processingTime: Date.now() - startTime
      });
      return;
    }

    logger.info(`📱 PHONECHECK: Processing IMEI ${imei}`);

    // TODO: Integrate with Phonecheck API
    // For now, simulate Phonecheck response
    const phonecheckData = {
      imei,
      brand: 'Samsung',
      model: 'Galaxy S23',
      capacity: '256GB',
      color: 'Black',
      carrier: 'Unlocked',
      device_notes: 'Phonecheck data',
      working_status: 'Working',
      battery_health: 'Good',
      source: 'phonecheck' as const
    };

    const result = await imeiService.processSingleImei(phonecheckData);

    if (result.success) {
      res.json({
        success: true,
        data: {
          imei: result.imei,
          deviceData: phonecheckData,
          processingTime: result.processingTime,
          message: result.message
        },
        processingTime: Date.now() - startTime
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
        data: {
          imei: result.imei,
          processingTime: result.processingTime,
          error: result.error
        },
        processingTime: Date.now() - startTime
      });
    }

  } catch (error) {
    logger.error('❌ PHONECHECK ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
      processingTime: Date.now() - startTime
    });
  }
});

/**
 * GET /api/imei/status/:batchId
 * Get processing status for a batch
 * Target: < 10ms response time
 */
router.get('/status/:batchId', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const { batchId } = req.params;
    
    if (!batchId) {
      res.status(400).json({
        success: false,
        error: 'Batch ID is required',
        processingTime: Date.now() - startTime
      });
      return;
    }

    const status = await imeiService.getBatchStatus(batchId);

    if (status) {
      res.json({
        success: true,
        data: status,
        processingTime: Date.now() - startTime
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Batch not found',
        processingTime: Date.now() - startTime
      });
    }

  } catch (error) {
    logger.error('❌ STATUS ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
      processingTime: Date.now() - startTime
    });
  }
});

/**
 * GET /api/imei/stats
 * Get processing statistics
 * Target: < 10ms response time
 */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const stats = await imeiService.getProcessingStats();

    if (stats) {
      res.json({
        success: true,
        data: stats,
        processingTime: Date.now() - startTime
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to get processing stats',
        processingTime: Date.now() - startTime
      });
    }

  } catch (error) {
    logger.error('❌ STATS ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
      processingTime: Date.now() - startTime
    });
  }
});

/**
 * GET /api/imei/health
 * Health check for App 1
 * Target: < 5ms response time
 */
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    // Quick health check
    const stats = await imeiService.getProcessingStats();
    
    res.json({
      success: true,
      status: 'healthy',
      data: {
        app: 'App 1: IMEI Processing',
        version: '1.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        stats: stats
      },
      processingTime: Date.now() - startTime
    });

  } catch (error) {
    logger.error('❌ HEALTH CHECK ERROR:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: 'Health check failed',
      details: error instanceof Error ? error.message : String(error),
      processingTime: Date.now() - startTime
    });
  }
});

export default router;



