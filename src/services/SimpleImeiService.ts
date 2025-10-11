import { Pool } from 'pg';
import { logger } from '../utils/logger';

export interface SimpleImeiInput {
  imei: string;
  brand?: string;
  model?: string;
  capacity?: string;
  color?: string;
  carrier?: string;
  device_notes?: string;
}

export interface SimpleResult {
  success: boolean;
  imei: string;
  processingTime: number;
  message: string;
  error?: string;
}

export class SimpleImeiService {
  private pool: Pool;

  constructor() {
    // Simple, direct connection - no complex pooling
    this.pool = new Pool({
      connectionString: process.env['DIRECT_URL'],
      ssl: { rejectUnauthorized: false },
      max: 2, // Minimal connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  /**
   * Simple IMEI processing - focus on speed and reliability
   */
  async processImei(imei: SimpleImeiInput): Promise<SimpleResult> {
    const startTime = Date.now();
    
    try {
      // Basic validation
      if (!imei.imei || !/^\d{15}$/.test(imei.imei)) {
        return {
          success: false,
          imei: imei.imei,
          processingTime: Date.now() - startTime,
          message: 'Invalid IMEI format',
          error: 'IMEI must be 15 digits'
        };
      }

      // Simple database insert
      const client = await this.pool.connect();
      
      try {
        await client.query(`
          INSERT INTO imei_data_queue (
            imei, brand, model, capacity, color, carrier, device_notes,
            source, input_status, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          ON CONFLICT (imei) DO UPDATE SET
            brand = EXCLUDED.brand,
            model = EXCLUDED.model,
            capacity = EXCLUDED.capacity,
            color = EXCLUDED.color,
            carrier = EXCLUDED.carrier,
            device_notes = EXCLUDED.device_notes,
            input_status = 'updated',
            updated_at = NOW()
        `, [
          imei.imei,
          imei.brand || '',
          imei.model || '',
          imei.capacity || '',
          imei.color || '',
          imei.carrier || '',
          imei.device_notes || '',
          'api',
          'received'
        ]);

        const processingTime = Date.now() - startTime;
        
        return {
          success: true,
          imei: imei.imei,
          processingTime,
          message: 'IMEI processed successfully'
        };

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error(`❌ SIMPLE IMEI ERROR for ${imei.imei}:`, error);
      return {
        success: false,
        imei: imei.imei,
        processingTime: Date.now() - startTime,
        message: 'IMEI processing failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Simple bulk processing
   */
  async processBulkImeis(imeis: SimpleImeiInput[]): Promise<{
    success: boolean;
    totalItems: number;
    processedItems: number;
    failedItems: number;
    processingTime: number;
    message: string;
    errors: string[];
  }> {
    const startTime = Date.now();
    let processedItems = 0;
    let failedItems = 0;
    const errors: string[] = [];

    for (const imei of imeis) {
      const result = await this.processImei(imei);
      if (result.success) {
        processedItems++;
      } else {
        failedItems++;
        errors.push(`${imei.imei}: ${result.error}`);
      }
    }

    return {
      success: processedItems > 0,
      totalItems: imeis.length,
      processedItems,
      failedItems,
      processingTime: Date.now() - startTime,
      message: `Processed ${processedItems}/${imeis.length} IMEIs`,
      errors
    };
  }

  /**
   * Simple stats - just count records
   */
  async getSimpleStats(): Promise<any> {
    try {
      const client = await this.pool.connect();
      
      try {
        const result = await client.query(`
          SELECT 
            COUNT(*) as total_imeis,
            COUNT(CASE WHEN input_status = 'received' THEN 1 END) as pending,
            COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as last_hour
          FROM imei_data_queue
        `);
        
        return result.rows[0];
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to get simple stats:', error);
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

export default SimpleImeiService;


