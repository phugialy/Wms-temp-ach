import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import BulkInventoryService from '../services/bulk-inventory.service';
import { inventoryPushSchema } from '../utils/validator';

export class BulkInventoryController {
  // Process multiple items in batches
  async processBulkItems(req: Request, res: Response) {
    try {
      const { items, batchSize = 5 } = req.body;

      if (!items || !Array.isArray(items)) {
        return res.status(400).json({
          success: false,
          error: 'Items array is required'
        });
      }

      if (items.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Items array cannot be empty'
        });
      }

      logger.info(`📥 Bulk inventory request received: ${items.length} items`);

      // Validate each item
      const validItems = [];
      const invalidItems = [];

      for (let i = 0; i < items.length; i++) {
        try {
          const validatedItem = inventoryPushSchema.parse(items[i]);
          validItems.push(validatedItem);
        } catch (error) {
          logger.warn(`⚠️  Item ${i + 1} validation failed:`, error);
          invalidItems.push({
            index: i,
            item: items[i],
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      if (validItems.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid items found',
          invalidItems
        });
      }

      logger.info(`✅ Validation complete: ${validItems.length} valid, ${invalidItems.length} invalid`);

      // Process valid items in batches
      const results = await BulkInventoryService.processBulkItems(validItems, batchSize);

      // Prepare response
      const response = {
        success: true,
        summary: {
          totalRequested: items.length,
          validItems: validItems.length,
          invalidItems: invalidItems.length,
          successful: results.successful,
          failed: results.failed
        },
        results: {
          successful: results.items,
          failed: results.failed > 0 ? `Failed to process ${results.failed} items` : null
        },
        invalidItems: invalidItems.length > 0 ? invalidItems : undefined
      };

      logger.info(`🎉 Bulk processing completed: ${results.successful}/${validItems.length} successful`);
      
      return res.status(200).json(response);

    } catch (error) {
      logger.error('❌ Bulk inventory processing error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error during bulk processing',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Get bulk processing status
  async getBulkStatus(req: Request, res: Response) {
    try {
      // This could be used to track ongoing bulk operations
      return res.status(200).json({
        success: true,
        message: 'Bulk processing service is available',
        features: [
          'Batch processing',
          'Automatic validation',
          'Duplicate detection',
          'Error handling',
          'Progress tracking'
        ]
      });
    } catch (error) {
      logger.error('❌ Error getting bulk status:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

export default new BulkInventoryController();
