import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';
import { DatabaseConnectionService } from './DatabaseConnectionService';

export interface ImeiInput {
  imei: string;
  brand?: string;
  model?: string;
  capacity?: string;
  color?: string;
  carrier?: string;
  device_notes?: string;
  working_status?: string;
  battery_health?: string;
  source?: 'bulk' | 'phonecheck' | 'manual';
}

export interface BulkProcessingResult {
  success: boolean;
  batchId: string;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  processingTime: number;
  errors: string[];
  message: string;
}

export interface SingleProcessingResult {
  success: boolean;
  imei: string;
  processingTime: number;
  message: string;
  error?: string;
}

export class UltraFastImeiService {
  private dbService: DatabaseConnectionService;
  private readonly BATCH_SIZE = 100; // Process 100 IMEIs per batch
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 100; // 100ms retry delay

  constructor() {
    this.dbService = DatabaseConnectionService.getInstance();
  }

  /**
   * Ultra-fast bulk IMEI processing
   * Target: < 50ms response time for 1000+ IMEIs
   */
  async processBulkImeis(imeis: ImeiInput[]): Promise<BulkProcessingResult> {
    const startTime = Date.now();
    const batchId = `BATCH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info(`🚀 BULK PROCESSING: Starting batch ${batchId} with ${imeis.length} IMEIs`);

      // Step 1: Ultra-fast validation (10ms target)
      const validationResult = await this.validateBulkImeis(imeis);
      if (!validationResult.isValid) {
        return {
          success: false,
          batchId,
          totalItems: imeis.length,
          processedItems: 0,
          failedItems: imeis.length,
          processingTime: Date.now() - startTime,
          errors: [validationResult.error || 'Validation failed'],
          message: 'Bulk validation failed'
        };
      }

      // Step 2: Batch database insertion (30ms target)
      const insertResult = await this.batchInsertImeis(imeis, batchId);
      
      // Step 3: Trigger App 2 processing (non-blocking)
      this.triggerApp2Processing(batchId).catch(err => 
        logger.error(`Failed to trigger App 2 processing for batch ${batchId}:`, err)
      );

      const processingTime = Date.now() - startTime;
      
      logger.info(`✅ BULK PROCESSING: Completed batch ${batchId} in ${processingTime}ms`);

      return {
        success: true,
        batchId,
        totalItems: imeis.length,
        processedItems: insertResult.processed,
        failedItems: insertResult.failed,
        processingTime,
        errors: insertResult.errors,
        message: `Successfully processed ${insertResult.processed} IMEIs`
      };

    } catch (error) {
      logger.error(`❌ BULK PROCESSING ERROR for batch ${batchId}:`, error);
      return {
        success: false,
        batchId,
        totalItems: imeis.length,
        processedItems: 0,
        failedItems: imeis.length,
        processingTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : String(error)],
        message: 'Bulk processing failed'
      };
    }
  }

  /**
   * Ultra-fast single IMEI processing
   * Target: < 50ms response time
   */
  async processSingleImei(imei: ImeiInput): Promise<SingleProcessingResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`⚡ SINGLE PROCESSING: Processing IMEI ${imei.imei}`);

      // Step 1: Ultra-fast validation (5ms target)
      const validationResult = await this.validateSingleImei(imei);
      if (!validationResult.isValid) {
        return {
          success: false,
          imei: imei.imei,
          processingTime: Date.now() - startTime,
          message: 'IMEI validation failed',
          error: validationResult.error
        };
      }

      // Step 2: Single database insertion (20ms target)
      const insertResult = await this.insertSingleImei(imei);
      
      // Step 3: Trigger App 2 processing (non-blocking)
      this.triggerApp2Processing(insertResult.batchId).catch(err => 
        logger.error(`Failed to trigger App 2 processing for IMEI ${imei.imei}:`, err)
      );

      const processingTime = Date.now() - startTime;
      
      logger.info(`✅ SINGLE PROCESSING: Completed IMEI ${imei.imei} in ${processingTime}ms`);

      return {
        success: true,
        imei: imei.imei,
        processingTime,
        message: 'IMEI processed successfully'
      };

    } catch (error) {
      logger.error(`❌ SINGLE PROCESSING ERROR for IMEI ${imei.imei}:`, error);
      return {
        success: false,
        imei: imei.imei,
        processingTime: Date.now() - startTime,
        message: 'Single IMEI processing failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Ultra-fast bulk validation
   * Target: < 10ms for 1000+ IMEIs
   */
  private async validateBulkImeis(imeis: ImeiInput[]): Promise<{isValid: boolean, error?: string}> {
    try {
      // Parallel validation for speed
      const validationPromises = imeis.map(imei => this.validateSingleImei(imei));
      const results = await Promise.all(validationPromises);
      
      const failedValidations = results.filter(result => !result.isValid);
      if (failedValidations.length > 0) {
        return {
          isValid: false,
          error: `${failedValidations.length} IMEIs failed validation: ${failedValidations[0]?.error || 'Unknown error'}`
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Ultra-fast single IMEI validation
   * Target: < 5ms per IMEI
   */
  private async validateSingleImei(imei: ImeiInput): Promise<{isValid: boolean, error?: string}> {
    try {
      // IMEI format validation (ultra-fast regex)
      if (!imei.imei || !/^\d{15}$/.test(imei.imei)) {
        return {
          isValid: false,
          error: 'Invalid IMEI format (must be 15 digits)'
        };
      }

      // Required fields validation
      if (!imei.brand || !imei.model) {
        return {
          isValid: false,
          error: 'Brand and model are required'
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Batch database insertion
   * Target: < 30ms for 1000+ IMEIs
   */
  private async batchInsertImeis(imeis: ImeiInput[], batchId: string): Promise<{
    processed: number;
    failed: number;
    errors: string[];
  }> {
    const client = await this.dbService.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Prepare batch insert query
      const insertQuery = `
        INSERT INTO imei_data_queue (
          imei, brand, model, capacity, color, carrier, device_notes,
          working_status, battery_health, source, batch_id, input_status,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        ON CONFLICT (imei) DO UPDATE SET
          brand = EXCLUDED.brand,
          model = EXCLUDED.model,
          capacity = EXCLUDED.capacity,
          color = EXCLUDED.color,
          carrier = EXCLUDED.carrier,
          device_notes = EXCLUDED.device_notes,
          working_status = EXCLUDED.working_status,
          battery_health = EXCLUDED.battery_health,
          source = EXCLUDED.source,
          batch_id = EXCLUDED.batch_id,
          input_status = 'updated',
          updated_at = NOW()
      `;

      let processed = 0;
      let failed = 0;
      const errors: string[] = [];

      // Process in batches for optimal performance
      for (let i = 0; i < imeis.length; i += this.BATCH_SIZE) {
        const batch = imeis.slice(i, i + this.BATCH_SIZE);
        
        for (const imei of batch) {
          try {
            await client.query(insertQuery, [
              imei.imei,
              imei.brand || '',
              imei.model || '',
              imei.capacity || '',
              imei.color || '',
              imei.carrier || '',
              imei.device_notes || '',
              imei.working_status || '',
              imei.battery_health || '',
              imei.source || 'bulk',
              batchId,
              'received'
            ]);
            processed++;
          } catch (error) {
            failed++;
            errors.push(`IMEI ${imei.imei}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }

      await client.query('COMMIT');
      
      return { processed, failed, errors };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Single IMEI database insertion
   * Target: < 20ms
   */
  private async insertSingleImei(imei: ImeiInput): Promise<{batchId: string}> {
    const client = await this.dbService.getClient();
    const batchId = `SINGLE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const insertQuery = `
        INSERT INTO imei_data_queue (
          imei, brand, model, capacity, color, carrier, device_notes,
          working_status, battery_health, source, batch_id, input_status,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        ON CONFLICT (imei) DO UPDATE SET
          brand = EXCLUDED.brand,
          model = EXCLUDED.model,
          capacity = EXCLUDED.capacity,
          color = EXCLUDED.color,
          carrier = EXCLUDED.carrier,
          device_notes = EXCLUDED.device_notes,
          working_status = EXCLUDED.working_status,
          battery_health = EXCLUDED.battery_health,
          source = EXCLUDED.source,
          batch_id = EXCLUDED.batch_id,
          input_status = 'updated',
          updated_at = NOW()
      `;

      await client.query(insertQuery, [
        imei.imei,
        imei.brand || '',
        imei.model || '',
        imei.capacity || '',
        imei.color || '',
        imei.carrier || '',
        imei.device_notes || '',
        imei.working_status || '',
        imei.battery_health || '',
        imei.source || 'manual',
        batchId,
        'received'
      ]);

      return { batchId };
    } finally {
      client.release();
    }
  }

  /**
   * Trigger App 2 processing (non-blocking)
   * This signals App 2 to start SKU matching
   */
  private async triggerApp2Processing(batchId: string): Promise<void> {
    try {
      // Update batch status to trigger App 2
      const client = await this.dbService.getClient();
      await client.query(
        'UPDATE imei_data_queue SET input_status = $1 WHERE batch_id = $2',
        ['ready_for_sku_matching', batchId]
      );
      client.release();
      
      logger.info(`🔄 APP 2 TRIGGER: Batch ${batchId} ready for SKU matching`);
    } catch (error) {
      logger.error(`Failed to trigger App 2 processing for batch ${batchId}:`, error);
    }
  }

  /**
   * Get processing status for a batch
   */
  async getBatchStatus(batchId: string): Promise<any> {
    try {
      const client = await this.dbService.getClient();
      const result = await client.query(`
        SELECT 
          batch_id,
          COUNT(*) as total_items,
          COUNT(CASE WHEN input_status = 'received' THEN 1 END) as pending,
          COUNT(CASE WHEN input_status = 'ready_for_sku_matching' THEN 1 END) as ready,
          COUNT(CASE WHEN input_status = 'sku_processed' THEN 1 END) as completed,
          MIN(created_at) as started_at,
          MAX(updated_at) as last_updated
        FROM imei_data_queue 
        WHERE batch_id = $1
        GROUP BY batch_id
      `, [batchId]);
      
      client.release();
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Failed to get batch status for ${batchId}:`, error);
      return null;
    }
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<any> {
    try {
      const client = await this.dbService.getClient();
      const result = await client.query(`
        SELECT 
          COUNT(*) as total_imeis,
          COUNT(CASE WHEN input_status = 'received' THEN 1 END) as pending,
          COUNT(CASE WHEN input_status = 'ready_for_sku_matching' THEN 1 END) as ready,
          COUNT(CASE WHEN input_status = 'sku_processed' THEN 1 END) as completed,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as last_hour,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN 1 END) as last_day
        FROM imei_data_queue
      `);
      
      client.release();
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get processing stats:', error);
      return null;
    }
  }
}

export default UltraFastImeiService;
