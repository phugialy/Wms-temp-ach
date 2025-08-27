import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

const supabase = createClient(
  process.env['SUPABASE_URL']!,
  process.env['SUPABASE_API_KEY']!
);

export interface QueueItem {
  id: number;
  raw_data: any;
  status: string;
  priority: number;
  retry_count: number;
  max_retries: number;
  source: string;
  batch_id: string;
  created_at: string;
  updated_at: string;
  processed_at?: string;
  error_message?: string;
}

export interface ProcessResult {
  success: boolean;
  processed: number;
  errors: string[];
  message: string;
}

export interface QueueStats {
  total_items: number;
  pending_items: number;
  processing_items: number;
  completed_items: number;
  failed_items: number;
  avg_processing_time?: string;
  oldest_pending_item?: string;
}

export interface BatchResult {
  batch_id: string;
  total_items: number;
  processed: number;
  errors: string[];
  processing_time: number;
}

/**
 * Queue Proxy Service - Acts as a reverse proxy for data processing
 * Streamlines the flow from bulk-add to database with one-by-one processing
 */
export class QueueProxyService {
  private isProcessing: boolean = false;
  private processingInterval: number = 1000; // 1 second between items
  private maxConcurrentItems: number = 1; // Process one at a time

  /**
   * Add raw data to queue (from bulk-add)
   */
  async addToQueue(items: any[], source: string = 'bulk-add', priority: number = 5): Promise<ProcessResult> {
    try {
      logger.info(`Adding ${items.length} items to queue from ${source}`);
      
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Prepare queue items
      const queueItems = items.map(item => ({
        raw_data: item,
        status: 'pending',
        priority,
        retry_count: 0,
        max_retries: 3,
        source,
        batch_id: batchId
      }));

      // Insert into queue
      const { data, error } = await supabase
        .from('imei_data_queue')
        .insert(queueItems)
        .select('id');

      if (error) {
        throw new Error(`Failed to add items to queue: ${error.message}`);
      }

      logger.info(`Successfully added ${data?.length || 0} items to queue with batch ID: ${batchId}`);

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
   * Get next item to process (with priority)
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

      return data[0] as QueueItem;
    } catch (error) {
      logger.error('Error getting next queue item:', error);
      return null;
    }
  }

  /**
   * Mark item as processing
   */
  async markAsProcessing(itemId: number): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('mark_queue_item_processing', { item_id: itemId });

      if (error) {
        logger.error('Error marking item as processing:', error.message);
        return false;
      }

