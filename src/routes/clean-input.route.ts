import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { IntegratedInputService, BulkInputItem, PhonecheckInputItem } from '../services/IntegratedInputService';
import { IntegratedBackgroundProcessor } from '../services/IntegratedBackgroundProcessor';

const router = Router();
const cleanInputService = new IntegratedInputService();
const backgroundProcessor = new IntegratedBackgroundProcessor();

/**
 * POST /api/input/bulk-add
 * Process bulk input with immediate response
 */
router.post('/bulk-add', async (req: Request, res: Response): Promise<void> => {
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Items array is required and cannot be empty'
      });
      return;
    }

    logger.info(`📥 BULK ADD API: Processing ${items.length} items`);

    const result = await cleanInputService.processBulkInput(items);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          processed: result.processed,
          queued: result.queued,
          batchId: result.batchId,
          processingTime: result.processingTime
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
        data: {
          processed: result.processed,
          queued: result.queued,
          errors: result.errors,
          processingTime: result.processingTime
        }
      });
    }

  } catch (error) {
    logger.error('❌ BULK ADD API ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/input/phonecheck-add
 * Process phonecheck input with immediate response
 */
router.post('/phonecheck-add', async (req: Request, res: Response): Promise<void> => {
  try {
    const { imei } = req.body;
    
    if (!imei) {
      res.status(400).json({
        success: false,
        error: 'IMEI is required'
      });
      return;
    }

    logger.info(`📱 PHONECHECK ADD API: Processing IMEI ${imei}`);

    const result = await cleanInputService.processPhonecheckInput(imei);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          imei: result.imei,
          processed: result.processed,
          queued: result.queued,
          deviceData: result.deviceData,
          processingTime: result.processingTime
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
        data: {
          imei: result.imei,
          processed: result.processed,
          queued: result.queued,
          errors: result.errors,
          processingTime: result.processingTime
        }
      });
    }

  } catch (error) {
    logger.error('❌ PHONECHECK ADD API ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/input/status/:imei
 * Get device processing status
 */
router.get('/status/:imei', async (req: Request, res: Response): Promise<void> => {
  try {
    const { imei } = req.params;
    
    if (!imei) {
      res.status(400).json({
        success: false,
        error: 'IMEI is required'
      });
      return;
    }

    const status = await backgroundProcessor.getDeviceStatus(imei);

    if (!status) {
      res.status(404).json({
        success: false,
        error: 'Device not found'
      });
      return;
    }

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('❌ STATUS API ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/input/stats
 * Get processing statistics
 */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await backgroundProcessor.getProcessingStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('❌ STATS API ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/input/retry-failed
 * Retry failed devices
 */
router.post('/retry-failed', async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('🔄 RETRY API: Retrying failed devices');

    const result = await backgroundProcessor.retryFailedDevices();

    res.json({
      success: result.success,
      message: result.success ? 'Retry completed' : 'Retry failed',
      data: {
        processed: result.processed,
        errors: result.errors,
        processingTime: result.processingTime
      }
    });

  } catch (error) {
    logger.error('❌ RETRY API ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
