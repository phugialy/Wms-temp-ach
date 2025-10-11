import { DatabaseConnectionService } from './DatabaseConnectionService';

/**
 * Centralized connection pool manager
 * All services should use this instead of creating their own pools
 */
export class ConnectionPoolManager {
  private static instance: ConnectionPoolManager;
  private dbService: DatabaseConnectionService;

  private constructor() {
    this.dbService = DatabaseConnectionService.getInstance();
  }

  public static getInstance(): ConnectionPoolManager {
    if (!ConnectionPoolManager.instance) {
      ConnectionPoolManager.instance = new ConnectionPoolManager();
    }
    return ConnectionPoolManager.instance;
  }

  /**
   * Get database service instance
   */
  public getDatabaseService(): DatabaseConnectionService {
    return this.dbService;
  }

  /**
   * Execute query using shared connection
   */
  public async query(text: string, params?: any[]): Promise<any> {
    return this.dbService.query(text, params);
  }

  /**
   * Get client from shared pool
   */
  public async getClient(): Promise<any> {
    return this.dbService.getClient();
  }

  /**
   * Execute transaction using shared connection
   */
  public async withTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    return this.dbService.withTransaction(callback);
  }
}

export default ConnectionPoolManager;