      return data || false;
    } catch (error) {
      logger.error('Error marking item as processing:', error);
      return false;
    }
  }

  /**
   * Mark item as completed
   */
  async markAsCompleted(itemId: number): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('mark_queue_item_completed', { item_id: itemId });

      if (error) {
        logger.error('Error marking item as completed:', error.message);
        return false;
      }

      return data || false;
    } catch (error) {
      logger.error('Error marking item as completed:', error);
      return false;
    }
  }

  /**
   * Mark item as failed
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

      return data || false;
    } catch (error) {
      logger.error('Error marking item as failed:', error);
      return false;
    }
  }

  /**
   * Process a single item
   */
  async processSingleItem(item: QueueItem): Promise<boolean> {
    try {
      logger.info(`Processing item ${item.id} (IMEI: ${item.raw_data.imei || item.raw_data.IMEI})`);
      
      // Mark as processing
      const processingMarked = await this.markAsProcessing(item.id);
      if (!processingMarked) {
        logger.warn(`Could not mark item ${item.id} as processing`);
        return false;
      }

      // Process the item using existing logic
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
   * Process item data (existing logic from queue-processor.service.ts)
   */
  private async processItemData(item: QueueItem): Promise<boolean> {
    try {
      const rawData = item.raw_data;
      
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

      // Determine working status
      let workingStatus = 'PENDING';
      if (working === 'YES' || working === 'true' || working === 'TRUE') {
        workingStatus = 'YES';
      } else if (failed === 'YES' || failed === 'true' || failed === 'TRUE') {
        workingStatus = 'NO';
      }

      // Find or create location
      let locationId: number;
      const { data: existingLocation } = await supabase
        .from('Location')
        .select('id')
        .eq('name', location)
        .limit(1);

      if (existingLocation && existingLocation.length > 0) {
        locationId = existingLocation[0]?.id!;
      } else {
        const { data: newLocation, error: locationError } = await supabase
          .from('Location')
          .insert({
            name: location,
            warehouse_id: 1,
            description: `Auto-created location for ${location}`
          })
          .select('id')
          .single();

        if (locationError) {
          throw new Error(`Failed to create location: ${locationError.message}`);
        }
        locationId = newLocation.id;
      }

      // Create or update Item
      let itemId: number;
      const { data: existingItem } = await supabase
        .from('Item')
        .select('id')
        .eq('imei', imei)
        .limit(1);

      const itemData: any = {
        name,
        sku,
        description: `${brand} ${model} ${storage || ''} ${color || ''} ${carrier || ''} - ${notes || ''}`.trim()
      };

      if (existingItem && existingItem.length > 0) {
        itemId = existingItem[0]?.id!;
        await supabase
          .from('Item')
          .update(itemData)
          .eq('id', itemId);
      } else {
        const { data: newItem, error: itemError } = await supabase
          .from('Item')
          .insert({
            imei,
            ...itemData,
            status: 'active'
          })
          .select('id')
          .single();

        if (itemError) {
          throw new Error(`Failed to create item: ${itemError.message}`);
        }
        itemId = newItem.id;
      }

      // Create or update Inventory
      const { data: existingInventory } = await supabase
        .from('Inventory')
        .select('id, quantity')
        .eq('item_id', itemId)
        .eq('location_id', locationId)
        .limit(1);

      if (existingInventory && existingInventory.length > 0) {
        await supabase
          .from('Inventory')
          .update({
            quantity: (existingInventory[0]?.quantity || 0) + quantity
          })
          .eq('id', existingInventory[0]?.id!);
      } else {
        await supabase
          .from('Inventory')
          .insert({
            item_id: itemId,
            location_id: locationId,
            quantity,
            status: 'in_stock'
          });
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
    logger.info('Starting queue processing...');

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
    logger.info('Stopping queue processing...');
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    try {
      const { data, error } = await supabase
        .rpc('get_queue_stats');

      if (error) {
        logger.error('Error getting queue stats:', error.message);
        return {
          total_items: 0,
          pending_items: 0,
          processing_items: 0,
          completed_items: 0,
          failed_items: 0
        };
      }

      if (data && data.length > 0) {
        const stats = data[0];
        return {
          total_items: Number(stats.total_items) || 0,
          pending_items: Number(stats.pending_items) || 0,
          processing_items: Number(stats.processing_items) || 0,
          completed_items: Number(stats.completed_items) || 0,
          failed_items: Number(stats.failed_items) || 0,
          avg_processing_time: stats.avg_processing_time,
          oldest_pending_item: stats.oldest_pending_item
        };
      }

      return {
        total_items: 0,
        pending_items: 0,
        processing_items: 0,
        completed_items: 0,
        failed_items: 0
      };

    } catch (error) {
      logger.error('Error getting queue stats:', error);
      return {
        total_items: 0,
        pending_items: 0,
        processing_items: 0,
        completed_items: 0,
        failed_items: 0
      };
    }
  }

  /**
   * Process next item (manual trigger)
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
        success,
        processed: success ? 1 : 0,
        errors: success ? [] : ['Processing failed'],
        message: success ? 'Item processed successfully' : 'Item processing failed'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        processed: 0,
        errors: [errorMessage],
        message: `Error processing item: ${errorMessage}`
      };
    }
  }

  /**
   * Retry failed items
   */
  async retryFailedItems(): Promise<ProcessResult> {
    try {
      const { data: failedItems, error } = await supabase
        .from('imei_data_queue')
        .select('*')
        .eq('status', 'failed');

      if (error) {
        throw new Error(`Failed to get failed items: ${error.message}`);
      }

      if (!failedItems || failedItems.length === 0) {
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
          // Reset status to pending
          await supabase
            .from('imei_data_queue')
            .update({
              status: 'pending',
              retry_count: 0,
              error_message: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);

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
}

// Export singleton instance
export const queueProxyService = new QueueProxyService();

