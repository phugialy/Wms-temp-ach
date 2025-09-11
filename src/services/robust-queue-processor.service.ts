import { Pool } from 'pg';
import { logger } from '../utils/logger';
import * as dotenv from 'dotenv';

dotenv.config();

export class RobustQueueProcessorService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env['DIRECT_URL'],
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err: Error) => {
      logger.error('Unexpected error on idle client', err);
    });
  }

  /**
   * Process queue items with retry logic and better error handling
   */
  async processQueueItems(expectedCount: number): Promise<{ processed: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;
    let attempts = 0;
    const maxAttempts = 5;
    const retryDelay = 200; // ms

    logger.info(`🔄 Starting robust queue processing for ${expectedCount} items`);

    // Wait for items to be committed
    await new Promise(resolve => setTimeout(resolve, 200));

    while (processed < expectedCount && attempts < maxAttempts) {
      attempts++;
      
      try {
        // Check pending items
        const pendingResult = await this.pool.query(
          'SELECT COUNT(*) as count FROM data_queue WHERE status = \'pending\''
        );
        const pendingCount = parseInt(pendingResult.rows[0]?.count || '0');
        
        logger.info(`📊 Attempt ${attempts}: ${pendingCount} pending items found`);

        if (pendingCount === 0) {
          logger.info('✅ No pending items to process');
          break;
        }

        // Process items
        const batchSize = Math.min(pendingCount, expectedCount - processed);
        const result = await this.pool.query('SELECT * FROM process_queue_batch($1)', [batchSize]);
        const batchResult = result.rows[0];
        
        if (batchResult) {
          const batchProcessed = batchResult.processed || 0;
          const batchErrors = batchResult.errors || 0;
          
          processed += batchProcessed;
          
          if (batchErrors > 0) {
            errors.push(`Batch ${attempts}: ${batchErrors} errors`);
          }

          logger.info(`✅ Batch ${attempts}: ${batchProcessed} processed, ${processed}/${expectedCount} total`);
          
          // If we processed items, continue
          if (batchProcessed > 0) {
            continue;
          }
        }

        // If no items were processed, wait and retry
        if (attempts < maxAttempts) {
          logger.info(`⏳ No items processed in batch ${attempts}, waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
        errors.push(`Batch ${attempts}: ${errorMessage}`);
        logger.error(`❌ Processing batch ${attempts} failed:`, errorMessage);
        
        // Wait before retry
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    if (processed < expectedCount) {
      const remaining = expectedCount - processed;
      errors.push(`Only processed ${processed}/${expectedCount} items after ${attempts} attempts (${remaining} remaining)`);
      logger.warn(`⚠️ Processing incomplete: ${processed}/${expectedCount} items processed`);
    } else {
      logger.info(`🎉 Processing complete: ${processed}/${expectedCount} items processed successfully`);
    }

    return { processed, errors };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{ pending: number; processing: number; completed: number; failed: number }> {
    try {
      const result = await this.pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'processing') as processing,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'failed') as failed
        FROM data_queue
      `);
      
      const stats = result.rows[0];
      return {
        pending: parseInt(stats?.pending || '0'),
        processing: parseInt(stats?.processing || '0'),
        completed: parseInt(stats?.completed || '0'),
        failed: parseInt(stats?.failed || '0')
      };
    } catch (error) {
      logger.error('Error getting queue stats:', error);
      return { pending: 0, processing: 0, completed: 0, failed: 0 };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.pool.end();
  }
}

export default new RobustQueueProcessorService();
