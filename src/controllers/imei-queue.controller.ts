import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import ImeiQueueService from '../services/imei-queue.service';
import { queueProcessorService } from '../services/queue-processor.service';

export class ImeiQueueController {
  
  /**
   * Add items to the processing queue with chunked processing for large payloads
   */
  async addToQueue(req: Request, res: Response): Promise<void> {
    try {
      const { items, source = 'api' } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Items array is required and cannot be empty'
        });
        return;
      }
      
      logger.info('Adding items to IMEI queue', { count: items.length, source });
      
      // Process items in chunks to handle large payloads
      const CHUNK_SIZE = 50; // Process 50 items at a time
      const chunks = [];
      
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        chunks.push(items.slice(i, i + CHUNK_SIZE));
      }
      
      logger.info(`Processing ${items.length} items in ${chunks.length} chunks`);
      
      let totalAdded = 0;
      let totalErrors: string[] = [];
      
      // Process each chunk
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        
        if (!chunk) continue;
        
        try {
          const queueItems = chunk.map(item => ({
            raw_data: item
          }));
          
          const result = await ImeiQueueService.addToQueue(queueItems);
          
          totalAdded += result.added;
          totalErrors.push(...result.errors);
          
          logger.info(`Chunk ${chunkIndex + 1}/${chunks.length} processed`, { 
            added: result.added, 
            errors: result.errors.length 
          });
          
          // Small delay between chunks to prevent overwhelming the database
          if (chunkIndex < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
        } catch (chunkError) {
          const errorMessage = chunkError instanceof Error ? chunkError.message : 'Unknown chunk error';
          logger.error(`Error processing chunk ${chunkIndex + 1}`, { error: errorMessage });
          totalErrors.push(`Chunk ${chunkIndex + 1}: ${errorMessage}`);
        }
      }
      
      res.status(200).json({
        success: totalAdded > 0,
        added: totalAdded,
        errors: totalErrors,
        chunks: chunks.length,
        message: `Processed ${items.length} items in ${chunks.length} chunks: ${totalAdded} added${totalErrors.length > 0 ? `, ${totalErrors.length} errors` : ''}`
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in addToQueue controller', { error: errorMessage, body: req.body });
      
      res.status(500).json({
        success: false,
        error: `Failed to add items to queue: ${errorMessage}`
      });
    }
  }
  
  /**
   * Get queue statistics
   */
  async getQueueStats(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Getting queue statistics');
      
      const stats = await ImeiQueueService.getQueueStats();
      
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
      
      const items = await ImeiQueueService.getQueueItems(
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
      
      const result = await ImeiQueueService.retryFailedItems();
      
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
      
      const result = await ImeiQueueService.clearCompletedItems();
      
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
      
      const data = await ImeiQueueService.getImeiData(imei);
      
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
      
      const data = await ImeiQueueService.getAllImeiData();
      
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
