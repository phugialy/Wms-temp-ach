import { Client } from 'pg';
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

export class DirectQueueService {
  private client: Client | null = null;

  private getClient(): Client {
    return new Client({
      connectionString: process.env['DIRECT_URL'],
      connectionTimeoutMillis: 10000
    });
  }

  private async connect(): Promise<void> {
    if (!this.client) {
      this.client = this.getClient();
      await this.client.connect();
    }
  }

  /**
   * Add items to the processing queue using direct PostgreSQL connection
   */
  async addToQueue(items: QueueItem[]): Promise<{ success: boolean; added: number; errors: string[] }> {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      const client = this.getClient();
      try {
        await client.connect();
        logger.info('Adding items to queue via DIRECT_URL', { count: items.length });
      
      const errors: string[] = [];
      let added = 0;
      
      for (const item of items) {
        try {
          const result = await client.query(`
            INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, status, created_at
          `, [
            item.raw_data, // Pass as JSONB object directly, not stringified
            'pending',
            item.source || 'api',
            5, // default priority
            0, // retry_count
            3  // max_retries
          ]);
          
          if (result.rows.length > 0) {
            added++;
            logger.debug('Item added to queue', { id: result.rows[0].id });
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          logger.error('Exception adding item to queue', { error: errorMsg, item });
          errors.push(`Exception adding item: ${errorMsg}`);
        }
      }
      
        logger.info('Queue addition completed', { added, errors: errors.length });
        
        await client.end();
        
        return {
          success: added > 0,
          added,
          errors
        };
        
      } catch (error) {
        await client.end();
        retryCount++;
        logger.error(`Error in addToQueue (attempt ${retryCount}/${maxRetries})`, { error });
        
        if (retryCount >= maxRetries) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
    
    throw new Error('Max retries exceeded');
  }
  
  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    const client = this.getClient();
    try {
      await client.connect();
      
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
      await client.end();
    }
  }
  
  /**
   * Get queue items by status
   */
  async getQueueItems(status?: string, limit: number = 100): Promise<QueueItemStatus[]> {
    try {
      await this.connect();
      
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
      
      const result = await this.client?.query(query, params);
      return result?.rows || [];
      
    } catch (error) {
      logger.error('Error in getQueueItems', { error });
      throw error;
    }
  }
  
  /**
   * Retry failed items
   */
  async retryFailedItems(): Promise<{ retried: number }> {
    try {
      await this.connect();
      
      const result = await this.client?.query(`
        UPDATE data_queue
        SET 
          status = 'pending',
          retry_count = 0,
          error_message = NULL,
          updated_at = NOW()
        WHERE status = 'failed'
        RETURNING id
      `);
      
      const retried = result?.rowCount || 0;
      logger.info('Failed items retry completed', { retried });
      
      return { retried };
      
    } catch (error) {
      logger.error('Error in retryFailedItems', { error });
      throw error;
    }
  }
  
  /**
   * Clear completed items (older than specified days)
   */
  async clearCompletedItems(olderThanDays: number = 7): Promise<{ cleared: number }> {
    try {
      await this.connect();
      
      const result = await this.client?.query(`
        DELETE FROM data_queue
        WHERE status = 'completed'
        AND processed_at < NOW() - INTERVAL '${olderThanDays} days'
        RETURNING id
      `);
      
      const cleared = result?.rowCount || 0;
      logger.info('Completed items cleanup completed', { cleared });
      
      return { cleared };
      
    } catch (error) {
      logger.error('Error in clearCompletedItems', { error });
      throw error;
    }
  }
}

export default new DirectQueueService();
