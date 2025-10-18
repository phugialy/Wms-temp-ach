import { Pool } from 'pg';
import { logger } from '../utils/logger';
import BulkAddAuditService from './BulkAddAuditService';

export interface InventoryItem {
  imei: string;
  brand?: string;
  model?: string;
  capacity?: string;
  color?: string;
  carrier?: string;
  working_status?: string;
  battery_health?: string;
  location?: string;
  notes?: string;
}

export interface AddItemResult {
  success: boolean;
  imei: string;
  processingTime: number;
  message: string;
  error?: string;
}

export class SimpleInventoryService {
  private pool: Pool;
  private auditService: BulkAddAuditService;

  constructor() {
    // Optimized connection pool for bulk operations
    this.pool = new Pool({
      connectionString: process.env['DIRECT_URL'],
      ssl: { rejectUnauthorized: false },
      max: 3, // Allow multiple connections for bulk operations
      min: 1, // Keep at least one connection alive
      idleTimeoutMillis: 60000, // Longer idle timeout for bulk operations
      connectionTimeoutMillis: 10000, // Longer connection timeout
      statement_timeout: 120000, // 2 minutes for bulk operations
      query_timeout: 120000, // 2 minutes for bulk operations
      keepAlive: true,
      keepAliveInitialDelayMillis: 0,
    });

    // Handle pool errors
    this.pool.on('error', (err: Error) => {
      logger.error('SimpleInventoryService pool error:', err);
    });

    // Initialize audit service
    this.auditService = new BulkAddAuditService();
  }

