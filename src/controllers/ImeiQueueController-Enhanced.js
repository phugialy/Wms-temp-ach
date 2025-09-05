
import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import DirectQueueService from '../services/direct-queue.service';
import ApiProcessingLogger from '../services/ApiProcessingLogger';

export class ImeiQueueController {
  private static isProcessing = false;
  private static processingQueue = new Set<string>();
  
  async addToQueue(req: Request, res: Response): Promise<void> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
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
      await ApiProcessingLogger.logRequestStart(
        batchId, 
        '/api/imei-queue/bulkadd', 
        source, 
        items.length, 
        Math.ceil(items.length / 50)
      );
      
      logger.info('Adding items to IMEI queue', { count: items.length, source, batchId });
      
      // Process items in chunks
      const CHUNK_SIZE = 50;
      const chunks = [];
      
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        chunks.push(items.slice(i, i + CHUNK_SIZE));
      }
      
      let totalAdded = 0;
      let totalErrors: string[] = [];
      
      // Process each chunk
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        
        if (!chunk) continue;
        
        try {
          const queueItems = chunk.map(item => ({
            raw_data: item,
            source: source as 'bulk-add' | 'single-phonecheck' | 'api' | 'test'
          }));
          
          const result = await DirectQueueService.addToQueue(queueItems);
          
          totalAdded += result.added;
          totalErrors.push(...result.errors);
          
          logger.info(`Chunk ${chunkIndex + 1}/${chunks.length} processed`, { 
            added: result.added, 
            errors: result.errors.length,
            batchId
          });
          
          // Small delay between chunks
          if (chunkIndex < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
        } catch (chunkError) {
          const errorMessage = chunkError instanceof Error ? chunkError.message : 'Unknown chunk error';
          logger.error(`Error processing chunk ${chunkIndex + 1}`, { error: errorMessage, batchId });
          totalErrors.push(`Chunk ${chunkIndex + 1}: ${errorMessage}`);
        }
      }
      
      // Safe auto-trigger queue processing
      const processingTriggered = await this.safeTriggerQueueProcessing(batchId, source);
      
      // Log processing trigger
      await ApiProcessingLogger.logProcessingTrigger(batchId, processingTriggered);
      
      const response = {
        success: totalAdded > 0,
        added: totalAdded,
        errors: totalErrors,
        chunks: chunks.length,
        batch_id: batchId,
        processing_triggered: processingTriggered,
        message: `Processed ${items.length} items in ${chunks.length} chunks: ${totalAdded} added${totalErrors.length > 0 ? `, ${totalErrors.length} errors` : ''}`
      };
      
      res.status(200).json(response);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in addToQueue controller', { error: errorMessage, batchId });
      
      // Log processing failure
      await ApiProcessingLogger.logProcessingComplete(batchId, 0, 0, errorMessage);
      
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
  private async safeTriggerQueueProcessing(batchId: string, source: string): Promise<boolean> {
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
        await ApiProcessingLogger.logProcessingComplete(
          batchId, 
          finalProcessed, 
          finalFailed, 
          finalError
        );
        
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
      await ApiProcessingLogger.logProcessingComplete(batchId, 0, 0, errorMessage);
      
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
      
      const status = await ApiProcessingLogger.getBatchStatus(batchId);
      
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
      const limit = parseInt(req.query.limit as string) || 50;
      
      const logs = await ApiProcessingLogger.getRecentLogs(limit);
      
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
      const stats = await ApiProcessingLogger.getProcessingStats();
      
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
}

export default new ImeiQueueController();
