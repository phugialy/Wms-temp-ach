import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseApiKey = process.env['SUPABASE_API_KEY'];

// Optimized client for bulk operations
export const supabaseOptimized = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseApiKey || 'placeholder-key',
  {
    db: {
      schema: 'public'
    },
    // Optimize for bulk operations
    global: {
      headers: {
        'X-Client-Info': 'wms-bulk-operations'
      }
    },
    // Connection pooling optimization
    auth: {
      persistSession: false, // Don't persist sessions for bulk ops
      autoRefreshToken: false
    }
  }
);

// Bulk operations helper
export const bulkOperations = {
  // Process items in batches to avoid connection limits
  async processBatch(items: any[], batchSize: number = 5, delayMs: number = 100) {
    const results = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      // Process batch concurrently
      const batchPromises = batch.map(async (item, index) => {
        try {
          const result = await supabaseOptimized
            .from('Item')
            .insert(item)
            .select()
            .single();
          
          return { success: true, data: result.data, index: i + index };
        } catch (error) {
          return { success: false, error, index: i + index };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add delay between batches
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    return results;
  }
};

export default supabaseOptimized;
