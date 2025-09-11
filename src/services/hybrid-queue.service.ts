import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
const supabase = createClient(
  process.env['SUPABASE_URL']!,
  process.env['SUPABASE_API_KEY']!
);

export interface QueueItem {
  id: number;
  rawData: any;
  status: string;
  priority: number;
  retryCount: number;
  maxRetries: number;
  source?: string;
  batchId?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
}

export interface ProcessResult {
  success: boolean;
  processed: number;
  errors: string[];
  message: string;
}

export interface QueueStats {
  totalItems: number;
  pendingItems: number;
  processingItems: number;
  completedItems: number;
  failedItems: number;
  avgProcessingTime?: string;
  oldestPendingItem?: Date;
}

export interface BatchResult {
  batchId: string;
  totalItems: number;
  processed: number;
  errors: string[];
  processingTime: number;
}

/**
 * Hybrid Queue Service - Uses Prisma for type safety and SQL functions for processing
 * Combines the best of both worlds: schema-driven structure with efficient SQL operations
 */
export class HybridQueueService {
  private isProcessing: boolean = false;
  private processingInterval: number = 1000; // 1 second between items

  /**
   * Add raw data to queue using Prisma (type-safe)
   */
  async addToQueue(items: any[], source: string = 'bulk-add', priority: number = 5): Promise<ProcessResult> {
    try {
      logger.info(`Adding ${items.length} items to queue from ${source}`);
      
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // TODO: Create batch tracking record when queueBatch model is available
      logger.info(`Batch ${batchId} created for ${items.length} items from ${source}`);

      // Prepare queue items using Prisma
      const queueItems = items.map(item => ({
        rawData: item,
        status: 'pending',
        priority,
        retryCount: 0,
        maxRetries: 3,
        source,
        batchId
      }));

      // Insert using Prisma for type safety
      const createdItems = await prisma.dataQueue.createMany({
        data: queueItems
      });

      logger.info(`Successfully added ${createdItems.count} items to queue with batch ID: ${batchId}`);

      // Start processing if not already running
      if (!this.isProcessing) {
        this.startProcessing();
      }

      return {
        success: true,
        processed: 0,
        errors: [],
        message: `Added ${items.length} items to queue. Processing started.`
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error adding items to queue:', errorMessage);
      
      return {
        success: false,
        processed: 0,
        errors: [errorMessage],
        message: `Failed to add items to queue: ${errorMessage}`
      };
    }
  }

  /**
   * Get next item to process using SQL function (efficient)
   */
  async getNextItem(): Promise<QueueItem | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_next_queue_item');

      if (error) {
        logger.error('Error getting next queue item:', error.message);
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      const item = data[0];
      return {
        id: item.id,
        rawData: item.raw_data,
        status: item.status,
        priority: item.priority,
        retryCount: item.retry_count,
        maxRetries: item.max_retries,
        source: item.source,
        batchId: item.batch_id,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
        processedAt: item.processed_at ? new Date(item.processed_at) : undefined
      };
    } catch (error) {
      logger.error('Error getting next queue item:', error);
      return null;
    }
  }

  /**
   * Mark item as processing using SQL function
   */
  async markAsProcessing(itemId: number): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('mark_queue_item_processing', { item_id: itemId });

      if (error) {
        logger.error('Error marking item as processing:', error.message);
        return false;
      }

      // Log the action using Prisma
      await prisma.queueProcessingLog.create({
        data: {
          queueItemId: itemId,
          action: 'processing',
          message: 'Item marked as processing'
        }
      });

