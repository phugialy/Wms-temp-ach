import { Pool } from 'pg';
import { logger } from '../utils/logger';
import OptimizedDirectQueueService from './optimized-direct-queue.service';
import { HybridSkuMatchingService } from './HybridSkuMatchingService';
import { IntegratedQueueProcessorService } from './integrated-queue-processor.service';
import * as dotenv from 'dotenv';

dotenv.config();

export interface WorkflowItem {
  imei: string;
  brand?: string;
  model?: string;
  color?: string;
  carrier?: string;
  working?: string;
  capacity?: string;
  location?: string;
  [key: string]: any;
}

export interface WorkflowResult {
  success: boolean;
  totalItems: number;
  queueAdded: number;
  queueErrors: string[];
  processedItems: number;
  processingErrors: string[];
  skuMatchedItems: number;
  undefinedItems: number;
  noMatchItems: number;
  skuMatchingErrors: string[];
  processingTime: number;
  results: Array<{
    imei: string;
    status: 'success' | 'queue_error' | 'processing_error' | 'sku_error';
    product?: any;
    item?: any;
    skuMatch?: any;
    error?: string;
  }>;
}

export class SynchronousWorkflowService {
  private pool: Pool;
  private skuMatchingService: HybridSkuMatchingService;
  private integratedQueueProcessor: IntegratedQueueProcessorService;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env['DIRECT_URL'],
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.skuMatchingService = new HybridSkuMatchingService();
    this.integratedQueueProcessor = new IntegratedQueueProcessorService();
    
    this.pool.on('error', (err: Error) => {
      logger.error('Unexpected error on idle client', err);
    });
  }

  /**
   * Initialize the service and all its dependencies
   */
  async initialize(): Promise<void> {
    try {
      await this.skuMatchingService.initialize();
      await this.integratedQueueProcessor.initialize();
      logger.info('✅ SynchronousWorkflowService initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      logger.error('❌ Failed to initialize SynchronousWorkflowService:', errorMessage);
      throw error;
    }
  }

  /**
   * Complete synchronous workflow: Add → Process → SKU Match
   */
  async processBulkItems(items: WorkflowItem[]): Promise<WorkflowResult> {
    const startTime = performance.now();
    const results: WorkflowResult['results'] = [];
    
    logger.info(`🚀 Starting synchronous workflow for ${items.length} items`);

    try {
      // Step 1: Add items to queue
      logger.info('📥 Step 1: Adding items to queue...');
      const queueResult = await OptimizedDirectQueueService.addToQueue(
        items.map(item => ({
          raw_data: item,
          source: 'bulk-add' as const
        }))
      );

      if (!queueResult.success) {
        throw new Error(`Queue addition failed: ${queueResult.errors.join(', ')}`);
      }

      logger.info(`✅ Step 1 Complete: ${queueResult.added} items added to queue`);

      // Step 2: Process queue items with integrated SKU matching
      logger.info('⚙️ Step 2: Processing queue items with integrated SKU matching...');
      const processingResult = await this.integratedQueueProcessor.processPendingItems();

      logger.info(`✅ Step 2 Complete: ${processingResult.processed} items processed, ${processingResult.skuMatched} SKU matched, ${processingResult.undefined} undefined, ${processingResult.noMatch} no match`);

      // Compile results
      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Create detailed results for each item
      for (const item of items) {
        const result: WorkflowResult['results'][0] = {
          imei: item.imei,
          status: 'success'
        };

        // Add product info if available
        try {
          const product = await this.getProductByImei(item.imei);
          if (product) result.product = product;
        } catch (error) {
          // Product not found, that's okay
        }

        // Add item info if available
        try {
          const itemData = await this.getItemByImei(item.imei);
          if (itemData) result.item = itemData;
        } catch (error) {
          // Item not found, that's okay
        }

        // Add SKU match info if available
        try {
          const skuMatch = await this.getSkuMatchByImei(item.imei);
          if (skuMatch) result.skuMatch = skuMatch;
        } catch (error) {
          // SKU match not found, that's okay
        }

        results.push(result);
      }

      const workflowResult: WorkflowResult = {
        success: true,
        totalItems: items.length,
        queueAdded: queueResult.added,
        queueErrors: queueResult.errors,
        processedItems: processingResult.processed,
        processingErrors: processingResult.errors,
        skuMatchedItems: processingResult.skuMatched,
        undefinedItems: processingResult.undefined,
        noMatchItems: processingResult.noMatch,
        skuMatchingErrors: processingResult.errors,
        processingTime,
        results
      };

      logger.info(`🎉 Workflow Complete: ${processingTime.toFixed(2)}ms total time`);
      return workflowResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Workflow failed:', errorMessage);
      
      const endTime = performance.now();
      return {
        success: false,
        totalItems: items.length,
        queueAdded: 0,
        queueErrors: [errorMessage],
        processedItems: 0,
        processingErrors: [],
        skuMatchedItems: 0,
        undefinedItems: 0,
        noMatchItems: 0,
        skuMatchingErrors: [],
        processingTime: endTime - startTime,
        results: items.map(item => ({
          imei: item.imei,
          status: 'queue_error' as const,
          error: errorMessage
        }))
      };
    }
  }


  /**
   * Run SKU matching on processed items
   */
  private async runSkuMatching(items: WorkflowItem[]): Promise<{ matched: number; errors: string[] }> {
    const errors: string[] = [];
    let matched = 0;

    for (const item of items) {
      try {
        const matchResult = await this.skuMatchingService.matchImeiToSku({
          imei: item.imei,
          model: item.model ?? 'Unknown',
          capacity: item.capacity ?? 'Unknown',
          color: item.color ?? 'Unknown',
          carrier: item.carrier ?? 'Unknown',
          brand: item.brand ?? 'Unknown'
        });
        
        if (matchResult.matches && matchResult.matches.length > 0) {
          matched++;
        }
        
        logger.debug(`SKU match for ${item.imei}: ${matchResult.matches?.length || 0} matches`);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown SKU matching error';
        errors.push(`${item.imei}: ${errorMessage}`);
        logger.error(`SKU matching failed for ${item.imei}:`, errorMessage);
      }
    }

    return { matched, errors };
  }

  /**
   * Get product by IMEI
   */
  private async getProductByImei(imei: string): Promise<any> {
    const result = await this.pool.query(
      'SELECT * FROM product WHERE imei = $1 ORDER BY created_at DESC LIMIT 1',
      [imei]
    );
    return result.rows[0] || null;
  }

  /**
   * Get item by IMEI
   */
  private async getItemByImei(imei: string): Promise<any> {
    const result = await this.pool.query(
      'SELECT * FROM item WHERE imei = $1 ORDER BY created_at DESC LIMIT 1',
      [imei]
    );
    return result.rows[0] || null;
  }

  /**
   * Get SKU match by IMEI
   */
  private async getSkuMatchByImei(imei: string): Promise<any> {
    const result = await this.pool.query(
      'SELECT * FROM sku_matching_results WHERE imei = $1 ORDER BY created_at DESC LIMIT 1',
      [imei]
    );
    return result.rows[0] || null;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.skuMatchingService.cleanup();
      await this.integratedQueueProcessor.cleanup();
      await this.pool.end();
      logger.info('✅ SynchronousWorkflowService cleaned up');
    } catch (error) {
      logger.error('❌ Error during cleanup:', error);
    }
  }
}

export default new SynchronousWorkflowService();
