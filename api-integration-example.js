
// Add this to your ImeiQueueController.addToQueue method
// After successfully adding items to queue:

// Trigger queue processing
try {
  const QueueProcessor = require('../services/QueueProcessor.js');
  const processor = new QueueProcessor();
  
  // Process in background (non-blocking)
  setImmediate(async () => {
    try {
      const result = await processor.processQueue();
      logger.info('Auto queue processing completed', { 
        processed: result.processed, 
        errors: result.errors 
      });
    } catch (error) {
      logger.error('Auto queue processing failed', { error: error.message });
    }
  });
  
} catch (error) {
  logger.error('Failed to trigger queue processing', { error: error.message });
}
