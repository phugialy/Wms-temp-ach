import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

export class SupabaseRestService {
  // Use REST API for bulk operations (no connection pooling issues)
  async bulkInsertItems(items: any[]) {
    try {
      logger.info(`🚀 Starting bulk insert of ${items.length} items via REST API`);
      
      const results = [];
      const batchSize = 10; // REST API can handle larger batches
      
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        
        logger.info(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(items.length/batchSize)}`);
        
        const { data, error } = await supabase
          .from('Item')
          .insert(batch)
          .select();
        
        if (error) {
          logger.error('❌ Batch insert failed:', error);
          throw error;
        }
        
        results.push(...(data || []));
        logger.info(`✅ Batch ${Math.floor(i/batchSize) + 1} completed: ${data?.length || 0} items`);
        
        // Small delay between batches
        if (i + batchSize < items.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      logger.info(`🎉 Bulk insert completed: ${results.length} items inserted`);
      return results;
      
    } catch (error) {
      logger.error('❌ Bulk insert failed:', error);
      throw error;
    }
  }
  
  // Single item insert via REST API
  async insertItem(item: any) {
    try {
      const { data, error } = await supabase
        .from('Item')
        .insert(item)
        .select()
        .single();
      
      if (error) throw error;
      return data;
      
    } catch (error) {
      logger.error('❌ Single item insert failed:', error);
      throw error;
    }
  }
  
  // Get inventory via REST API
  async getInventory() {
    try {
      const { data, error } = await supabase
        .from('Item')
        .select(`
          *,
          inventory:Inventory(
            *,
            location:Location(*)
          )
        `)
        .eq('isActive', true)
        .order('createdAt', { ascending: false });
      
      if (error) throw error;
      return data || [];
      
    } catch (error) {
      logger.error('❌ Get inventory failed:', error);
      throw error;
    }
  }
}

export default new SupabaseRestService();
