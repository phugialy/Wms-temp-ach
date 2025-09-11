import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import OptimizedDirectQueueService from '../services/optimized-direct-queue.service';
import { queueProcessorService } from '../services/queue-processor.service';
// const ApiProcessingLogger = require('../services/ApiProcessingLogger');

export class ImeiQueueController {
  private static isProcessing = false;
  private static processingQueue = new Set<string>();
  
  /**
   * Add items to the processing queue with chunked processing for large payloads
   */
  async addToQueue(req: Request, res: Response): Promise<void> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const { items, source = 'api' } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Items array is required and cannot be empty'
        });
        return;
      }
      
      // Log request start
      // await ApiProcessingLogger.logRequestStart(
      //   batchId, 
      //   '/api/imei-queue/bulkadd', 
      //   source, 
      //   items.length, 
      //   Math.ceil(items.length / 50)
      // );
      
      logger.info('Adding items to IMEI queue', { count: items.length, source, batchId });
      
      // Use optimized service with adaptive processing
      const queueItems = items.map(item => ({
        raw_data: item,
        source: source as 'bulk-add' | 'single-phonecheck' | 'api' | 'test'
      }));
      
      logger.info(`Processing ${items.length} items with optimized service`, { batchId });
      
      const result = await OptimizedDirectQueueService.addToQueue(queueItems);
      
      const totalAdded = result.added;
      const totalErrors = result.errors;
      
      // Safe auto-trigger queue processing
      const processingTriggered = await ImeiQueueController.safeTriggerQueueProcessing(batchId, source);
      
      // Log processing trigger
      // await ApiProcessingLogger.logProcessingTrigger(batchId, processingTriggered);
      
      const response = {
        success: totalAdded > 0,
        added: totalAdded,
        errors: totalErrors,
        chunks: result.chunks || 1,
        batch_id: batchId,
        processing_triggered: processingTriggered,
        message: `Processed ${items.length} items in ${result.chunks || 1} chunks: ${totalAdded} added${totalErrors.length > 0 ? `, ${totalErrors.length} errors` : ''}`
      };
      
      res.status(200).json(response);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in addToQueue controller', { error: errorMessage, batchId });
      
      // Log processing failure
      // await ApiProcessingLogger.logProcessingComplete(batchId, 0, 0, errorMessage);
      
      res.status(500).json({
        success: false,
        error: `Failed to add items to queue: ${errorMessage}`,
        batch_id: batchId
      });
    }
  }
  
  /**
   * Safe queue processing trigger with comprehensive logging
   */
  private static async safeTriggerQueueProcessing(batchId: string, source: string): Promise<boolean> {
    try {
      // Only trigger for bulk-add operations
      if (source !== 'bulk-add') {
        logger.info('Skipping auto-processing for non-bulk-add source', { source, batchId });
        return false;
      }
      
      // Check if already processing
      if (ImeiQueueController.isProcessing) {
        logger.info('Queue processing already in progress, skipping auto-trigger', { batchId });
        return false;
      }
      
      // Check if this batch is already queued for processing
      if (ImeiQueueController.processingQueue.has(batchId)) {
        logger.info('Batch already queued for processing', { batchId });
        return false;
      }
      
      // Add to processing queue
      ImeiQueueController.processingQueue.add(batchId);
      ImeiQueueController.isProcessing = true;
      
      logger.info('Triggering auto queue processing', { batchId });
      
      // Process in background with comprehensive error handling and logging
      setImmediate(async () => {
        let retryCount = 0;
        const maxRetries = 3;
        let finalProcessed = 0;
        let finalFailed = 0;
        let finalError = null;
        
        while (retryCount < maxRetries) {
          try {
            const QueueProcessor = require('../services/QueueProcessor.js');
            const processor = new QueueProcessor();
            
            logger.info(`Starting queue processing (attempt ${retryCount + 1}/${maxRetries})`, { batchId });
            
            const result = await processor.processQueue();
            
            finalProcessed = result.processed;
            finalFailed = result.errors;
            
            logger.info('Auto queue processing completed successfully', { 
              batchId,
              processed: result.processed, 
              errors: result.errors 
            });
            
            break; // Success, exit retry loop
            
          } catch (error) {
            retryCount++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            finalError = errorMessage;
            
            logger.error(`Auto queue processing failed (attempt ${retryCount}/${maxRetries})`, { 
              batchId,
              error: errorMessage 
            });
            
            if (retryCount < maxRetries) {
              // Exponential backoff: 5s, 10s, 15s
              const delay = 5000 * retryCount;
              logger.info(`Retrying queue processing in ${delay}ms`, { batchId });
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              logger.error('Auto queue processing failed after all retries', { 
                batchId,
                error: errorMessage 
              });
            }
          }
        }
        
        // Log final processing result
        // await ApiProcessingLogger.logProcessingComplete(
        //   batchId, 
        //   finalProcessed, 
        //   finalFailed, 
        //   finalError
        // );
        
        // Clean up
        ImeiQueueController.processingQueue.delete(batchId);
        ImeiQueueController.isProcessing = false;
        
        logger.info('Queue processing cleanup completed', { batchId });
      });
      
      return true;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error in safeTriggerQueueProcessing', { batchId, error: errorMessage });
      
      // Log processing failure
      // await ApiProcessingLogger.logProcessingComplete(batchId, 0, 0, errorMessage);
      
      // Clean up on error
      ImeiQueueController.processingQueue.delete(batchId);
      ImeiQueueController.isProcessing = false;
      
      return false;
    }
  }
  
  /**
   * Get processing status for a specific batch
   */
  async getBatchStatus(req: Request, res: Response): Promise<void> {
    try {
      const { batchId } = req.params;
      
      if (!batchId) {
        res.status(400).json({
          success: false,
          error: 'Batch ID is required'
        });
        return;
      }
      
      // const status = await ApiProcessingLogger.getBatchStatus(batchId);
      const status = null; // Temporarily disabled
      
      if (!status) {
        res.status(404).json({
          success: false,
          error: 'Batch not found'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        status,
        message: 'Batch status retrieved successfully'
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getBatchStatus', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: `Failed to get batch status: ${errorMessage}`
      });
    }
  }
  
  /**
   * Get recent processing logs
   */
  async getRecentLogs(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query['limit'] as string) || 50;
      
      // const logs = await ApiProcessingLogger.getRecentLogs(limit);
      const logs: any[] = []; // Temporarily disabled
      
      res.status(200).json({
        success: true,
        logs,
        count: logs.length,
        message: 'Recent logs retrieved successfully'
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getRecentLogs', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: `Failed to get recent logs: ${errorMessage}`
      });
    }
  }
  
  /**
   * Get processing statistics
   */
  async getProcessingStats(req: Request, res: Response): Promise<void> {
    try {
      // const stats = await ApiProcessingLogger.getProcessingStats();
      const stats = null; // Temporarily disabled
      
      res.status(200).json({
        success: true,
        stats,
        message: 'Processing statistics retrieved successfully'
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getProcessingStats', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: `Failed to get processing statistics: ${errorMessage}`
      });
    }
  }
  
  /**
   * Get queue statistics
   */
  async getQueueStats(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Getting queue statistics');
      
      const stats = await OptimizedDirectQueueService.getQueueStats();
      
      res.status(200).json({
        success: true,
        data: stats,
        message: 'Queue statistics retrieved successfully'
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getQueueStats controller', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: `Failed to get queue statistics: ${errorMessage}`
      });
    }
  }
  
  /**
   * Get queue items by status
   */
  async getQueueItems(req: Request, res: Response): Promise<void> {
    try {
      const { status, limit = 100 } = req.query;
      
      logger.info('Getting queue items', { status, limit });
      
      const items = await OptimizedDirectQueueService.getQueueItems(
        status as string | undefined,
        Number(limit)
      );
      
      res.status(200).json({
        success: true,
        data: items,
        count: items.length,
        message: 'Queue items retrieved successfully'
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getQueueItems controller', { error: errorMessage, query: req.query });
      
      res.status(500).json({
        success: false,
        error: `Failed to get queue items: ${errorMessage}`
      });
    }
  }
  
  /**
   * Process all pending queue items using JavaScript-based processor
   */
  async processAllPending(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Processing all pending queue items using JavaScript processor');
      console.log('🚀 Controller: Starting queue processing...');
      
      const result = await queueProcessorService.processPendingItems();
      console.log('✅ Controller: Queue processing completed:', result);
      
      res.status(200).json({
        success: true,
        data: { processed: result.processed },
        message: `Processed ${result.processed} items${result.errors.length > 0 ? ` with ${result.errors.length} errors` : ''}`
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in processAllPending controller', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: `Failed to process pending items: ${errorMessage}`
      });
    }
  }
  
  /**
   * Retry failed queue items
   */
  async retryFailedItems(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Retrying failed queue items');
      
      const result = await OptimizedDirectQueueService.retryFailedItems();
      
      res.status(200).json({
        success: true,
        data: result,
        message: `Retried ${result.retried} items`
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in retryFailedItems controller', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: `Failed to retry failed items: ${errorMessage}`
      });
    }
  }
  
  /**
   * Clear completed queue items
   */
  async clearCompletedItems(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Clearing completed queue items');
      
      const result = await OptimizedDirectQueueService.clearCompletedItems();
      
      res.status(200).json({
        success: true,
        data: result,
        message: `Cleared ${result.cleared} completed items`
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in clearCompletedItems controller', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: `Failed to clear completed items: ${errorMessage}`
      });
    }
  }
  
  /**
   * Get IMEI data by specific IMEI
   */
  async getImeiData(req: Request, res: Response): Promise<void> {
    try {
      const { imei } = req.params;
      
      if (!imei) {
        res.status(400).json({
          success: false,
          error: 'IMEI parameter is required'
        });
        return;
      }
      
      logger.info('Getting IMEI data', { imei });
      
      // TODO: Implement getImeiData with DirectQueueService
      const data = null; // await DirectQueueService.getImeiData(imei);
      
      res.status(200).json({
        success: true,
        data,
        message: data ? 'IMEI data retrieved successfully' : 'IMEI not found'
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getImeiData controller', { error: errorMessage, params: req.params });
      
      res.status(500).json({
        success: false,
        error: `Failed to get IMEI data: ${errorMessage}`
      });
    }
  }
  
  /**
   * Get all IMEI data
   */
  async getAllImeiData(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Getting all IMEI data');
      
      // TODO: Implement getAllImeiData with DirectQueueService
      const data: any[] = []; // await DirectQueueService.getAllImeiData();
      
      res.status(200).json({
        success: true,
        data,
        count: data.length,
        message: 'All IMEI data retrieved successfully'
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getAllImeiData controller', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: `Failed to get all IMEI data: ${errorMessage}`
      });
    }
  }
}

export default new ImeiQueueController();
