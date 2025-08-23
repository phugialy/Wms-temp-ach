import { logger } from '../utils/logger';
import { SupabaseAdminService } from './supabase-admin.service';

export class BulkInventoryService {
  private supabaseService: SupabaseAdminService;

  constructor() {
    this.supabaseService = new SupabaseAdminService();
  }
  // Process items in batches to avoid connection pooling issues
  async processBulkItems(items: any[], batchSize: number = 5) {
    try {
      logger.info(`🚀 Starting bulk processing of ${items.length} items in batches of ${batchSize}`);
      
      const results = {
        successful: 0,
        failed: 0,
        items: [] as any[]
      };

      // Process items in batches
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(items.length / batchSize);
        
        logger.info(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`);
        
        // Process batch items sequentially to avoid connection issues
        for (let j = 0; j < batch.length; j++) {
          const item = batch[j];
          const itemIndex = i + j;
          
          try {
            logger.info(`📤 Processing item ${itemIndex + 1}/${items.length}: ${item.imei}`);
            
                                      // Use the existing working service
             const result = await this.supabaseService.pushInventory(item);
             
             // If we get here, the operation was successful
             results.successful++;
             results.items.push(result);
             logger.info(`✅ Item ${itemIndex + 1} processed successfully`);
            
          } catch (error) {
            results.failed++;
            logger.error(`❌ Item ${itemIndex + 1} error:`, error);
          }
          
          // Small delay between items in the same batch
          if (j < batch.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        logger.info(`✅ Batch ${batchNumber} completed: ${batch.length} items processed`);
        
        // Add delay between batches to prevent overwhelming the server
        if (i + batchSize < items.length) {
          logger.info(`⏳ Waiting 1 second before next batch...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      logger.info(`🎉 Bulk processing completed: ${results.successful} successful, ${results.failed} failed`);
      return results;
      
    } catch (error) {
      logger.error('❌ Bulk processing failed:', error);
      throw error;
    }
  }
}

export default new BulkInventoryService();
