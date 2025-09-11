import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';
import * as dotenv from 'dotenv';

dotenv.config();

export interface QueueItem {
  raw_data: any;
  source?: 'bulk-add' | 'single-phonecheck' | 'api' | 'test';
}

export interface QueueStats {
  total_items: number;
  pending_items: number;
  processing_items: number;
  completed_items: number;
  failed_items: number;
}

export interface QueueItemStatus {
  id: number;
  status: string;
  error_message?: string;
  created_at: string;
  processed_at?: string;
}

export interface ProcessResult {
  success: boolean;
  added: number;
  errors: string[];
  processingTime?: number;
  chunks?: number;
}

export class OptimizedDirectQueueService {
  private pool: Pool;
  private static readonly MAX_CHUNK_SIZE = 100;
  private static readonly CHUNK_DELAY = 50; // ms
  private static readonly MAX_CONNECTIONS = 10;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env['DIRECT_URL'],
      max: OptimizedDirectQueueService.MAX_CONNECTIONS,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false }
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
    });
  }

  /**
   * Optimized add to queue with adaptive processing based on data size
   */
  async addToQueue(items: QueueItem[]): Promise<ProcessResult> {
    const startTime = performance.now();
    
    try {
      logger.info('🚀 Starting optimized queue addition', { 
        count: items.length, 
        source: items[0]?.source || 'unknown' 
      });

      if (!items || items.length === 0) {
        return {
          success: false,
          added: 0,
          errors: ['No items provided']
        };
      }

      let result: ProcessResult;

      // Adaptive processing based on data size
      if (items.length === 1) {
        const firstItem = items[0];
        if (!firstItem) {
          throw new Error('First item is undefined');
        }
        result = await this.processSingleItem(firstItem);
      } else if (items.length <= OptimizedDirectQueueService.MAX_CHUNK_SIZE) {
        result = await this.processBatch(items);
      } else {
        result = await this.processChunked(items);
      }

      const endTime = performance.now();
      result.processingTime = endTime - startTime;

      logger.info('✅ Optimized queue addition completed', {
        added: result.added,
        errors: result.errors.length,
        processingTime: result.processingTime,
        chunks: result.chunks
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Error in optimized addToQueue', { error: errorMessage });
      
      return {
        success: false,
        added: 0,
        errors: [errorMessage]
      };
    }
  }

  /**
   * Process single item (optimized for single adds)
   */
  private async processSingleItem(item: QueueItem): Promise<ProcessResult> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        JSON.stringify(item.raw_data),
        'pending',
        item.source || 'api',
        5,
        0,
        3
      ]);

      return {
        success: true,
        added: 1,
        errors: []
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error processing single item', { error: errorMessage });
      
      return {
        success: false,
        added: 0,
        errors: [errorMessage]
      };
    } finally {
      client.release();
    }
  }

  /**
   * Process batch of items (optimized for small to medium bulk)
   */
  private async processBatch(items: QueueItem[]): Promise<ProcessResult> {
    const client = await this.pool.connect();
    
    try {
      // Prepare batch insert query
      const values = items.map((item, index) => {
        const baseIndex = index * 6;
        return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6})`;
      }).join(', ');
      
      const params = items.flatMap(item => [
        JSON.stringify(item.raw_data),
        'pending',
        item.source || 'api',
        5,
        0,
        3
      ]);
      
      await client.query(`
        INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
        VALUES ${values}
      `, params);

      logger.info('✅ Batch insert completed', { 
        recordsInserted: items.length,
        method: 'batch_insert'
      });

      return {
        success: true,
        added: items.length,
        errors: []
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error in batch processing', { error: errorMessage });
      
      return {
        success: false,
        added: 0,
        errors: [errorMessage]
      };
    } finally {
      client.release();
    }
  }

  /**
   * Process large datasets with chunked processing (database overload protection)
   */
  private async processChunked(items: QueueItem[]): Promise<ProcessResult> {
    const CHUNK_SIZE = OptimizedDirectQueueService.MAX_CHUNK_SIZE;
    const chunks = [];
    
    // Create chunks
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      chunks.push(items.slice(i, i + CHUNK_SIZE));
    }
    
    logger.info('🔄 Starting chunked processing', { 
      totalItems: items.length, 
      chunks: chunks.length, 
      chunkSize: CHUNK_SIZE 
    });
    
    let totalAdded = 0;
    const errors: string[] = [];
    
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      
      if (!chunk) continue;
      
      try {
        const chunkResult = await this.processBatch(chunk);
        totalAdded += chunkResult.added;
        errors.push(...chunkResult.errors);
        
        logger.info(`✅ Chunk ${chunkIndex + 1}/${chunks.length} processed`, { 
          added: chunkResult.added, 
          errors: chunkResult.errors.length 
        });
        
        // Small delay between chunks to prevent database overload
        if (chunkIndex < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, OptimizedDirectQueueService.CHUNK_DELAY));
        }
        
      } catch (chunkError) {
        const errorMessage = chunkError instanceof Error ? chunkError.message : 'Unknown chunk error';
        logger.error(`❌ Error processing chunk ${chunkIndex + 1}`, { error: errorMessage });
        errors.push(`Chunk ${chunkIndex + 1}: ${errorMessage}`);
      }
    }
    
    return {
      success: totalAdded > 0,
      added: totalAdded,
      errors,
      chunks: chunks.length
    };
  }

  /**
   * Get queue statistics (optimized with connection pooling)
   */
  async getQueueStats(): Promise<QueueStats> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total_items,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_items,
          COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_items,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_items,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_items
        FROM data_queue
      `);
      
      const stats = result.rows[0];
      return {
        total_items: Number(stats.total_items || 0),
        pending_items: Number(stats.pending_items || 0),
        processing_items: Number(stats.processing_items || 0),
        completed_items: Number(stats.completed_items || 0),
        failed_items: Number(stats.failed_items || 0)
      };
      
    } catch (error) {
      logger.error('Error in getQueueStats', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get queue items by status (optimized with connection pooling)
   */
  async getQueueItems(status?: string, limit: number = 100): Promise<QueueItemStatus[]> {
    const client = await this.pool.connect();
    
    try {
      let query = `
        SELECT id, status, error_message, created_at, processed_at
        FROM data_queue
        ORDER BY created_at DESC
        LIMIT $1
      `;
      
      let params: (string | number)[] = [limit];
      
      if (status) {
        query = `
          SELECT id, status, error_message, created_at, processed_at
          FROM data_queue
          WHERE status = $1
          ORDER BY created_at DESC
          LIMIT $2
        `;
        params = [status, limit];
      }
      
      const result = await client.query(query, params);
      return result.rows;
      
    } catch (error) {
      logger.error('Error in getQueueItems', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Retry failed items (optimized with connection pooling)
   */
  async retryFailedItems(): Promise<{ retried: number }> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        UPDATE data_queue
        SET 
          status = 'pending',
          retry_count = 0,
          error_message = NULL,
          updated_at = NOW()
        WHERE status = 'failed'
        RETURNING id
      `);
      
      const retried = result.rowCount || 0;
      logger.info('Failed items retry completed', { retried });
      
      return { retried };
      
    } catch (error) {
      logger.error('Error in retryFailedItems', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Clear completed items (optimized with connection pooling)
   */
  async clearCompletedItems(olderThanDays: number = 7): Promise<{ cleared: number }> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        DELETE FROM data_queue
        WHERE status = 'completed'
        AND processed_at < NOW() - INTERVAL '${olderThanDays} days'
        RETURNING id
      `);
      
      const cleared = result.rowCount || 0;
      logger.info('Completed items cleanup completed', { cleared });
      
      return { cleared };
      
    } catch (error) {
      logger.error('Error in clearCompletedItems', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Connection pool closed');
  }
}

export default new OptimizedDirectQueueService();
