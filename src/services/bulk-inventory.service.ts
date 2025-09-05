import { logger } from '../utils/logger';
import { SupabaseAdminService } from './supabase-admin.service';
import CompleteSkuMatchingService from './CompleteSkuMatchingService';

export class BulkInventoryService {
  private supabaseService: SupabaseAdminService;
  private skuMatchingService: CompleteSkuMatchingService;

  constructor() {
    this.supabaseService = new SupabaseAdminService();
    this.skuMatchingService = new CompleteSkuMatchingService();
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
             
             // Trigger SKU matching for this item
             try {
               await this.triggerSkuMatching(item);
               logger.info(`🎯 SKU matching triggered for item ${itemIndex + 1}: ${item.imei}`);
             } catch (skuError) {
               logger.warn(`⚠️ SKU matching failed for item ${itemIndex + 1}: ${item.imei}`, skuError);
               // Don't fail the entire process if SKU matching fails
             }
            
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

  /**
   * Trigger SKU matching for a single item
   */
  private async triggerSkuMatching(item: any): Promise<void> {
    try {
      // Initialize SKU matching service if needed
      await this.skuMatchingService.initialize();
      
      // Perform SKU matching
      const results = await this.skuMatchingService.matchImeiToSku({
        imei: item.imei,
        model: item.model,
        capacity: item.capacity,
        color: item.color,
        carrier: item.carrier,
        brand: item.brand,
        original_sku: item.sku
      }, {
        filterPostfix: true,
        minScore: 70,
        maxResults: 1
      });
      
      if (results && results.length > 0) {
        const bestMatch = results[0];
        if (bestMatch) {
          logger.info(`🎯 SKU match found for ${item.imei}: ${item.sku} -> ${bestMatch.skuCode} (Score: ${bestMatch.score})`);
          
          // Store the match result in database
          await this.storeSkuMatchResult(item.imei, item.sku, bestMatch);
        } else {
          logger.info(`❌ No valid SKU match found for ${item.imei}: ${item.sku}`);
        }
      } else {
        logger.info(`❌ No SKU match found for ${item.imei}: ${item.sku}`);
      }
      
    } catch (error) {
      logger.error(`❌ SKU matching error for ${item.imei}:`, error);
      throw error;
    }
  }

  /**
   * Store SKU matching result in database
   */
  private async storeSkuMatchResult(imei: string, originalSku: string, match: any): Promise<void> {
    try {
      // Use the supabase service to store the result
      // This will be implemented based on your database structure
      logger.info(`💾 Storing SKU match result for ${imei}: ${match.skuCode}`);
      
      // For now, just log the result
      // TODO: Implement database storage of SKU matching results
      
    } catch (error) {
      logger.error(`❌ Error storing SKU match result for ${imei}:`, error);
      throw error;
    }
  }
}

export default new BulkInventoryService();
