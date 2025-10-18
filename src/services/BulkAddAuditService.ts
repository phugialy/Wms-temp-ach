import { Pool } from 'pg';
import { logger } from '../utils/logger';

export interface BulkAddAuditRecord {
  sessionId: string;
  station: string;
  location: string;
  totalDevices: number;
  successfulDevices: number;
  failedDevices: number;
  status: 'COMPLETE' | 'FAILED' | 'PARTIAL' | 'IN_PROGRESS';
  processingTimeMs: number;
  errorMessage?: string;
}

export class BulkAddAuditService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env['DIRECT_URL'],
      ssl: { rejectUnauthorized: false },
      max: 2,
      min: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  /**
   * Generate a unique session ID for the bulk-add operation
   */
  generateSessionId(station: string): string {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const random = Math.random().toString(36).substring(2, 8);
    return `bulk_${timestamp}_${station}_${random}`;
  }

  /**
   * Start tracking a bulk-add operation
   */
  async startBulkAddAudit(
    sessionId: string,
    station: string,
    location: string,
    totalDevices: number
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO bulk_add_audit (
          session_id, station, location, total_devices, 
          successful_devices, failed_devices, status
        ) VALUES ($1, $2, $3, $4, 0, 0, 'IN_PROGRESS')
      `;
      
      await client.query(query, [sessionId, station, location, totalDevices]);
      
      logger.info(`📊 BULK AUDIT: Started tracking session ${sessionId} for station ${station} with ${totalDevices} devices`);
      
    } catch (error) {
      logger.error('❌ BULK AUDIT: Failed to start audit tracking:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Complete tracking a bulk-add operation
   */
  async completeBulkAddAudit(
    sessionId: string,
    successfulDevices: number,
    failedDevices: number,
    processingTimeMs: number,
    errorMessage?: string
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // Determine status based on results
      let status: 'COMPLETE' | 'FAILED' | 'PARTIAL';
      if (failedDevices === 0) {
        status = 'COMPLETE';
      } else if (successfulDevices === 0) {
        status = 'FAILED';
      } else {
        status = 'PARTIAL';
      }

      const query = `
        UPDATE bulk_add_audit 
        SET 
          successful_devices = $2,
          failed_devices = $3,
          status = $4,
          processing_time_ms = $5,
          error_message = $6,
          updated_at = NOW()
        WHERE session_id = $1
      `;
      
      await client.query(query, [
        sessionId, 
        successfulDevices, 
        failedDevices, 
        status, 
        processingTimeMs, 
        errorMessage || null
      ]);
      
      logger.info(`📊 BULK AUDIT: Completed session ${sessionId} - Status: ${status}, Success: ${successfulDevices}, Failed: ${failedDevices}`);
      
    } catch (error) {
      logger.error('❌ BULK AUDIT: Failed to complete audit tracking:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get bulk-add audit history
   */
  async getBulkAddHistory(limit: number = 50): Promise<any[]> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT 
          id,
          session_id,
          TO_CHAR(trigger_date, 'YYYY-MM-DD HH24:MI:SS') as trigger_date_formatted,
          station,
          location,
          total_devices,
          successful_devices,
          failed_devices,
          status,
          CASE 
            WHEN status = 'COMPLETE' THEN '🟢 COMPLETE'
            WHEN status = 'FAILED' THEN '🔴 FAILED'
            WHEN status = 'PARTIAL' THEN '🟡 PARTIAL'
            WHEN status = 'IN_PROGRESS' THEN '🔄 IN_PROGRESS'
            ELSE status
          END as status_display,
          processing_time_ms,
          ROUND(processing_time_ms::numeric / 1000, 2) as processing_time_seconds,
          error_message,
          TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at_formatted
        FROM bulk_add_audit
        ORDER BY trigger_date DESC
        LIMIT $1
      `;
      
      const result = await client.query(query, [limit]);
      return result.rows;
      
    } catch (error) {
      logger.error('❌ BULK AUDIT: Failed to get audit history:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get audit history for a specific station
   */
  async getBulkAddHistoryByStation(station: string, limit: number = 20): Promise<any[]> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT 
          id,
          session_id,
          TO_CHAR(trigger_date, 'YYYY-MM-DD HH24:MI:SS') as trigger_date_formatted,
          station,
          location,
          total_devices,
          successful_devices,
          failed_devices,
          status,
          CASE 
            WHEN status = 'COMPLETE' THEN '🟢 COMPLETE'
            WHEN status = 'FAILED' THEN '🔴 FAILED'
            WHEN status = 'PARTIAL' THEN '🟡 PARTIAL'
            WHEN status = 'IN_PROGRESS' THEN '🔄 IN_PROGRESS'
            ELSE status
          END as status_display,
          processing_time_ms,
          ROUND(processing_time_ms::numeric / 1000, 2) as processing_time_seconds,
          error_message,
          TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at_formatted
        FROM bulk_add_audit
        WHERE station = $1
        ORDER BY trigger_date DESC
        LIMIT $2
      `;
      
      const result = await client.query(query, [station, limit]);
      return result.rows;
      
    } catch (error) {
      logger.error('❌ BULK AUDIT: Failed to get audit history for station:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(): Promise<any> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT 
          COUNT(*) as total_operations,
          COUNT(CASE WHEN status = 'COMPLETE' THEN 1 END) as complete_operations,
          COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_operations,
          COUNT(CASE WHEN status = 'PARTIAL' THEN 1 END) as partial_operations,
          SUM(total_devices) as total_devices_processed,
          SUM(successful_devices) as total_successful_devices,
          SUM(failed_devices) as total_failed_devices,
          ROUND(AVG(processing_time_ms)) as avg_processing_time_ms,
          ROUND(AVG(total_devices)) as avg_devices_per_operation
        FROM bulk_add_audit
        WHERE status != 'IN_PROGRESS'
      `;
      
      const result = await client.query(query);
      return result.rows[0];
      
    } catch (error) {
      logger.error('❌ BULK AUDIT: Failed to get audit statistics:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.pool.end();
      logger.info('📊 BulkAddAuditService: Connection pool closed');
    } catch (error) {
      logger.error('Error during BulkAddAuditService cleanup:', error);
    }
  }
}

export default BulkAddAuditService;