  /**
   * Add item to inventory - IMEI-centric approach
   * Focus: Fast, reliable, simple
   */
  async addItemToInventory(item: InventoryItem): Promise<AddItemResult> {
    const startTime = Date.now();
    
    try {
      // Basic validation
      if (!item.imei || !/^\d{15}$/.test(item.imei)) {
        return {
          success: false,
          imei: item.imei,
          processingTime: Date.now() - startTime,
          message: 'Invalid IMEI format',
          error: 'IMEI must be 15 digits'
        };
      }

      if (!item.brand || !item.model) {
        return {
          success: false,
          imei: item.imei,
          processingTime: Date.now() - startTime,
          message: 'Missing required fields',
          error: 'Brand and model are required'
        };
      }

      const client = await this.pool.connect();
      
      try {
        // Simple insert into existing tables
        await client.query('BEGIN');

        // Insert into product table (main inventory)
        await client.query(`
          INSERT INTO product (imei, brand, date_in, created_at, updated_at)
          VALUES ($1, $2, NOW(), NOW(), NOW())
          ON CONFLICT (imei) DO UPDATE SET
            brand = EXCLUDED.brand,
            updated_at = NOW()
        `, [item.imei, item.brand]);

        // Insert into item table (device details)
        await client.query(`
          INSERT INTO item (
            imei, model, capacity, color, carrier, battery_health, 
            working, location, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          ON CONFLICT (imei) DO UPDATE SET
            model = EXCLUDED.model,
            capacity = EXCLUDED.capacity,
            color = EXCLUDED.color,
            carrier = EXCLUDED.carrier,
            battery_health = EXCLUDED.battery_health,
            working = EXCLUDED.working,
            location = EXCLUDED.location,
            updated_at = NOW()
        `, [
          item.imei,
          item.model,
          item.capacity || '',
          item.color || '',
          item.carrier || '',
          item.battery_health || '',
          item.working_status || 'PENDING',
          item.location || 'Default Location'
        ]);

        await client.query('COMMIT');

        const processingTime = Date.now() - startTime;
        
        logger.info(`✅ INVENTORY ADD: IMEI ${item.imei} added in ${processingTime}ms`);
        
        return {
          success: true,
          imei: item.imei,
          processingTime,
          message: 'Item added to inventory successfully'
        };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      logger.error(`❌ INVENTORY ADD ERROR for ${item.imei}:`, error);
      return {
        success: false,
        imei: item.imei,
        processingTime: Date.now() - startTime,
        message: 'Failed to add item to inventory',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Bulk add items to inventory
   */
  async bulkAddItems(
    items: InventoryItem[], 
    station?: string, 
    location?: string,
    sessionId?: string
  ): Promise<{
    success: boolean;
    totalItems: number;
    processedItems: number;
    failedItems: number;
    processingTime: number;
    message: string;
    errors: string[];
    sessionId?: string;
  }> {
    const startTime = Date.now();
    let processedItems = 0;
    let failedItems = 0;
    const errors: string[] = [];

    logger.info(`📦 BULK ADD: Starting bulk operation with ${items.length} items`);
    logger.info(`📦 BULK ADD: Sample item structure:`, JSON.stringify(items[0], null, 2));

    // Generate session ID and start audit tracking if station is provided
    const auditSessionId = sessionId || (station ? this.auditService.generateSessionId(station) : null);
    
    if (auditSessionId && station && location) {
      try {
        await this.auditService.startBulkAddAudit(auditSessionId, station, location, items.length);
        logger.info(`📦 BULK ADD: Audit tracking started - Session: ${auditSessionId}`);
      } catch (auditError) {
        logger.warn(`📦 BULK ADD: Failed to start audit tracking:`, auditError);
        // Continue with the operation even if audit fails
      }
    }

    // Use a single database connection for the entire bulk operation
    const client = await this.pool.connect();
    logger.info(`📦 BULK ADD: Database connection established`);
    
    try {
      await client.query('BEGIN');

      // Prepare bulk insert data
      const productValues: any[] = [];
      const itemValues: any[] = [];
      const validItems: InventoryItem[] = [];

      // Validate and prepare all items first
      logger.info(`📦 BULK ADD: Validating ${items.length} items...`);
      
      for (const item of items) {
        // Basic validation
        if (!item.imei || !/^\d{15}$/.test(item.imei)) {
          failedItems++;
          errors.push(`${item.imei}: Invalid IMEI format`);
          logger.warn(`📦 BULK ADD: Invalid IMEI format for item:`, { imei: item.imei, brand: item.brand, model: item.model });
          continue;
        }

        if (!item.brand || !item.model) {
          failedItems++;
          errors.push(`${item.imei}: Missing required fields (brand, model)`);
          logger.warn(`📦 BULK ADD: Missing required fields for item:`, { imei: item.imei, brand: item.brand, model: item.model });
          continue;
        }

        validItems.push(item);
        // SKU is now optional - let the database trigger handle it
        productValues.push([item.imei, item.brand]);
        itemValues.push([
          item.imei,
          item.model,
          item.capacity || '',
          item.color || '',
          item.carrier || '',
          item.battery_health || '',
          item.working_status || 'PENDING',
          item.location || 'Default Location'
        ]);
      }
      
      logger.info(`📦 BULK ADD: Validation complete - ${validItems.length} valid items, ${failedItems} failed items`);

      if (validItems.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          totalItems: items.length,
          processedItems: 0,
          failedItems,
          processingTime: Date.now() - startTime,
          message: 'No valid items to process',
          errors
        };
      }

      // Process in chunks to avoid overwhelming the database
      const CHUNK_SIZE = 50; // Process 50 items at a time
      let processedCount = 0;
      
      logger.info(`📦 BULK ADD: Processing ${validItems.length} items in chunks of ${CHUNK_SIZE}`);
      
      for (let i = 0; i < productValues.length; i += CHUNK_SIZE) {
        const productChunk = productValues.slice(i, i + CHUNK_SIZE);
        const itemChunk = itemValues.slice(i, i + CHUNK_SIZE);
        
        logger.info(`📦 BULK ADD: Processing chunk ${Math.floor(i/CHUNK_SIZE) + 1}/${Math.ceil(productValues.length/CHUNK_SIZE)} (${productChunk.length} items)`);
        
        // Bulk insert into product table (chunk) - SKU is auto-generated by trigger
        const productQuery = `
          INSERT INTO product (imei, brand, date_in, created_at, updated_at)
          VALUES ${productChunk.map((_, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2}, NOW(), NOW(), NOW())`).join(', ')}
          ON CONFLICT (imei) DO UPDATE SET
            brand = EXCLUDED.brand,
            updated_at = NOW()
        `;
        
        logger.info(`📦 BULK ADD: Inserting ${productChunk.length} products into database...`);
        await client.query(productQuery, productChunk.flat());
        logger.info(`📦 BULK ADD: Product insert completed for chunk`);

        // Bulk insert into item table (chunk)
        const itemQuery = `
          INSERT INTO item (
            imei, model, capacity, color, carrier, battery_health, 
            working, location, created_at, updated_at
          )
          VALUES ${itemChunk.map((_, idx) => `($${idx * 8 + 1}, $${idx * 8 + 2}, $${idx * 8 + 3}, $${idx * 8 + 4}, $${idx * 8 + 5}, $${idx * 8 + 6}, $${idx * 8 + 7}, $${idx * 8 + 8}, NOW(), NOW())`).join(', ')}
          ON CONFLICT (imei) DO UPDATE SET
            model = EXCLUDED.model,
            capacity = EXCLUDED.capacity,
            color = EXCLUDED.color,
            carrier = EXCLUDED.carrier,
            battery_health = EXCLUDED.battery_health,
            working = EXCLUDED.working,
            location = EXCLUDED.location,
            updated_at = NOW()
        `;
        
        logger.info(`📦 BULK ADD: Inserting ${itemChunk.length} items into database...`);
        await client.query(itemQuery, itemChunk.flat());
        logger.info(`📦 BULK ADD: Item insert completed for chunk`);
        
        processedCount += productChunk.length;
        logger.info(`📦 BULK ADD: Chunk ${Math.floor(i / CHUNK_SIZE) + 1} completed - Total processed: ${processedCount}/${validItems.length}`);
        
        // Small delay between chunks to prevent overwhelming the database
        if (i + CHUNK_SIZE < productValues.length) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        }
      }

      await client.query('COMMIT');
      
      processedItems = validItems.length;
      
      logger.info(`✅ BULK INVENTORY ADD: ${processedItems} items added in ${Date.now() - startTime}ms`);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('❌ BULK INVENTORY ADD ERROR:', error);
      logger.error('❌ Bulk add error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        totalItems: items.length,
        errorType: 'Database connection terminated during bulk operation',
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorCode: (error as any)?.code || 'NO_CODE',
        errorSeverity: (error as any)?.severity || 'NO_SEVERITY',
        errorDetails: JSON.stringify(error, null, 2)
      });
      failedItems = items.length;
      errors.push(`Bulk operation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }

    // Complete audit tracking
    const processingTime = Date.now() - startTime;
    if (auditSessionId) {
      try {
        const errorMessage = errors.length > 0 ? errors.join('; ') : undefined;
        await this.auditService.completeBulkAddAudit(
          auditSessionId, 
          processedItems, 
          failedItems, 
          processingTime, 
          errorMessage
        );
        logger.info(`📦 BULK ADD: Audit tracking completed - Session: ${auditSessionId}`);
      } catch (auditError) {
        logger.warn(`📦 BULK ADD: Failed to complete audit tracking:`, auditError);
        // Continue with the operation even if audit fails
      }
    }

    return {
      success: processedItems > 0,
      totalItems: items.length,
      processedItems,
      failedItems,
      processingTime,
      message: `Added ${processedItems}/${items.length} items to inventory`,
      errors,
      sessionId: auditSessionId || undefined
    };
  }

  /**
   * Get inventory stats
   */
  async getInventoryStats(): Promise<any> {
    try {
      const client = await this.pool.connect();
      
      try {
        const result = await client.query(`
          SELECT 
            COUNT(*) as total_items,
            COUNT(CASE WHEN i.working = 'YES' THEN 1 END) as working_items,
            COUNT(CASE WHEN i.working = 'NO' THEN 1 END) as failed_items,
            COUNT(CASE WHEN i.working = 'PENDING' THEN 1 END) as pending_items,
            COUNT(CASE WHEN p.created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as last_hour,
            COUNT(CASE WHEN p.created_at >= NOW() - INTERVAL '1 day' THEN 1 END) as last_day
          FROM product p
          LEFT JOIN item i ON p.imei = i.imei
        `);
        
        return result.rows[0];
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to get inventory stats:', error);
      return null;
    }
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    try {
      await this.pool.end();
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }
}

export default SimpleInventoryService;
