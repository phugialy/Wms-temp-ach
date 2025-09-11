import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import SynchronousWorkflowService from '../services/synchronous-workflow.service';

export class SynchronousWorkflowController {
  private static isInitialized = false;
  
  /**
   * Initialize the workflow service if not already done
   */
  private static async ensureInitialized(): Promise<void> {
    if (!SynchronousWorkflowController.isInitialized) {
      await SynchronousWorkflowService.initialize();
      SynchronousWorkflowController.isInitialized = true;
    }
  }
  
  /**
   * Complete synchronous workflow: Add → Process → SKU Match
   * User waits for the entire process to complete
   */
  async processBulkItems(req: Request, res: Response): Promise<void> {
    const startTime = performance.now();
    
    try {
      const { items } = req.body;
      
      // Validate input
      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Items array is required and cannot be empty'
        });
        return;
      }

      // Validate each item has required fields
      for (const item of items) {
        if (!item.imei) {
          res.status(400).json({
            success: false,
            error: 'Each item must have an IMEI field'
          });
          return;
        }
      }

      logger.info(`🚀 Starting synchronous workflow for ${items.length} items`);

      // Ensure service is initialized
      await SynchronousWorkflowController.ensureInitialized();

      // Run the complete workflow
      const result = await SynchronousWorkflowService.processBulkItems(items);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Log completion
      logger.info(`✅ Synchronous workflow completed in ${totalTime.toFixed(2)}ms`, {
        totalItems: result.totalItems,
        queueAdded: result.queueAdded,
        processedItems: result.processedItems,
        skuMatchedItems: result.skuMatchedItems,
        undefinedItems: result.undefinedItems,
        noMatchItems: result.noMatchItems,
        success: result.success
      });

      // Return comprehensive results
      res.status(200).json({
        success: result.success,
        summary: {
          totalItems: result.totalItems,
          queueAdded: result.queueAdded,
          processedItems: result.processedItems,
          skuMatchedItems: result.skuMatchedItems,
          undefinedItems: result.undefinedItems,
          noMatchItems: result.noMatchItems,
          processingTime: result.processingTime,
          totalTime: totalTime
        },
        errors: {
          queueErrors: result.queueErrors,
          processingErrors: result.processingErrors,
          skuMatchingErrors: result.skuMatchingErrors
        },
        results: result.results,
        message: result.success 
          ? `Successfully processed ${result.totalItems} items: ${result.skuMatchedItems} matched, ${result.undefinedItems} undefined, ${result.noMatchItems} no match in ${totalTime.toFixed(2)}ms`
          : `Workflow failed: ${result.queueErrors.join(', ')}`
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      logger.error('❌ Synchronous workflow failed:', errorMessage);
      
      res.status(500).json({
        success: false,
        error: `Workflow failed: ${errorMessage}`,
        processingTime: totalTime,
        message: 'An error occurred during the synchronous workflow'
      });
    }
  }

  /**
   * Get workflow status and statistics
   */
  async getWorkflowStatus(req: Request, res: Response): Promise<void> {
    try {
      // This could be expanded to show real-time workflow status
      res.status(200).json({
        success: true,
        message: 'Synchronous workflow service is running',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error getting workflow status:', errorMessage);
      
      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  }
}

export default new SynchronousWorkflowController();
