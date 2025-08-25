import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

export interface QueueItem {
  raw_data: any;
  source?: 'bulk-add' | 'single-phonecheck' | 'api';  // Made optional since not used in new schema
}

export interface QueueStats {
  total_items: number;
  pending_items: number;
  processing_items: number;
  completed_items: number;
  failed_items: number;
}

export interface QueueItemStatus {
  id: number;
  status: string;
  error_message?: string;
  created_at: string;
  processed_at?: string;
}

export class ImeiQueueService {
  
  /**
   * Add items to the processing queue
   */
  async addToQueue(items: QueueItem[]): Promise<{ success: boolean; added: number; errors: string[] }> {
    try {
      logger.info('Adding items to IMEI queue', { count: items.length });
      
      const errors: string[] = [];
      let added = 0;
      
      for (const item of items) {
        try {
          const { error } = await supabase
            .from('imei_data_queue')
            .insert({
              raw_data: item.raw_data,
              status: 'pending'
            });
          
          if (error) {
            logger.error('Error adding item to queue', { error, item });
            errors.push(`Failed to add item: ${error.message}`);
          } else {
            added++;
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          logger.error('Exception adding item to queue', { error: errorMsg, item });
          errors.push(`Exception adding item: ${errorMsg}`);
        }
      }
      
      logger.info('Queue addition completed', { added, errors: errors.length });
      
      return {
        success: added > 0,
        added,
        errors
      };
      
    } catch (error) {
      logger.error('Error in addToQueue', { error });
      throw error;
    }
  }
  
  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    try {
      const { data, error } = await supabase
        .rpc('get_queue_stats');
      
      if (error) {
        logger.error('Error getting queue stats', { error });
        throw new Error(`Failed to get queue stats: ${error.message}`);
      }
      
      return {
        total_items: Number(data[0]?.total_items || 0),
        pending_items: Number(data[0]?.pending_items || 0),
        processing_items: Number(data[0]?.processing_items || 0),
        completed_items: Number(data[0]?.completed_items || 0),
        failed_items: Number(data[0]?.failed_items || 0)
      };
      
    } catch (error) {
      logger.error('Error in getQueueStats', { error });
      throw error;
    }
  }
  
  /**
   * Get queue items by status
   */
  async getQueueItems(status?: string, limit: number = 100): Promise<QueueItemStatus[]> {
    try {
      let query = supabase
        .from('imei_data_queue')
        .select('id, status, error_message, created_at, processed_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      
      if (error) {
        logger.error('Error getting queue items', { error });
        throw new Error(`Failed to get queue items: ${error.message}`);
      }
      
      return data || [];
      
    } catch (error) {
      logger.error('Error in getQueueItems', { error });
      throw error;
    }
  }
  
  /**
   * Manually process all pending items
   */
  async processAllPending(): Promise<{ processed: number }> {
    try {
      logger.info('Manually processing all pending queue items');
      
      const { data, error } = await supabase
        .rpc('process_all_pending_queue');
      
      if (error) {
        logger.error('Error processing pending items', { error });
        throw new Error(`Failed to process pending items: ${error.message}`);
      }
      
      const processed = Number(data || 0);
      logger.info('Manual queue processing completed', { processed });
      
      return { processed };
      
    } catch (error) {
      logger.error('Error in processAllPending', { error });
      throw error;
    }
  }
  
  /**
   * Retry failed items
   */
  async retryFailedItems(): Promise<{ retried: number }> {
    try {
      logger.info('Retrying failed queue items');
      
      const { data, error } = await supabase
        .from('imei_data_queue')
        .update({ 
          status: 'pending',
          error_message: null,
          processed_at: null
        })
        .eq('status', 'failed')
        .select('id');
      
      if (error) {
        logger.error('Error retrying failed items', { error });
        throw new Error(`Failed to retry failed items: ${error.message}`);
      }
      
      const retried = data?.length || 0;
      logger.info('Failed items retry completed', { retried });
      
      return { retried };
      
    } catch (error) {
      logger.error('Error in retryFailedItems', { error });
      throw error;
    }
  }
  
  /**
   * Clear completed items (older than specified days)
   */
  async clearCompletedItems(olderThanDays: number = 7): Promise<{ cleared: number }> {
    try {
      logger.info('Clearing completed queue items', { olderThanDays });
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      const { data, error } = await supabase
        .from('imei_data_queue')
        .delete()
        .eq('status', 'completed')
        .lt('processed_at', cutoffDate.toISOString())
        .select('id');
      
      if (error) {
        logger.error('Error clearing completed items', { error });
        throw new Error(`Failed to clear completed items: ${error.message}`);
      }
      
      const cleared = data?.length || 0;
      logger.info('Completed items cleanup completed', { cleared });
      
      return { cleared };
      
    } catch (error) {
      logger.error('Error in clearCompletedItems', { error });
      throw error;
    }
  }
  
  /**
   * Get IMEI data from the new tables
   */
  async getImeiData(imei: string): Promise<any> {
    try {
      // Get SKU info
      const { data: skuInfo, error: skuError } = await supabase
        .from('imei_sku_info')
        .select('*')
        .eq('imei', imei)
        .single();
      
      if (skuError) {
        logger.error('Error getting SKU info', { error: skuError, imei });
        return null;
      }
      
      // Get inspect data
      const { data: inspectData, error: inspectError } = await supabase
        .from('imei_inspect_data')
        .select('*')
        .eq('imei', imei)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      // Get unit data
      const { data: unitData, error: unitError } = await supabase
        .from('imei_units')
        .select('*')
        .eq('imei', imei)
        .single();
      
      return {
        sku_info: skuInfo,
        inspect_data: inspectData,
        unit_data: unitData,
        has_inspect_data: !inspectError,
        has_unit_data: !unitError
      };
      
    } catch (error) {
      logger.error('Error in getImeiData', { error, imei });
      throw error;
    }
  }
  
  /**
   * Get all IMEIs with their data
   */
  async getAllImeiData(limit: number = 100, offset: number = 0): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('imei_sku_info')
        .select(`
          *,
          imei_inspect_data(*),
          imei_units(*)
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (error) {
        logger.error('Error getting all IMEI data', { error });
        throw new Error(`Failed to get IMEI data: ${error.message}`);
      }
      
      return data || [];
      
    } catch (error) {
      logger.error('Error in getAllImeiData', { error });
      throw error;
    }
  }
}

export default new ImeiQueueService();
