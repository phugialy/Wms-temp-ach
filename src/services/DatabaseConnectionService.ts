import { Pool, PoolClient, PoolConfig } from 'pg';
import { logger } from '../utils/logger';

export class DatabaseConnectionService {
  private static instance: DatabaseConnectionService;
  private pool!: Pool;
  private isInitialized = false;
  private connectionAttempts = 0;
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  private constructor() {
    this.initializePool();
  }

  public static getInstance(): DatabaseConnectionService {
    if (!DatabaseConnectionService.instance) {
      DatabaseConnectionService.instance = new DatabaseConnectionService();
    }
    return DatabaseConnectionService.instance;
  }

  private initializePool(): void {
    const config: PoolConfig = {
      connectionString: process.env['DIRECT_URL'],
      ssl: { rejectUnauthorized: false },
      // Connection pool settings (optimized for free tier)
      max: 3, // Maximum number of clients in the pool (reduced for free tier)
      min: 1,  // Minimum number of clients in the pool
      idleTimeoutMillis: 10000, // Close idle clients after 10 seconds (faster cleanup)
      connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection could not be established
      // acquireTimeoutMillis: 30000, // Not available in this version of pg
      // Keep-alive settings
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      // Statement timeout
      statement_timeout: 30000, // 30 seconds
      // Query timeout
      query_timeout: 30000, // 30 seconds
    };

    this.pool = new Pool(config);

    // Handle pool errors
    this.pool.on('error', (err: Error) => {
      logger.error('Unexpected error on idle client:', err);
      this.handleConnectionError(err);
    });

    // Handle pool connect events
    this.pool.on('connect', (client: PoolClient) => {
      logger.debug('New client connected to database');
      this.connectionAttempts = 0; // Reset on successful connection
    });

    // Handle pool acquire events
    this.pool.on('acquire', (client: PoolClient) => {
      logger.debug('Client acquired from pool');
    });

    // Handle pool remove events
    this.pool.on('remove', (client: PoolClient) => {
      logger.debug('Client removed from pool');
    });

    this.isInitialized = true;
  }

  private async handleConnectionError(error: Error): Promise<void> {
    logger.error('Database connection error:', error);
    
    if (this.connectionAttempts < this.maxRetries) {
      this.connectionAttempts++;
      logger.info(`Retrying database connection (attempt ${this.connectionAttempts}/${this.maxRetries})`);
      
      setTimeout(() => {
        this.reconnect();
      }, this.retryDelay * this.connectionAttempts);
    } else {
      logger.error('Max connection retry attempts reached. Database connection failed.');
    }
  }

  private async reconnect(): Promise<void> {
    try {
      if (this.pool) {
        await this.pool.end();
      }
      this.initializePool();
      await this.testConnection();
    } catch (error) {
      logger.error('Failed to reconnect to database:', error);
    }
  }

  private async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      logger.info('Database connection test successful');
      return true;
    } catch (error) {
      logger.error('Database connection test failed:', error);
      return false;
    }
  }

  public async getClient(): Promise<PoolClient> {
    if (!this.isInitialized) {
      throw new Error('Database connection service not initialized');
    }

    try {
      const client = await this.pool.connect();
      return client;
    } catch (error) {
      logger.error('Failed to acquire database client:', error);
      throw error;
    }
  }

  public async query(text: string, params?: any[]): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Database connection service not initialized');
    }

    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (duration > 5000) { // Log slow queries
        logger.warn(`Slow query detected (${duration}ms): ${text.substring(0, 100)}...`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`Query failed after ${duration}ms:`, error);
      logger.error(`Query: ${text}`);
      logger.error(`Params: ${JSON.stringify(params)}`);
      throw error;
    }
  }

  public async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.isInitialized = false;
      logger.info('Database connection pool closed');
    }
  }

  public getPoolStats(): any {
    if (!this.pool) {
      return null;
    }

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      isInitialized: this.isInitialized,
      connectionAttempts: this.connectionAttempts
    };
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const dbService = DatabaseConnectionService.getInstance();
