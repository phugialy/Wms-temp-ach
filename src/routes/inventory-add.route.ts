import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import SimpleInventoryService, { InventoryItem } from '../services/SimpleInventoryService';

const router = Router();
const inventoryService = new SimpleInventoryService();

/**
 * POST /api/inventory/add-item
 * Add single item to inventory - IMEI-centric approach
 */
router.post('/add-item', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const { 
      imei, brand, model, capacity, color, carrier, 
      working_status, battery_health, location, notes 
    } = req.body;
    
    if (!imei) {
      res.status(400).json({
        success: false,
        error: 'IMEI is required',
        processingTime: Date.now() - startTime
      });
      return;
    }

    const item: InventoryItem = {
      imei,
      brand,
      model,
      capacity,
      color,
      carrier,
      working_status,
      battery_health,
      location,
      notes
    };

    logger.info(`📦 INVENTORY ADD: Adding IMEI ${imei}`);

    const result = await inventoryService.addItemToInventory(item);

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
    logger.error('❌ INVENTORY ADD ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
      processingTime: Date.now() - startTime
    });
  }
});

/**
 * POST /api/inventory/bulk-add
 * Bulk add items to inventory
 */
router.post('/bulk-add', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const { items, station, location } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Items array is required and must not be empty',
        processingTime: Date.now() - startTime
      });
      return;
    }

    // Enhanced logging for bulk-add operation
    logger.info(`📦 BULK INVENTORY ADD: Starting bulk operation with ${items.length} items`);
    logger.info(`📦 BULK INVENTORY ADD: Station: ${station}, Location: ${location}`);
    
    // Log sample item structure for debugging
    if (items.length > 0) {
      logger.info(`📦 Sample item structure:`, JSON.stringify(items[0], null, 2));
      logger.info(`📦 Sample item validation check:`, {
        hasImei: !!items[0].imei,
        hasBrand: !!items[0].brand,
        hasModel: !!items[0].model,
        imeiValue: items[0].imei,
        brandValue: items[0].brand,
        modelValue: items[0].model,
        workingStatus: items[0].working_status
      });
    }

    const result = await inventoryService.bulkAddItems(items, station, location);
    
    // Log the result summary
    logger.info(`📦 BULK INVENTORY ADD RESULT:`, {
      success: result.success,
      totalItems: result.totalItems,
      processedItems: result.processedItems,
      failedItems: result.failedItems,
      processingTime: result.processingTime,
      message: result.message,
      errorCount: result.errors?.length || 0
    });
    
    // Log first few errors if any
    if (result.errors && result.errors.length > 0) {
      logger.warn(`📦 BULK INVENTORY ADD ERRORS (showing first 3):`, result.errors.slice(0, 3));
    }

    res.json({
      success: result.success,
      data: {
        totalItems: result.totalItems,
        processedItems: result.processedItems,
        failedItems: result.failedItems,
        processingTime: result.processingTime,
        message: result.message,
        errors: result.errors,
        sessionId: result.sessionId
      },
      processingTime: Date.now() - startTime
    });

  } catch (error) {
    logger.error('❌ BULK INVENTORY ADD ERROR:', error);
    logger.error('❌ Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      itemsCount: req.body?.items?.length || 0,
      sampleItem: req.body?.items?.[0] || null
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
      processingTime: Date.now() - startTime
    });
  }
});

/**
 * GET /api/inventory/stats
 * Get inventory statistics
 */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const stats = await inventoryService.getInventoryStats();

    if (stats) {
      res.json({
        success: true,
        data: stats,
        processingTime: Date.now() - startTime
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to get inventory stats',
        processingTime: Date.now() - startTime
      });
    }

  } catch (error) {
    logger.error('❌ INVENTORY STATS ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
      processingTime: Date.now() - startTime
    });
  }
});

/**
 * GET /api/inventory/health
 * Health check
 */
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    res.json({
      success: true,
      status: 'healthy',
      data: {
        app: 'Simple Inventory Service',
        version: '1.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage()
      },
      processingTime: Date.now() - startTime
    });

  } catch (error) {
    logger.error('❌ INVENTORY HEALTH ERROR:', error);
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


