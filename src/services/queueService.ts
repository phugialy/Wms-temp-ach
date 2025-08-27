import Queue from 'bull';
import { logger } from '../utils/logger';
import prisma from '../prisma/client';

// Queue names
export const QUEUE_NAMES = {
  BULK_DATA_PROCESSING: 'bulk-data-processing',
  PHONECHECK_DATA_PROCESSING: 'phonecheck-data-processing',
  DATA_ENRICHMENT: 'data-enrichment'
};

// Create queues
const bulkDataQueue = new Queue(QUEUE_NAMES.BULK_DATA_PROCESSING, {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  }
});

const phonecheckQueue = new Queue(QUEUE_NAMES.PHONECHECK_DATA_PROCESSING, {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  }
});

const dataEnrichmentQueue = new Queue(QUEUE_NAMES.DATA_ENRICHMENT, {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  }
});

// Queue interfaces
export interface BulkDataJob {
  batchId: string;
  data: any[];
  source: 'bulk-add' | 'phonecheck-api';
  priority?: number;
}

export interface PhoneCheckJob {
  imei: string;
  priority?: number;
}

export interface DataEnrichmentJob {
  imei: string;
  existingData: any;
  priority?: number;
}

// Add bulk data to queue
export async function addBulkDataToQueue(jobData: BulkDataJob): Promise<void> {
  try {
    // First, save to database queue table
    const queueItem = await prisma.dataQueue.create({
      data: {
        raw_data: jobData.data,
        source: jobData.source,
        batch_id: jobData.batchId,
        priority: jobData.priority || 5,
        status: 'pending'
      }
    });

    // Add to Redis queue for processing
    await bulkDataQueue.add('process-bulk-data', {
      queueItemId: queueItem.id,
      ...jobData
    }, {
      priority: jobData.priority || 5,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });

    logger.info(`Added bulk data to queue: ${jobData.batchId} with ${jobData.data.length} items`);
  } catch (error) {
    logger.error('Error adding bulk data to queue:', error);
    throw error;
  }
}

// Add PhoneCheck data to queue
export async function addPhoneCheckToQueue(jobData: PhoneCheckJob): Promise<void> {
  try {
    await phonecheckQueue.add('process-phonecheck', jobData, {
      priority: jobData.priority || 5,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });

    logger.info(`Added PhoneCheck job to queue: ${jobData.imei}`);
  } catch (error) {
    logger.error('Error adding PhoneCheck to queue:', error);
    throw error;
  }
}

// Add data enrichment to queue
export async function addDataEnrichmentToQueue(jobData: DataEnrichmentJob): Promise<void> {
  try {
    await dataEnrichmentQueue.add('enrich-data', jobData, {
      priority: jobData.priority || 5,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });

    logger.info(`Added data enrichment job to queue: ${jobData.imei}`);
  } catch (error) {
    logger.error('Error adding data enrichment to queue:', error);
    throw error;
  }
}

// Get queue statistics
export async function getQueueStats() {
  try {
    const [bulkWaiting, bulkActive, bulkCompleted, bulkFailed] = await Promise.all([
      bulkDataQueue.getWaiting(),
      bulkDataQueue.getActive(),
      bulkDataQueue.getCompleted(),
      bulkDataQueue.getFailed()
    ]);

    const [phonecheckWaiting, phonecheckActive, phonecheckCompleted, phonecheckFailed] = await Promise.all([
      phonecheckQueue.getWaiting(),
      phonecheckQueue.getActive(),
      phonecheckQueue.getCompleted(),
      phonecheckQueue.getFailed()
    ]);

    return {
      bulkData: {
        waiting: bulkWaiting.length,
        active: bulkActive.length,
        completed: bulkCompleted.length,
        failed: bulkFailed.length
      },
      phonecheck: {
        waiting: phonecheckWaiting.length,
        active: phonecheckActive.length,
        completed: phonecheckCompleted.length,
        failed: phonecheckFailed.length
      }
    };
  } catch (error) {
    logger.error('Error getting queue stats:', error);
    throw error;
  }
}

// Clean completed jobs
export async function cleanCompletedJobs(): Promise<void> {
  try {
    await Promise.all([
      bulkDataQueue.clean(24 * 60 * 60 * 1000, 'completed'), // 24 hours
      bulkDataQueue.clean(24 * 60 * 60 * 1000, 'failed'),    // 24 hours
      phonecheckQueue.clean(24 * 60 * 60 * 1000, 'completed'),
      phonecheckQueue.clean(24 * 60 * 60 * 1000, 'failed'),
      dataEnrichmentQueue.clean(24 * 60 * 60 * 1000, 'completed'),
      dataEnrichmentQueue.clean(24 * 60 * 60 * 1000, 'failed')
    ]);

    logger.info('Cleaned completed jobs from queues');
  } catch (error) {
    logger.error('Error cleaning completed jobs:', error);
    throw error;
  }
}

// Graceful shutdown
export async function shutdownQueues(): Promise<void> {
  try {
    await Promise.all([
      bulkDataQueue.close(),
      phonecheckQueue.close(),
      dataEnrichmentQueue.close()
    ]);
    logger.info('All queues shut down gracefully');
  } catch (error) {
    logger.error('Error shutting down queues:', error);
    throw error;
  }
}

export {
  bulkDataQueue,
  phonecheckQueue,
  dataEnrichmentQueue
};
