import { Pool, Client } from 'pg';
import { logger } from '../utils/logger';

interface SkuUpdateRequest {
  sku_code: string;
  brand?: string;
  model?: string;
  capacity?: string;
  color?: string;
  carrier?: string;
  post_fix?: string;
  device_type?: string;
  notes?: string;
  updated_by?: string;
}

interface SkuUpdateResult {
  success: boolean;
  sku_code: string;
  changes: string[];
  error?: string;
}

export class SkuManualUpdateService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env['DIRECT_URL'],
      connectionTimeoutMillis: 30000,
    });
  }

  /**
   * Update SKU data manually with validation
   */
  async updateSkuManually(request: SkuUpdateRequest): Promise<SkuUpdateResult> {
    const client = await this.pool.connect();
    
    try {
      logger.info(`🔧 Manual SKU update requested for: ${request.sku_code}`);
      
      // Validate SKU exists
      const existingSku = await client.query(
        'SELECT * FROM sku_master WHERE sku_code = $1',
        [request.sku_code]
      );
      
      if (existingSku.rows.length === 0) {
        return {
          success: false,
          sku_code: request.sku_code,
          changes: [],
          error: 'SKU not found in database'
        };
      }
      
      const currentSku = existingSku.rows[0];
      const changes: string[] = [];
      
      // Build update query dynamically
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;
      
      // Check each field for changes
      if (request.brand !== undefined && request.brand !== currentSku.brand) {
        updateFields.push(`brand = $${paramIndex++}`);
        updateValues.push(request.brand);
        changes.push(`Brand: "${currentSku.brand}" → "${request.brand}"`);
      }
      
      if (request.model !== undefined && request.model !== currentSku.model) {
        updateFields.push(`model = $${paramIndex++}`);
        updateValues.push(request.model);
        changes.push(`Model: "${currentSku.model}" → "${request.model}"`);
      }
      
      if (request.capacity !== undefined && request.capacity !== currentSku.capacity) {
        updateFields.push(`capacity = $${paramIndex++}`);
        updateValues.push(request.capacity);
        changes.push(`Capacity: "${currentSku.capacity}" → "${request.capacity}"`);
      }
      
      if (request.color !== undefined && request.color !== currentSku.color) {
        updateFields.push(`color = $${paramIndex++}`);
        updateValues.push(request.color);
        changes.push(`Color: "${currentSku.color}" → "${request.color}"`);
      }
      
      if (request.carrier !== undefined && request.carrier !== currentSku.carrier) {
        updateFields.push(`carrier = $${paramIndex++}`);
        updateValues.push(request.carrier);
        changes.push(`Carrier: "${currentSku.carrier}" → "${request.carrier}"`);
      }
      
      if (request.post_fix !== undefined && request.post_fix !== currentSku.post_fix) {
        updateFields.push(`post_fix = $${paramIndex++}`);
        updateValues.push(request.post_fix);
        changes.push(`Postfix: "${currentSku.post_fix}" → "${request.post_fix}"`);
      }
      
      if (request.device_type !== undefined && request.device_type !== currentSku.device_type) {
        updateFields.push(`device_type = $${paramIndex++}`);
        updateValues.push(request.device_type);
        changes.push(`Device Type: "${currentSku.device_type}" → "${request.device_type}"`);
      }
      
      // Always update the updated_at timestamp
      updateFields.push(`updated_at = NOW()`);
      
      if (changes.length === 0) {
        return {
          success: true,
          sku_code: request.sku_code,
          changes: ['No changes detected'],
        };
      }
      
      // Execute update
      const updateQuery = `
        UPDATE sku_master 
        SET ${updateFields.join(', ')}
        WHERE sku_code = $${paramIndex}
        RETURNING *
      `;
      updateValues.push(request.sku_code);
      
      const result = await client.query(updateQuery, updateValues);
      
      // Log the manual update
      await this.logManualUpdate(client, request, changes, result.rows[0]);
      
      logger.info(`✅ Manual SKU update completed for ${request.sku_code}: ${changes.length} changes`);
      
      return {
        success: true,
        sku_code: request.sku_code,
        changes: changes,
      };
      
    } catch (error) {
      logger.error(`❌ Manual SKU update failed for ${request.sku_code}:`, error);
      return {
        success: false,
        sku_code: request.sku_code,
        changes: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get SKUs that need manual review (missing critical data)
   */
  async getSkusNeedingReview(limit: number = 50): Promise<any[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT 
          sku_code,
          brand,
          model,
          capacity,
          color,
          carrier,
          post_fix,
          device_type,
          source_tab,
          last_synced,
          (
            CASE WHEN brand IS NULL OR brand = '' THEN 1 ELSE 0 END +
            CASE WHEN model IS NULL OR model = '' THEN 1 ELSE 0 END +
            CASE WHEN capacity IS NULL OR capacity = '' THEN 1 ELSE 0 END +
            CASE WHEN color IS NULL OR color = '' THEN 1 ELSE 0 END +
            CASE WHEN carrier IS NULL OR carrier = '' THEN 1 ELSE 0 END
          ) as missing_fields_count
        FROM sku_master 
        WHERE is_active = true
        AND (
          brand IS NULL OR brand = '' OR 
          model IS NULL OR model = '' OR 
          capacity IS NULL OR capacity = '' OR 
          color IS NULL OR color = '' OR 
          carrier IS NULL OR carrier = ''
        )
        ORDER BY missing_fields_count DESC, sku_code
        LIMIT $1
      `, [limit]);
      
      return result.rows;
      
    } finally {
      client.release();
    }
  }

  /**
   * Get SKU parsing suggestions using database reference tables
   */
  async getSkuParsingSuggestions(skuCode: string): Promise<any> {
    const client = await this.pool.connect();
    
    try {
      // Get current SKU data
      const currentSku = await client.query(
        'SELECT * FROM sku_master WHERE sku_code = $1',
        [skuCode]
      );
      
      if (currentSku.rows.length === 0) {
        return { error: 'SKU not found' };
      }
      
      // Get parsing suggestions from database reference tables
      const suggestions = await client.query('SELECT * FROM parse_sku_complete($1)', [skuCode]);
      
      return {
        current: currentSku.rows[0],
        suggested: suggestions.rows[0],
        needs_update: this.compareSkuData(currentSku.rows[0], suggestions.rows[0])
      };
      
    } finally {
      client.release();
    }
  }

  /**
   * Bulk update SKUs using parsing suggestions
   */
  async bulkUpdateFromSuggestions(skuCodes: string[], updatedBy: string = 'system'): Promise<SkuUpdateResult[]> {
    const results: SkuUpdateResult[] = [];
    
    for (const skuCode of skuCodes) {
      try {
        const suggestions = await this.getSkuParsingSuggestions(skuCode);
        
        if (suggestions.error) {
          results.push({
            success: false,
            sku_code: skuCode,
            changes: [],
            error: suggestions.error
          });
          continue;
        }
        
        const updateRequest: SkuUpdateRequest = {
          sku_code: skuCode,
          brand: suggestions.suggested.brand,
          model: suggestions.suggested.model,
          capacity: suggestions.suggested.capacity,
          color: suggestions.suggested.color,
          carrier: suggestions.suggested.carrier,
          post_fix: suggestions.suggested.postfix,
          device_type: suggestions.suggested.device_type,
          updated_by: updatedBy
        };
        
        const result = await this.updateSkuManually(updateRequest);
        results.push(result);
        
      } catch (error) {
        results.push({
          success: false,
          sku_code: skuCode,
          changes: [],
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return results;
  }

  /**
   * Log manual updates for audit trail
   */
  private async logManualUpdate(
    client: any, 
    request: SkuUpdateRequest, 
    changes: string[], 
    updatedSku: any
  ): Promise<void> {
    try {
      await client.query(`
        INSERT INTO sku_manual_update_log (
          sku_code,
          changes_made,
          updated_by,
          update_notes,
          updated_at
        ) VALUES ($1, $2, $3, $4, NOW())
      `, [
        request.sku_code,
        JSON.stringify(changes),
        request.updated_by || 'unknown',
        request.notes || ''
      ]);
    } catch (error) {
      logger.warn('Failed to log manual update:', error);
    }
  }

  /**
   * Compare current SKU data with suggested data
   */
  private compareSkuData(current: any, suggested: any): string[] {
    const differences: string[] = [];
    
    if (current.brand !== suggested.brand) {
      differences.push(`Brand: "${current.brand}" → "${suggested.brand}"`);
    }
    if (current.model !== suggested.model) {
      differences.push(`Model: "${current.model}" → "${suggested.model}"`);
    }
    if (current.capacity !== suggested.capacity) {
      differences.push(`Capacity: "${current.capacity}" → "${suggested.capacity}"`);
    }
    if (current.color !== suggested.color) {
      differences.push(`Color: "${current.color}" → "${suggested.color}"`);
    }
    if (current.carrier !== suggested.carrier) {
      differences.push(`Carrier: "${current.carrier}" → "${suggested.carrier}"`);
    }
    if (current.post_fix !== suggested.postfix) {
      differences.push(`Postfix: "${current.post_fix}" → "${suggested.postfix}"`);
    }
    if (current.device_type !== suggested.device_type) {
      differences.push(`Device Type: "${current.device_type}" → "${suggested.device_type}"`);
    }
    
    return differences;
  }

  /**
   * Create manual update log table if it doesn't exist
   */
  async createManualUpdateLogTable(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS sku_manual_update_log (
          id SERIAL PRIMARY KEY,
          sku_code VARCHAR(100) NOT NULL,
          changes_made JSONB NOT NULL,
          updated_by VARCHAR(100),
          update_notes TEXT,
          updated_at TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_sku_manual_update_log_sku_code 
        ON sku_manual_update_log(sku_code);
        
        CREATE INDEX IF NOT EXISTS idx_sku_manual_update_log_updated_at 
        ON sku_manual_update_log(updated_at);
      `);
      
      logger.info('✅ Manual update log table created/verified');
      
    } finally {
      client.release();
    }
  }
}
