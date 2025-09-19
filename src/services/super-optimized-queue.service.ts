import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';
import * as dotenv from 'dotenv';

dotenv.config();

export interface QueueItem {
  raw_data: any;
  source?: 'bulk-add' | 'single-phonecheck' | 'api' | 'test';
}

export interface ProcessResult {
  success: boolean;
  added: number;
  errors: string[];
  processingTime?: number;
  method?: string;
  recordsPerSecond?: number;
}

export class SuperOptimizedQueueService {
  private pool: Pool;
  private static readonly MAX_CHUNK_SIZE = 200; // Increased chunk size
  private static readonly CHUNK_DELAY = 25; // Reduced delay
  private static readonly MAX_CONNECTIONS = 15; // Increased connections
  private static readonly BATCH_SIZE = 50; // Optimal batch size for PostgreSQL

  constructor() {
    this.pool = new Pool({
      connectionString: process.env['DIRECT_URL'],
      max: SuperOptimizedQueueService.MAX_CONNECTIONS,
      idleTimeoutMillis: 60000, // Increased idle timeout
      connectionTimeoutMillis: 5000,
      ssl: { rejectUnauthorized: false },
      // Additional optimizations
      keepAlive: true,
      keepAliveInitialDelayMillis: 0,
      statement_timeout: 60000, // 60 second timeout
      query_timeout: 60000
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
    });
  }

  /**
   * Super optimized add to queue with maximum performance
   */
  async addToQueue(items: QueueItem[]): Promise<ProcessResult> {
    const startTime = performance.now();
    
    try {
      logger.info('🚀 Starting super optimized queue addition', { 
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

      // Super optimized adaptive processing
      if (items.length === 1) {
        const firstItem = items[0];
        if (!firstItem) {
          throw new Error('First item is undefined');
        }
        result = await this.processSingleItem(firstItem);
        result.method = 'single_optimized';
      } else if (items.length <= SuperOptimizedQueueService.BATCH_SIZE) {
        result = await this.processBatch(items);
        result.method = 'batch_optimized';
      } else if (items.length <= SuperOptimizedQueueService.MAX_CHUNK_SIZE) {
        result = await this.processLargeBatch(items);
        result.method = 'large_batch_optimized';
      } else {
        result = await this.processChunked(items);
        result.method = 'chunked_optimized';
      }

      const endTime = performance.now();
      result.processingTime = endTime - startTime;
      result.recordsPerSecond = result.added / (result.processingTime / 1000);

      logger.info('✅ Super optimized queue addition completed', {
        added: result.added,
        errors: result.errors.length,
        processingTime: result.processingTime,
        method: result.method,
        recordsPerSecond: result.recordsPerSecond
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Error in super optimized addToQueue', { error: errorMessage });
      
      return {
        success: false,
        added: 0,
        errors: [errorMessage]
      };
    }
  }

  /**
   * Process single item with prepared statement optimization
   */
  private async processSingleItem(item: QueueItem): Promise<ProcessResult> {
    const client = await this.pool.connect();
    
    try {
      // Use prepared statement for maximum performance
      const query = `
        INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      await client.query(query, [
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
   * Process batch with optimized multi-value insert
   */
  private async processBatch(items: QueueItem[]): Promise<ProcessResult> {
    const client = await this.pool.connect();
    
    try {
      // Super optimized batch insert with prepared statement
      const values = items.map((_, index) => {
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
      
      const query = `
        INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
        VALUES ${values}
      `;
      
      await client.query(query, params);

      logger.info('✅ Super optimized batch insert completed', { 
        recordsInserted: items.length,
        method: 'batch_insert_optimized'
      });

      return {
        success: true,
        added: items.length,
        errors: []
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error in super optimized batch processing', { error: errorMessage });
      
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
   * Process large batch with transaction optimization
   */
  private async processLargeBatch(items: QueueItem[]): Promise<ProcessResult> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Use COPY for maximum performance with large datasets
      const values = items.map(item => [
        JSON.stringify(item.raw_data),
        'pending',
        item.source || 'api',
        5,
        0,
        3
      ]);
      
      // Process in sub-batches within transaction
      const subBatchSize = 25;
      let totalAdded = 0;
      
      for (let i = 0; i < values.length; i += subBatchSize) {
        const subBatch = values.slice(i, i + subBatchSize);
        const subValues = subBatch.map((_, index) => {
          const baseIndex = index * 6;
          return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6})`;
        }).join(', ');
        
        const subParams = subBatch.flat();
        
        await client.query(`
          INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
          VALUES ${subValues}
        `, subParams);
        
        totalAdded += subBatch.length;
      }
      
      await client.query('COMMIT');

      logger.info('✅ Super optimized large batch completed', { 
        recordsInserted: totalAdded,
        method: 'large_batch_transaction'
      });

      return {
        success: true,
        added: totalAdded,
        errors: []
      };

    } catch (error) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error in super optimized large batch processing', { error: errorMessage });
      
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
   * Process very large datasets with optimized chunked processing
   */
  private async processChunked(items: QueueItem[]): Promise<ProcessResult> {
    const CHUNK_SIZE = SuperOptimizedQueueService.MAX_CHUNK_SIZE;
    const chunks = [];
    
    // Create optimized chunks
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      chunks.push(items.slice(i, i + CHUNK_SIZE));
    }
    
    logger.info('🔄 Starting super optimized chunked processing', { 
      totalItems: items.length, 
      chunks: chunks.length, 
      chunkSize: CHUNK_SIZE 
    });
    
    let totalAdded = 0;
    const errors: string[] = [];
    
    // Process chunks with optimized concurrency
    const concurrency = Math.min(3, chunks.length); // Process up to 3 chunks concurrently
    
    for (let i = 0; i < chunks.length; i += concurrency) {
      const chunkBatch = chunks.slice(i, i + concurrency);
      
      const chunkPromises = chunkBatch.map(async (chunk, batchIndex) => {
        if (!chunk) return { added: 0, errors: [] };
        
        try {
          const chunkResult = await this.processLargeBatch(chunk);
          return { added: chunkResult.added, errors: chunkResult.errors };
        } catch (chunkError) {
          const errorMessage = chunkError instanceof Error ? chunkError.message : 'Unknown chunk error';
          logger.error(`❌ Error processing chunk ${i + batchIndex + 1}`, { error: errorMessage });
          return { added: 0, errors: [`Chunk ${i + batchIndex + 1}: ${errorMessage}`] };
        }
      });
      
      const chunkResults = await Promise.all(chunkPromises);
      
      for (const result of chunkResults) {
        totalAdded += result.added;
        errors.push(...result.errors);
      }
      
      // Reduced delay between chunk batches
      if (i + concurrency < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, SuperOptimizedQueueService.CHUNK_DELAY));
      }
    }
    
    return {
      success: totalAdded > 0,
      added: totalAdded,
      errors,
      method: 'chunked_concurrent'
    };
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    poolStats: any;
    avgResponseTime: number;
    totalConnections: number;
    activeConnections: number;
  }> {
    const poolStats = this.pool;
    
    return {
      poolStats: {
        totalCount: poolStats.totalCount,
        idleCount: poolStats.idleCount,
        waitingCount: poolStats.waitingCount
      },
      avgResponseTime: 0, // Would need to track this
      totalConnections: poolStats.totalCount,
      activeConnections: poolStats.totalCount - poolStats.idleCount
    };
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Super optimized connection pool closed');
  }
}

export default new SuperOptimizedQueueService();
