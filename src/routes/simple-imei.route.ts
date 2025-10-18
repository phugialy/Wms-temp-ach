import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import SimpleImeiService, { SimpleImeiInput } from '../services/SimpleImeiService';

const router = Router();
const imeiService = new SimpleImeiService();

/**
 * POST /api/simple-imei/process
 * Simple, reliable IMEI processing
 */
router.post('/process', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const { imei, brand, model, capacity, color, carrier, device_notes } = req.body;
    
    if (!imei) {
      res.status(400).json({
        success: false,
        error: 'IMEI is required',
        processingTime: Date.now() - startTime
      });
      return;
    }

    const imeiInput: SimpleImeiInput = {
      imei,
      brand,
      model,
      capacity,
      color,
      carrier,
      device_notes
    };

    logger.info(`⚡ SIMPLE IMEI: Processing ${imei}`);

    const result = await imeiService.processImei(imeiInput);

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
    logger.error('❌ SIMPLE IMEI ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
      processingTime: Date.now() - startTime
    });
  }
});

/**
 * POST /api/simple-imei/bulk
 * Simple bulk processing
 */
router.post('/bulk', async (req: Request, res: Response): Promise<void> => {
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

    logger.info(`🚀 SIMPLE BULK: Processing ${items.length} IMEIs`);

    const result = await imeiService.processBulkImeis(items);

    res.json({
      success: result.success,
      data: {
        totalItems: result.totalItems,
        processedItems: result.processedItems,
        failedItems: result.failedItems,
        processingTime: result.processingTime,
        message: result.message,
        errors: result.errors
      },
      processingTime: Date.now() - startTime
    });

  } catch (error) {
    logger.error('❌ SIMPLE BULK ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
      processingTime: Date.now() - startTime
    });
  }
});

/**
 * GET /api/simple-imei/stats
 * Simple statistics
 */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const stats = await imeiService.getSimpleStats();

    if (stats) {
      res.json({
        success: true,
        data: stats,
        processingTime: Date.now() - startTime
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to get stats',
        processingTime: Date.now() - startTime
      });
    }

  } catch (error) {
    logger.error('❌ SIMPLE STATS ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
      processingTime: Date.now() - startTime
    });
  }
});

/**
 * GET /api/simple-imei/health
 * Simple health check
 */
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    res.json({
      success: true,
      status: 'healthy',
      data: {
        app: 'Simple IMEI Processing',
        version: '1.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage()
      },
      processingTime: Date.now() - startTime
    });

  } catch (error) {
    logger.error('❌ SIMPLE HEALTH ERROR:', error);
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



