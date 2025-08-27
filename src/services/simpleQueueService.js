const { EventEmitter } = require('events');
const { logger } = require('../utils/logger');
const prisma = require('../prisma/client');

class SimpleQueue extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    this.queue = [];
    this.processing = false;
    this.maxRetries = 3;
  }

  async add(jobData, options = {}) {
    const job = {
      id: Date.now() + Math.random(),
      data: jobData,
      priority: options.priority || 5,
      retries: 0,
      maxRetries: options.maxRetries || this.maxRetries,
      createdAt: new Date(),
      ...options
    };

    // Add to database queue
    try {
      const queueItem = await prisma.dataQueue.create({
        data: {
          raw_data: jobData,
          source: jobData.source || 'unknown',
          batch_id: jobData.batchId,
          priority: job.priority,
          status: 'pending'
        }
      });
      
      job.queueItemId = queueItem.id;
      this.queue.push(job);
      
      // Sort by priority (lower number = higher priority)
      this.queue.sort((a, b) => a.priority - b.priority);
      
      logger.info(`Added job to ${this.name} queue: ${job.id}`);
      this.emit('jobAdded', job);
      
      // Start processing if not already running
      if (!this.processing) {
        this.process();
      }
      
      return job;
    } catch (error) {
      logger.error(`Failed to add job to queue: ${error.message}`);
      throw error;
    }
  }

  async process() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      
      try {
        // Update status to processing
        if (job.queueItemId) {
          await prisma.dataQueue.update({
            where: { id: job.queueItemId },
            data: { status: 'processing' }
          });
        }

        logger.info(`Processing job ${job.id} from ${this.name} queue`);
        
        // Emit job event for processing
        this.emit('job', job);
        
        // Wait a bit to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        logger.error(`Error processing job ${job.id}: ${error.message}`);
        
        // Handle retries
        if (job.retries < job.maxRetries) {
          job.retries++;
          this.queue.unshift(job); // Put back at front of queue
          logger.info(`Retrying job ${job.id} (attempt ${job.retries}/${job.maxRetries})`);
        } else {
          // Mark as failed
          if (job.queueItemId) {
            await prisma.dataQueue.update({
              where: { id: job.queueItemId },
              data: { 
                status: 'failed',
                error_message: error.message
              }
            });
          }
          logger.error(`Job ${job.id} failed after ${job.maxRetries} retries`);
        }
      }
    }
    
    this.processing = false;
    logger.info(`${this.name} queue processing completed`);
  }

  async getStats() {
    const stats = await prisma.dataQueue.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });
    
    return {
      queueName: this.name,
      queueLength: this.queue.length,
      isProcessing: this.processing,
      statusCounts: stats.reduce((acc, stat) => {
        acc[stat.status] = stat._count.status;
        return acc;
      }, {})
    };
  }
}

// Create queue instances
const bulkDataQueue = new SimpleQueue('bulk-data-processing');
const phonecheckQueue = new SimpleQueue('phonecheck-data-processing');
const dataEnrichmentQueue = new SimpleQueue('data-enrichment');

// Export queue functions
module.exports = {
  QUEUE_NAMES: {
    BULK_DATA_PROCESSING: 'bulk-data-processing',
    PHONECHECK_DATA_PROCESSING: 'phonecheck-data-processing',
    DATA_ENRICHMENT: 'data-enrichment'
  },

  async addBulkDataToQueue(jobData) {
    return await bulkDataQueue.add(jobData, { 
      priority: jobData.priority || 5,
      maxRetries: 3
    });
  },

  async addPhoneCheckToQueue(jobData) {
    return await phonecheckQueue.add(jobData, { 
      priority: jobData.priority || 3,
      maxRetries: 2
    });
  },

  async addDataEnrichmentToQueue(jobData) {
    return await dataEnrichmentQueue.add(jobData, { 
      priority: jobData.priority || 1,
      maxRetries: 1
    });
  },

  async getQueueStats() {
    const [bulkStats, phonecheckStats, enrichmentStats] = await Promise.all([
      bulkDataQueue.getStats(),
      phonecheckQueue.getStats(),
      dataEnrichmentQueue.getStats()
    ]);
    
    return {
      bulkData: bulkStats,
      phonecheck: phonecheckStats,
      dataEnrichment: enrichmentStats
    };
  },

  // Get queue instances for event listeners
  getBulkDataQueue() { return bulkDataQueue; },
  getPhoneCheckQueue() { return phonecheckQueue; },
  getDataEnrichmentQueue() { return dataEnrichmentQueue; }
};
