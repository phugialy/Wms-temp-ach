const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function createApiLoggingSystem() {
  const client = await pool.connect();
  try {
    console.log('🔧 Creating API logging system...');
    
    // Step 1: Create API logs table
    console.log('\n📋 Step 1: Creating API logs table...');
    
    const createLogsTable = `
      CREATE TABLE IF NOT EXISTS api_processing_logs (
        id SERIAL PRIMARY KEY,
        batch_id VARCHAR(255) NOT NULL,
        api_endpoint VARCHAR(100) NOT NULL,
        request_source VARCHAR(50) NOT NULL,
        items_count INTEGER NOT NULL,
        chunks_count INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL, -- 'started', 'processing', 'completed', 'failed'
        processing_triggered BOOLEAN DEFAULT FALSE,
        processing_started_at TIMESTAMP WITH TIME ZONE,
        processing_completed_at TIMESTAMP WITH TIME ZONE,
        items_processed INTEGER DEFAULT 0,
        items_failed INTEGER DEFAULT 0,
        error_message TEXT,
        processing_duration_ms INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    
    await client.query(createLogsTable);
    console.log('✅ API logs table created');
    
    // Step 2: Create indexes for performance
    console.log('\n📋 Step 2: Creating indexes...');
    
    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_api_logs_batch_id ON api_processing_logs(batch_id);
      CREATE INDEX IF NOT EXISTS idx_api_logs_status ON api_processing_logs(status);
      CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_processing_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_api_logs_processing_triggered ON api_processing_logs(processing_triggered);
    `;
    
    await client.query(createIndexes);
    console.log('✅ Indexes created');
    
    // Step 3: Create logging service
    console.log('\n📋 Step 3: Creating logging service...');
    
    const loggingService = `
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
      
      const result = await this.client.query(\`
        INSERT INTO api_processing_logs (
          batch_id, api_endpoint, request_source, items_count, chunks_count, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      \`, [batchId, endpoint, source, itemsCount, chunksCount, 'started']);
      
      console.log(\`📝 API request logged: \${batchId} (\${itemsCount} items)\`);
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
      
      await this.client.query(\`
        UPDATE api_processing_logs 
        SET 
          processing_triggered = $1,
          processing_started_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
          status = CASE WHEN $1 THEN 'processing' ELSE status END,
          updated_at = NOW()
        WHERE batch_id = $2
      \`, [triggered, batchId]);
      
      console.log(\`📝 Processing trigger logged: \${batchId} - \${triggered ? 'TRIGGERED' : 'SKIPPED'}\`);
      
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
      
      const processingStarted = await this.client.query(\`
        SELECT processing_started_at FROM api_processing_logs WHERE batch_id = $1
      \`, [batchId]);
      
      let durationMs = null;
      if (processingStarted.rows.length > 0 && processingStarted.rows[0].processing_started_at) {
        const startTime = new Date(processingStarted.rows[0].processing_started_at);
        durationMs = Date.now() - startTime.getTime();
      }
      
      await this.client.query(\`
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
      \`, [
        errorMessage ? 'failed' : 'completed',
        itemsProcessed,
        itemsFailed,
        errorMessage,
        durationMs,
        batchId
      ]);
      
      console.log(\`📝 Processing completion logged: \${batchId} - \${itemsProcessed} processed, \${itemsFailed} failed\`);
      
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
      
      const result = await this.client.query(\`
        SELECT * FROM api_processing_logs WHERE batch_id = $1
      \`, [batchId]);
      
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
      
      const result = await this.client.query(\`
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
      \`, [limit]);
      
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
      
      const result = await this.client.query(\`
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
      \`);
      
      return result.rows[0];
      
    } catch (error) {
      console.error('❌ Error getting processing stats:', error.message);
      return null;
    }
  }
}

module.exports = new ApiProcessingLogger();
`;
    
    require('fs').writeFileSync('src/services/ApiProcessingLogger.js', loggingService);
    console.log('✅ ApiProcessingLogger service created');
    
    // Step 4: Create enhanced controller with logging
    console.log('\n📋 Step 4: Creating enhanced controller with logging...');
    
    const enhancedController = `
import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import DirectQueueService from '../services/direct-queue.service';
import ApiProcessingLogger from '../services/ApiProcessingLogger';

export class ImeiQueueController {
  private static isProcessing = false;
  private static processingQueue = new Set<string>();
  
  async addToQueue(req: Request, res: Response): Promise<void> {
    const batchId = \`batch_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
    const startTime = Date.now();
    
    try {
      const { items, source = 'api' } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Items array is required and cannot be empty'
        });
        return;
      }
      
      // Log request start
      await ApiProcessingLogger.logRequestStart(
        batchId, 
        '/api/imei-queue/bulkadd', 
        source, 
        items.length, 
        Math.ceil(items.length / 50)
      );
      
      logger.info('Adding items to IMEI queue', { count: items.length, source, batchId });
      
      // Process items in chunks
      const CHUNK_SIZE = 50;
      const chunks = [];
      
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        chunks.push(items.slice(i, i + CHUNK_SIZE));
      }
      
      let totalAdded = 0;
      let totalErrors: string[] = [];
      
      // Process each chunk
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        
        if (!chunk) continue;
        
        try {
          const queueItems = chunk.map(item => ({
            raw_data: item,
            source: source as 'bulk-add' | 'single-phonecheck' | 'api' | 'test'
          }));
          
          const result = await DirectQueueService.addToQueue(queueItems);
          
          totalAdded += result.added;
          totalErrors.push(...result.errors);
          
          logger.info(\`Chunk \${chunkIndex + 1}/\${chunks.length} processed\`, { 
            added: result.added, 
            errors: result.errors.length,
            batchId
          });
          
          // Small delay between chunks
          if (chunkIndex < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
        } catch (chunkError) {
          const errorMessage = chunkError instanceof Error ? chunkError.message : 'Unknown chunk error';
          logger.error(\`Error processing chunk \${chunkIndex + 1}\`, { error: errorMessage, batchId });
          totalErrors.push(\`Chunk \${chunkIndex + 1}: \${errorMessage}\`);
        }
      }
      
      // Safe auto-trigger queue processing
      const processingTriggered = await this.safeTriggerQueueProcessing(batchId, source);
      
      // Log processing trigger
      await ApiProcessingLogger.logProcessingTrigger(batchId, processingTriggered);
      
      const response = {
        success: totalAdded > 0,
        added: totalAdded,
        errors: totalErrors,
        chunks: chunks.length,
        batch_id: batchId,
        processing_triggered: processingTriggered,
        message: \`Processed \${items.length} items in \${chunks.length} chunks: \${totalAdded} added\${totalErrors.length > 0 ? \`, \${totalErrors.length} errors\` : ''}\`
      };
      
      res.status(200).json(response);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in addToQueue controller', { error: errorMessage, batchId });
      
      // Log processing failure
      await ApiProcessingLogger.logProcessingComplete(batchId, 0, 0, errorMessage);
      
      res.status(500).json({
        success: false,
        error: \`Failed to add items to queue: \${errorMessage}\`,
        batch_id: batchId
      });
    }
  }
  
  /**
   * Safe queue processing trigger with comprehensive logging
   */
  private async safeTriggerQueueProcessing(batchId: string, source: string): Promise<boolean> {
    try {
      // Only trigger for bulk-add operations
      if (source !== 'bulk-add') {
        logger.info('Skipping auto-processing for non-bulk-add source', { source, batchId });
        return false;
      }
      
      // Check if already processing
      if (ImeiQueueController.isProcessing) {
        logger.info('Queue processing already in progress, skipping auto-trigger', { batchId });
        return false;
      }
      
      // Check if this batch is already queued for processing
      if (ImeiQueueController.processingQueue.has(batchId)) {
        logger.info('Batch already queued for processing', { batchId });
        return false;
      }
      
      // Add to processing queue
      ImeiQueueController.processingQueue.add(batchId);
      ImeiQueueController.isProcessing = true;
      
      logger.info('Triggering auto queue processing', { batchId });
      
      // Process in background with comprehensive error handling and logging
      setImmediate(async () => {
        let retryCount = 0;
        const maxRetries = 3;
        let finalProcessed = 0;
        let finalFailed = 0;
        let finalError = null;
        
        while (retryCount < maxRetries) {
          try {
            const QueueProcessor = require('../services/QueueProcessor.js');
            const processor = new QueueProcessor();
            
            logger.info(\`Starting queue processing (attempt \${retryCount + 1}/\${maxRetries})\`, { batchId });
            
            const result = await processor.processQueue();
            
            finalProcessed = result.processed;
            finalFailed = result.errors;
            
            logger.info('Auto queue processing completed successfully', { 
              batchId,
              processed: result.processed, 
              errors: result.errors 
            });
            
            break; // Success, exit retry loop
            
          } catch (error) {
            retryCount++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            finalError = errorMessage;
            
            logger.error(\`Auto queue processing failed (attempt \${retryCount}/\${maxRetries})\`, { 
              batchId,
              error: errorMessage 
            });
            
            if (retryCount < maxRetries) {
              // Exponential backoff: 5s, 10s, 15s
              const delay = 5000 * retryCount;
              logger.info(\`Retrying queue processing in \${delay}ms\`, { batchId });
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              logger.error('Auto queue processing failed after all retries', { 
                batchId,
                error: errorMessage 
              });
            }
          }
        }
        
        // Log final processing result
        await ApiProcessingLogger.logProcessingComplete(
          batchId, 
          finalProcessed, 
          finalFailed, 
          finalError
        );
        
        // Clean up
        ImeiQueueController.processingQueue.delete(batchId);
        ImeiQueueController.isProcessing = false;
        
        logger.info('Queue processing cleanup completed', { batchId });
      });
      
      return true;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error in safeTriggerQueueProcessing', { batchId, error: errorMessage });
      
      // Log processing failure
      await ApiProcessingLogger.logProcessingComplete(batchId, 0, 0, errorMessage);
      
      // Clean up on error
      ImeiQueueController.processingQueue.delete(batchId);
      ImeiQueueController.isProcessing = false;
      
      return false;
    }
  }
  
  /**
   * Get processing status for a specific batch
   */
  async getBatchStatus(req: Request, res: Response): Promise<void> {
    try {
      const { batchId } = req.params;
      
      if (!batchId) {
        res.status(400).json({
          success: false,
          error: 'Batch ID is required'
        });
        return;
      }
      
      const status = await ApiProcessingLogger.getBatchStatus(batchId);
      
      if (!status) {
        res.status(404).json({
          success: false,
          error: 'Batch not found'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        status,
        message: 'Batch status retrieved successfully'
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getBatchStatus', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: \`Failed to get batch status: \${errorMessage}\`
      });
    }
  }
  
  /**
   * Get recent processing logs
   */
  async getRecentLogs(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      
      const logs = await ApiProcessingLogger.getRecentLogs(limit);
      
      res.status(200).json({
        success: true,
        logs,
        count: logs.length,
        message: 'Recent logs retrieved successfully'
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getRecentLogs', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: \`Failed to get recent logs: \${errorMessage}\`
      });
    }
  }
  
  /**
   * Get processing statistics
   */
  async getProcessingStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await ApiProcessingLogger.getProcessingStats();
      
      res.status(200).json({
        success: true,
        stats,
        message: 'Processing statistics retrieved successfully'
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getProcessingStats', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: \`Failed to get processing statistics: \${errorMessage}\`
      });
    }
  }
}

export default new ImeiQueueController();
`;
    
    require('fs').writeFileSync('src/controllers/ImeiQueueController-Enhanced.js', enhancedController);
    console.log('✅ Enhanced controller with logging created');
    
    // Step 5: Create monitoring dashboard script
    console.log('\n📋 Step 5: Creating monitoring dashboard...');
    
    const monitoringScript = `
const ApiProcessingLogger = require('./src/services/ApiProcessingLogger.js');

async function showProcessingDashboard() {
  console.log('📊 API Processing Dashboard');
  console.log('============================');
  
  try {
    // Get recent logs
    const recentLogs = await ApiProcessingLogger.getRecentLogs(10);
    
    console.log('\\n📋 Recent Processing Logs:');
    console.log('Batch ID | Source | Items | Status | Triggered | Duration');
    console.log('---------|--------|-------|--------|-----------|---------');
    
    recentLogs.forEach(log => {
      const duration = log.processing_duration_ms ? \`\${log.processing_duration_ms}ms\` : 'N/A';
      console.log(\`\${log.batch_id} | \${log.request_source} | \${log.items_count} | \${log.status} | \${log.processing_triggered ? 'YES' : 'NO'} | \${duration}\`);
    });
    
    // Get statistics
    const stats = await ApiProcessingLogger.getProcessingStats();
    
    if (stats) {
      console.log('\\n📊 Processing Statistics (Last 24 Hours):');
      console.log(\`Total Requests: \${stats.total_requests}\`);
      console.log(\`Completed: \${stats.completed_requests}\`);
      console.log(\`Failed: \${stats.failed_requests}\`);
      console.log(\`Processing: \${stats.processing_requests}\`);
      console.log(\`Triggered: \${stats.triggered_requests}\`);
      console.log(\`Avg Processing Time: \${Math.round(stats.avg_processing_time_ms || 0)}ms\`);
      console.log(\`Total Items Processed: \${stats.total_items_processed || 0}\`);
      console.log(\`Total Items Failed: \${stats.total_items_failed || 0}\`);
    }
    
  } catch (error) {
    console.error('❌ Error showing dashboard:', error.message);
  }
}

// Run dashboard
showProcessingDashboard();
`;
    
    require('fs').writeFileSync('monitor-processing.js', monitoringScript);
    console.log('✅ Monitoring dashboard created');
    
    // Step 6: Test the logging system
    console.log('\n📋 Step 6: Testing logging system...');
    
    const testLog = await client.query(`
      INSERT INTO api_processing_logs (
        batch_id, api_endpoint, request_source, items_count, chunks_count, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['test_batch_123', '/api/imei-queue/bulkadd', 'test', 100, 2, 'started']);
    
    console.log(`✅ Test log created: ID ${testLog.rows[0].id}`);
    
    // Clean up test
    await client.query(`DELETE FROM api_processing_logs WHERE batch_id = 'test_batch_123'`);
    
    console.log('\n🎉 API logging system created successfully!');
    console.log('\n📋 What was created:');
    console.log('1. api_processing_logs table - stores all API processing logs');
    console.log('2. ApiProcessingLogger service - handles all logging operations');
    console.log('3. Enhanced controller - includes comprehensive logging');
    console.log('4. Monitoring dashboard - view processing status');
    console.log('5. API endpoints for monitoring - get status, logs, and stats');
    
    console.log('\n🚀 How to use:');
    console.log('1. Replace your controller with the enhanced version');
    console.log('2. Monitor processing: node monitor-processing.js');
    console.log('3. Check specific batch: GET /api/imei-queue/status/:batchId');
    console.log('4. View recent logs: GET /api/imei-queue/logs');
    console.log('5. Get statistics: GET /api/imei-queue/stats');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createApiLoggingSystem();