      return data || false;
    } catch (error) {
      logger.error('Error marking item as processing:', error);
      return false;
    }
  }

  /**
   * Mark item as completed using SQL function
   */
  async markAsCompleted(itemId: number): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('mark_queue_item_completed', { item_id: itemId });

      if (error) {
        logger.error('Error marking item as completed:', error.message);
        return false;
      }

      // Log the action using Prisma
      await prisma.queueProcessingLog.create({
        data: {
          queueItemId: itemId,
          action: 'completed',
          message: 'Item processed successfully'
        }
      });

      return data || false;
    } catch (error) {
      logger.error('Error marking item as completed:', error);
      return false;
    }
  }

  /**
   * Mark item as failed using SQL function
   */
  async markAsFailed(itemId: number, errorMessage: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('mark_queue_item_failed', { 
          item_id: itemId, 
          error_msg: errorMessage 
        });

      if (error) {
        logger.error('Error marking item as failed:', error.message);
        return false;
      }

      // Log the action using Prisma
      await prisma.queueProcessingLog.create({
        data: {
          queueItemId: itemId,
          action: 'failed',
          error: errorMessage
        }
      });

      return data || false;
    } catch (error) {
      logger.error('Error marking item as failed:', error);
      return false;
    }
  }

  /**
   * Process the next item in the queue
   */
  async processNextItem(): Promise<ProcessResult> {
    try {
      const nextItem = await this.getNextItem();
      
      if (!nextItem) {
        return {
          success: true,
          processed: 0,
          errors: [],
          message: 'No items to process'
        };
      }

      const success = await this.processSingleItem(nextItem);
      
      return {
        success: true,
        processed: success ? 1 : 0,
        errors: success ? [] : [`Failed to process item ${nextItem.id}`],
        message: success ? `Successfully processed item ${nextItem.id}` : `Failed to process item ${nextItem.id}`
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error in processNextItem:', error);
      
      return {
        success: false,
        processed: 0,
        errors: [errorMessage],
        message: 'Error processing next item'
      };
    }
  }

  /**
   * Process a single item using hybrid approach
   */
  async processSingleItem(item: QueueItem): Promise<boolean> {
    try {
      logger.info(`Processing item ${item.id} (IMEI: ${item.rawData.imei || item.rawData.IMEI})`);
      
      // Mark as processing
      const processingMarked = await this.markAsProcessing(item.id);
      if (!processingMarked) {
        logger.warn(`Could not mark item ${item.id} as processing`);
        return false;
      }

      // Process the item using Prisma for data operations
      const success = await this.processItemData(item);
      
      if (success) {
        await this.markAsCompleted(item.id);
        logger.info(`Successfully processed item ${item.id}`);
        return true;
      } else {
        await this.markAsFailed(item.id, 'Processing failed');
        logger.error(`Failed to process item ${item.id}`);
        return false;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.markAsFailed(item.id, errorMessage);
      logger.error(`Error processing item ${item.id}:`, errorMessage);
      return false;
    }
  }

  /**
   * Process item data using Prisma (type-safe operations)
   */
  private async processItemData(item: QueueItem): Promise<boolean> {
    try {
      const rawData = item.rawData;
      
      // Extract data with fallbacks
      const imei = rawData.imei || rawData.IMEI || rawData.serialNumber || `UNKNOWN_${Date.now()}`;
      const name = rawData.name || rawData.deviceName || rawData.model || 'Unknown Device';
      const brand = rawData.brand || rawData.manufacturer || 'Unknown';
      const model = rawData.model || rawData.deviceModel || 'Unknown Model';
      const storage = rawData.storage || rawData.capacity || 'Unknown';
      const color = rawData.color || rawData.deviceColor || 'Unknown';
      const carrier = rawData.carrier || rawData.network || 'Unlocked';
      const location = rawData.location || 'Default Location';
      const working = rawData.working || rawData.status || 'PENDING';
      const failed = rawData.failed || rawData.defects || 'NO';
      const batteryHealth = rawData.batteryHealth || rawData.battery || null;
      const screenCondition = rawData.screenCondition || rawData.screen || 'Unknown';
      const bodyCondition = rawData.bodyCondition || rawData.condition || 'Unknown';
      const notes = rawData.notes || rawData.comments || '';
      const quantity = rawData.quantity || 1;

      // Validate required fields
      if (!imei || imei === 'UNKNOWN_') {
        throw new Error('Missing IMEI - this is the only required field');
      }

      // Generate SKU
      const sku = rawData.sku || `${brand.substring(0, 3).toUpperCase()}${model.substring(0, 3).toUpperCase()}`.replace(/\s+/g, '').substring(0, 15);

      // TODO: Implement when location model is available
      logger.info(`Location: ${location}`);

      // Create or update Item using Prisma
      let itemRecord = await prisma.item.findUnique({
        where: { imei }
      });

      const itemData = {
        model: model,
        capacity: storage,
        color: color,
        carrier: carrier,
        working: working === 'YES' ? 'PASSED' : working === 'NO' ? 'FAILED' : 'PENDING',
        location: location
      };

      if (itemRecord) {
        itemRecord = await prisma.item.update({
          where: { imei: itemRecord.imei },
          data: {
            model: itemData.model,
            capacity: itemData.capacity,
            color: itemData.color,
            carrier: itemData.carrier
          }
        });
      } else {
        itemRecord = await prisma.item.create({
          data: {
            imei,
            model: itemData.model,
            capacity: itemData.capacity,
            color: itemData.color,
            carrier: itemData.carrier,
            working: 'PENDING',
            location: location
          }
        });
      }

      // Create or update Inventory using Prisma
      const existingInventory = await prisma.inventory.findFirst({
        where: {
          sku: sku,
          location: location
        }
      });

      if (existingInventory) {
        await prisma.inventory.update({
          where: { id: existingInventory.id },
          data: {
            qty_total: (existingInventory.qty_total || 0) + quantity
          }
        });
      } else {
        await prisma.inventory.create({
          data: {
            sku: sku,
            location: location,
            qty_total: quantity,
            // status: 'in_stock' // Field doesn't exist in schema
          }
        });
      }

      // Create IMEI-related records using Prisma
      try {
        // TODO: Implement when imeiSkuInfo model is available
        logger.info(`SKU info for IMEI ${imei}: ${sku}`);
      } catch (error) {
        logger.warn(`Could not create imei_sku_info for ${imei}: ${error}`);
      }

      try {
        // TODO: Implement when imeiInspectData model is available
        logger.info(`Inspect data for IMEI ${imei}: working=${working}, battery=${batteryHealth}`);
      } catch (error) {
        logger.warn(`Could not create imei_inspect_data for ${imei}: ${error}`);
      }

      try {
        // TODO: Implement when imeiUnits model is available
        logger.info(`Unit data for IMEI ${imei}: name=${name}`);
      } catch (error) {
        logger.warn(`Could not create imei_units for ${imei}: ${error}`);
      }

      try {
        await prisma.deviceTest.create({
          data: {
            imei,
            // testType: 'PHONECHECK', // Field doesn't exist in schema
            working: working === 'YES' ? 'PASSED' : working === 'NO' ? 'FAILED' : 'PENDING',
            notes: `Auto-generated from queue processing`
          }
        });
      } catch (error) {
        logger.warn(`Could not create DeviceTest for ${imei}: ${error}`);
      }

      return true;

    } catch (error) {
      logger.error('Error processing item data:', error);
      return false;
    }
  }

  /**
   * Start continuous processing
   */
  async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      logger.info('Processing already running');
      return;
    }

    this.isProcessing = true;
    logger.info('Starting hybrid queue processing...');

    while (this.isProcessing) {
      try {
        const nextItem = await this.getNextItem();
        
        if (nextItem) {
          await this.processSingleItem(nextItem);
        } else {
          // No items to process, wait a bit
          await new Promise(resolve => setTimeout(resolve, this.processingInterval));
        }
      } catch (error) {
        logger.error('Error in processing loop:', error);
        await new Promise(resolve => setTimeout(resolve, this.processingInterval));
      }
    }
  }

  /**
   * Stop processing
   */
  async stopProcessing(): Promise<void> {
    this.isProcessing = false;
    logger.info('Stopping hybrid queue processing...');
  }

  /**
   * Get queue statistics using SQL function
   */
  async getQueueStats(): Promise<QueueStats> {
    try {
      const { data, error } = await supabase
        .rpc('get_queue_stats');

      if (error) {
        logger.error('Error getting queue stats:', error.message);
        return {
          totalItems: 0,
          pendingItems: 0,
          processingItems: 0,
          completedItems: 0,
          failedItems: 0
        };
      }

      if (data && data.length > 0) {
        const stats = data[0];
        return {
          totalItems: Number(stats.total_items) || 0,
          pendingItems: Number(stats.pending_items) || 0,
          processingItems: Number(stats.processing_items) || 0,
          completedItems: Number(stats.completed_items) || 0,
          failedItems: Number(stats.failed_items) || 0,
          avgProcessingTime: stats.avg_processing_time,
          oldestPendingItem: stats.oldest_pending_item ? new Date(stats.oldest_pending_item) : undefined
        };
      }

      return {
        totalItems: 0,
        pendingItems: 0,
        processingItems: 0,
        completedItems: 0,
        failedItems: 0
      };

    } catch (error) {
      logger.error('Error getting queue stats:', error);
      return {
        totalItems: 0,
        pendingItems: 0,
        processingItems: 0,
        completedItems: 0,
        failedItems: 0
      };
    }
  }

  /**
   * Get queue items by status using Prisma
   */
  async getQueueItems(status?: string, limit: number = 100): Promise<QueueItem[]> {
    try {
      const where = status ? { status } : {};
      
      const items = await prisma.dataQueue.findMany({
        where,
        orderBy: [
          { priority: 'asc' },
          { createdAt: 'asc' }
        ],
        take: limit
      });

      return items.map(item => ({
        id: Number(item.id),
        rawData: item.rawData,
        status: item.status || 'pending',
        priority: item.priority || 5,
        retryCount: item.retryCount || 0,
        maxRetries: item.maxRetries || 3,
        source: item.source || undefined,
        batchId: item.batchId || undefined,
        errorMessage: item.errorMessage || undefined,
        createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        processedAt: item.processedAt || undefined
      }));
    } catch (error) {
      logger.error('Error getting queue items:', error);
      return [];
    }
  }

  /**
   * Retry failed items using Prisma
   */
  async retryFailedItems(): Promise<ProcessResult> {
    try {
      const failedItems = await prisma.dataQueue.findMany({
        where: { status: 'failed' }
      });

      if (failedItems.length === 0) {
        return {
          success: true,
          processed: 0,
          errors: [],
          message: 'No failed items to retry'
        };
      }

      let processed = 0;
      const errors: string[] = [];

      for (const item of failedItems) {
        try {
          await prisma.dataQueue.update({
            where: { id: item.id },
            data: {
              status: 'pending',
              retryCount: 0,
              errorMessage: null,
              updatedAt: new Date()
            }
          });

          // Log retry action
          await prisma.queueProcessingLog.create({
            data: {
              queueItemId: item.id,
              action: 'retry',
              message: 'Item reset for retry'
            }
          });

          processed++;
        } catch (retryError) {
          const errorMessage = retryError instanceof Error ? retryError.message : 'Unknown error';
          errors.push(`Item ${item.id}: ${errorMessage}`);
        }
      }

      return {
        success: processed > 0,
        processed,
        errors,
        message: `Retried ${processed} items${errors.length > 0 ? ` with ${errors.length} errors` : ''}`
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        processed: 0,
        errors: [errorMessage],
        message: `Failed to retry items: ${errorMessage}`
      };
    }
  }

  /**
   * Clear completed items using Prisma
   */
  async clearCompletedItems(): Promise<ProcessResult> {
    try {
      const result = await prisma.dataQueue.deleteMany({
        where: { status: 'completed' }
      });

      return {
        success: true,
        processed: result.count,
        errors: [],
        message: `Cleared ${result.count} completed items`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        processed: 0,
        errors: [errorMessage],
        message: `Failed to clear completed items: ${errorMessage}`
      };
    }
  }

  /**
   * Get batch statistics using Prisma
   */
  async getBatchStats(batchId: string): Promise<any> {
    try {
      // TODO: Implement when queueBatch model is available
      logger.info(`Getting batch status for ${batchId}`);
      const batch = null; // Placeholder

      if (!batch) {
        return null;
      }

      const queueItems = await prisma.dataQueue.findMany({
        where: { batchId },
        select: {
          status: true,
          errorMessage: true
        }
      });

      const statusCounts = queueItems.reduce((acc, item) => {
        const status = item.status || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        batchId: batchId,
        statusCounts,
        progress: 0 // TODO: Calculate progress when queueBatch model is available
      };
    } catch (error) {
      logger.error('Error getting batch stats:', error);
      return null;
    }
  }
}

// Export singleton instance
export const hybridQueueService = new HybridQueueService();
