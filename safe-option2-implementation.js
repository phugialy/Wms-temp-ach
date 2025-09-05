// Safe Option 2 Implementation for ImeiQueueController
// Add this to your existing addToQueue method

export class ImeiQueueController {
  // Add static processing lock
  private static isProcessing = false;
  private static processingQueue = new Set<string>(); // Track processing batches
  
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
      const CHUNK_SIZE = 50;
      const chunks = [];
      
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        chunks.push(items.slice(i, i + CHUNK_SIZE));
      }
      
      let totalAdded = 0;
      let totalErrors: string[] = [];
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
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
      
      // Safe auto-trigger queue processing
      const processingTriggered = await this.safeTriggerQueueProcessing(batchId, source);
      
      res.status(200).json({
        success: totalAdded > 0,
        added: totalAdded,
        errors: totalErrors,
        chunks: chunks.length,
        batch_id: batchId,
        processing_triggered: processingTriggered,
        message: `Processed ${items.length} items in ${chunks.length} chunks: ${totalAdded} added${totalErrors.length > 0 ? `, ${totalErrors.length} errors` : ''}`
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in addToQueue controller', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: `Failed to add items to queue: ${errorMessage}`
      });
    }
  }
  
  /**
   * Safe queue processing trigger with conflict prevention
   */
  private async safeTriggerQueueProcessing(batchId: string, source: string): Promise<boolean> {
    try {
      // Only trigger for bulk-add operations
      if (source !== 'bulk-add') {
        logger.info('Skipping auto-processing for non-bulk-add source', { source });
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
      
      // Process in background with error handling
      setImmediate(async () => {
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            const QueueProcessor = require('../services/QueueProcessor.js');
            const processor = new QueueProcessor();
            
            logger.info(`Starting queue processing (attempt ${retryCount + 1}/${maxRetries})`, { batchId });
            
            const result = await processor.processQueue();
            
            logger.info('Auto queue processing completed successfully', { 
              batchId,
              processed: result.processed, 
              errors: result.errors 
            });
            
            break; // Success, exit retry loop
            
          } catch (error) {
            retryCount++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
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
              
              // Could add to a failed processing queue here for manual intervention
              // await this.addToFailedProcessingQueue(batchId, errorMessage);
            }
          }
        }
        
        // Clean up
        ImeiQueueController.processingQueue.delete(batchId);
        ImeiQueueController.isProcessing = false;
        
        logger.info('Queue processing cleanup completed', { batchId });
      });
      
      return true;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error in safeTriggerQueueProcessing', { batchId, error: errorMessage });
      
      // Clean up on error
      ImeiQueueController.processingQueue.delete(batchId);
      ImeiQueueController.isProcessing = false;
      
      return false;
    }
  }
  
  /**
   * Get processing status (for monitoring)
   */
  async getProcessingStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = {
        is_processing: ImeiQueueController.isProcessing,
        queued_batches: Array.from(ImeiQueueController.processingQueue),
        queue_count: ImeiQueueController.processingQueue.size
      };
      
      res.status(200).json({
        success: true,
        status,
        message: 'Processing status retrieved successfully'
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getProcessingStatus', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: `Failed to get processing status: ${errorMessage}`
      });
    }
  }
  
  /**
   * Manual queue processing trigger (for admin use)
   */
  async triggerManualProcessing(req: Request, res: Response): Promise<void> {
    try {
      if (ImeiQueueController.isProcessing) {
        res.status(409).json({
          success: false,
          error: 'Queue processing already in progress'
        });
        return;
      }
      
      const batchId = `manual_${Date.now()}`;
      const triggered = await this.safeTriggerQueueProcessing(batchId, 'manual');
      
      res.status(200).json({
        success: triggered,
        batch_id: batchId,
        message: triggered ? 'Manual processing triggered successfully' : 'Failed to trigger manual processing'
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in triggerManualProcessing', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: `Failed to trigger manual processing: ${errorMessage}`
      });
    }
  }
}

export default new ImeiQueueController();


