
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

class ApiProcessingLogger {
  constructor() {
    this.client = null;
  }
  
  async connect() {
    if (!this.client) {
      this.client = await pool.connect();
    }
  }
  
  async disconnect() {
    if (this.client) {
      this.client.release();
      this.client = null;
    }
  }
  
  /**
   * Log API request start
   */
  async logRequestStart(batchId, endpoint, source, itemsCount, chunksCount) {
    try {
      await this.connect();
      
      const result = await this.client.query(`
        INSERT INTO api_processing_logs (
          batch_id, api_endpoint, request_source, items_count, chunks_count, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [batchId, endpoint, source, itemsCount, chunksCount, 'started']);
      
      console.log(`📝 API request logged: ${batchId} (${itemsCount} items)`);
      return result.rows[0].id;
      
    } catch (error) {
      console.error('❌ Error logging request start:', error.message);
      return null;
    }
  }
  
  /**
   * Log processing trigger
   */
  async logProcessingTrigger(batchId, triggered) {
    try {
      await this.connect();
      
      await this.client.query(`
        UPDATE api_processing_logs 
        SET 
          processing_triggered = $1,
          processing_started_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
          status = CASE WHEN $1 THEN 'processing' ELSE status END,
          updated_at = NOW()
        WHERE batch_id = $2
      `, [triggered, batchId]);
      
      console.log(`📝 Processing trigger logged: ${batchId} - ${triggered ? 'TRIGGERED' : 'SKIPPED'}`);
      
    } catch (error) {
      console.error('❌ Error logging processing trigger:', error.message);
    }
  }
  
  /**
   * Log processing completion
   */
  async logProcessingComplete(batchId, itemsProcessed, itemsFailed, errorMessage = null) {
    try {
      await this.connect();
      
      const processingStarted = await this.client.query(`
        SELECT processing_started_at FROM api_processing_logs WHERE batch_id = $1
      `, [batchId]);
      
      let durationMs = null;
      if (processingStarted.rows.length > 0 && processingStarted.rows[0].processing_started_at) {
        const startTime = new Date(processingStarted.rows[0].processing_started_at);
        durationMs = Date.now() - startTime.getTime();
      }
      
      await this.client.query(`
        UPDATE api_processing_logs 
        SET 
          status = $1,
          processing_completed_at = NOW(),
          items_processed = $2,
          items_failed = $3,
          error_message = $4,
          processing_duration_ms = $5,
          updated_at = NOW()
        WHERE batch_id = $6
      `, [
        errorMessage ? 'failed' : 'completed',
        itemsProcessed,
        itemsFailed,
        errorMessage,
        durationMs,
        batchId
      ]);
      
      console.log(`📝 Processing completion logged: ${batchId} - ${itemsProcessed} processed, ${itemsFailed} failed`);
      
    } catch (error) {
      console.error('❌ Error logging processing completion:', error.message);
    }
  }
  
  /**
   * Get processing status for a batch
   */
  async getBatchStatus(batchId) {
    try {
      await this.connect();
      
      const result = await this.client.query(`
        SELECT * FROM api_processing_logs WHERE batch_id = $1
      `, [batchId]);
      
      return result.rows[0] || null;
      
    } catch (error) {
      console.error('❌ Error getting batch status:', error.message);
      return null;
    }
  }
  
  /**
   * Get recent processing logs
   */
  async getRecentLogs(limit = 50) {
    try {
      await this.connect();
      
      const result = await this.client.query(`
        SELECT 
          batch_id,
          api_endpoint,
          request_source,
          items_count,
          status,
          processing_triggered,
          processing_started_at,
          processing_completed_at,
          items_processed,
          items_failed,
          processing_duration_ms,
          created_at
        FROM api_processing_logs 
        ORDER BY created_at DESC 
        LIMIT $1
      `, [limit]);
      
      return result.rows;
      
    } catch (error) {
      console.error('❌ Error getting recent logs:', error.message);
      return [];
    }
  }
  
  /**
   * Get processing statistics
   */
  async getProcessingStats() {
    try {
      await this.connect();
      
      const result = await this.client.query(`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_requests,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_requests,
          COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_requests,
          COUNT(CASE WHEN processing_triggered = true THEN 1 END) as triggered_requests,
          AVG(processing_duration_ms) as avg_processing_time_ms,
          SUM(items_processed) as total_items_processed,
          SUM(items_failed) as total_items_failed
        FROM api_processing_logs 
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `);
      
      return result.rows[0];
      
    } catch (error) {
      console.error('❌ Error getting processing stats:', error.message);
      return null;
    }
  }
}

module.exports = new ApiProcessingLogger();
