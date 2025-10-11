import { logger } from '../utils/logger';
import { DatabaseConnectionService } from './DatabaseConnectionService';
import { UnifiedSkuMatchingService, FlexibleDeviceInput, UnifiedMatchResult } from './UnifiedSkuMatchingService';

export interface BackgroundProcessingResult {
  success: boolean;
  processed: number;
  errors: string[];
  processingTime: number;
}

export interface DeviceProcessingStatus {
  imei: string;
  inputStatus: 'received' | 'processing' | 'completed' | 'failed';
  skuMatchingStatus: 'pending' | 'matched' | 'no_match' | 'failed';
  matchedSku?: string;
  matchScore?: number;
  confidenceLevel?: string;
  processedAt?: Date;
  errorMessage?: string;
}

export class SimpleBackgroundProcessor {
  private dbService: DatabaseConnectionService;
  private skuMatchingService: UnifiedSkuMatchingService;
  private isProcessing: boolean = false;

  constructor() {
    this.dbService = DatabaseConnectionService.getInstance();
    this.skuMatchingService = new UnifiedSkuMatchingService();
  }

  /**
   * Process device in background (non-blocking)
   */
  async processInBackground(imei: string, deviceData: FlexibleDeviceInput): Promise<void> {
    // Don't wait for completion - run in background
    setImmediate(async () => {
      try {
        await this.processSkuMatching(imei, deviceData);
      } catch (error) {
        await this.logError(imei, error);
      }
    });
  }

  /**
   * Process multiple devices in background
   */
  async processMultipleInBackground(devices: Array<{ imei: string; deviceData: FlexibleDeviceInput }>): Promise<void> {
    // Process each device independently in background
    devices.forEach(({ imei, deviceData }) => {
      this.processInBackground(imei, deviceData);
    });
  }

  /**
   * Process SKU matching for a single device
   */
  private async processSkuMatching(imei: string, deviceData: FlexibleDeviceInput): Promise<void> {
    try {
      logger.info(`🔄 BACKGROUND PROCESSING: Starting SKU matching for ${imei}`);
      
      // Update status to processing
      await this.updateDeviceStatus(imei, 'processing');
      
      // Run SKU matching
      const skuResult = await this.skuMatchingService.matchDevice(deviceData);
      
      // Store SKU matching results
      await this.storeSkuMatchingResults(imei, skuResult);
      
      // Update status to completed
      await this.updateDeviceStatus(imei, 'completed');
      
      logger.info(`✅ BACKGROUND PROCESSING: Completed SKU matching for ${imei}`, {
        matchedSku: skuResult.bestMatch?.sku_code,
        matchScore: skuResult.highestScore,
        confidenceLevel: skuResult.confidenceLevel
      });
      
    } catch (error) {
      logger.error(`❌ BACKGROUND PROCESSING: Failed SKU matching for ${imei}`, error);
      await this.handleError(imei, error);
    }
  }

  /**
   * Store SKU matching results in database
   */
  private async storeSkuMatchingResults(imei: string, skuResult: UnifiedMatchResult): Promise<void> {
    try {
      const query = `
        INSERT INTO sku_matching_results (
          imei, 
          matched_sku, 
          match_score, 
          confidence_level, 
          match_status, 
          total_matches,
          best_match_sku,
          processing_time,
          data_completeness,
          requires_attention,
          processed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (imei) DO UPDATE SET
          matched_sku = EXCLUDED.matched_sku,
          match_score = EXCLUDED.match_score,
          confidence_level = EXCLUDED.confidence_level,
          match_status = EXCLUDED.match_status,
          total_matches = EXCLUDED.total_matches,
          best_match_sku = EXCLUDED.best_match_sku,
          processing_time = EXCLUDED.processing_time,
          data_completeness = EXCLUDED.data_completeness,
          requires_attention = EXCLUDED.requires_attention,
          processed_at = EXCLUDED.processed_at,
          updated_at = NOW()
      `;
      
      const params = [
        imei,
        skuResult.bestMatch?.sku_code || null,
        skuResult.highestScore,
        skuResult.confidenceLevel,
        skuResult.requiresAttention ? 'requires_attention' : 'matched',
        skuResult.totalMatches,
        skuResult.bestMatch?.sku_code || null,
        skuResult.processingTime,
        skuResult.dataCompleteness,
        skuResult.requiresAttention
      ];
      
      await this.dbService.query(query, params);
      
      // Store individual matches if needed
      if (skuResult.matches.length > 0) {
        await this.storeIndividualMatches(imei, skuResult.matches);
      }
      
    } catch (error) {
      logger.error(`❌ Failed to store SKU matching results for ${imei}`, error);
      throw error;
    }
  }

  /**
   * Store individual SKU matches
   */
  private async storeIndividualMatches(imei: string, matches: any[]): Promise<void> {
    try {
      const query = `
        INSERT INTO sku_match_details (
          imei,
          sku_code,
          match_score,
          confidence_level,
          match_type,
          matched_characteristics,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (imei, sku_code) DO UPDATE SET
          match_score = EXCLUDED.match_score,
          confidence_level = EXCLUDED.confidence_level,
          match_type = EXCLUDED.match_type,
          matched_characteristics = EXCLUDED.matched_characteristics,
          updated_at = NOW()
      `;
      
      for (const match of matches) {
        await this.dbService.query(query, [
          imei,
          match.sku_code,
          match.match_score,
          match.confidence_level,
          match.match_type,
          JSON.stringify(match.matched_characteristics)
        ]);
      }
      
    } catch (error) {
      logger.error(`❌ Failed to store individual matches for ${imei}`, error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Update device processing status
   */
  private async updateDeviceStatus(imei: string, status: 'processing' | 'completed' | 'failed'): Promise<void> {
    try {
      const query = `
        UPDATE device_input 
        SET input_status = $1, updated_at = NOW()
        WHERE imei = $2
      `;
      
      await this.dbService.query(query, [status, imei]);
      
    } catch (error) {
      logger.error(`❌ Failed to update device status for ${imei}`, error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Handle processing errors
   */
  private async handleError(imei: string, error: any): Promise<void> {
    try {
      // Update status to failed
      await this.updateDeviceStatus(imei, 'failed');
      
      // Store error details
      const query = `
        UPDATE device_input 
        SET error_message = $1, updated_at = NOW()
        WHERE imei = $2
      `;
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.dbService.query(query, [errorMessage, imei]);
      
      // Store in error log
      await this.logError(imei, error);
      
    } catch (logError) {
      logger.error(`❌ Failed to handle error for ${imei}`, logError);
    }
  }

  /**
   * Log error details
   */
  private async logError(imei: string, error: any): Promise<void> {
    try {
      const query = `
        INSERT INTO processing_errors (
          imei,
          error_message,
          error_type,
          stack_trace,
          created_at
        ) VALUES ($1, $2, $3, $4, NOW())
      `;
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
      const stackTrace = error instanceof Error ? error.stack : '';
      
      await this.dbService.query(query, [imei, errorMessage, errorType, stackTrace]);
      
    } catch (logError) {
      logger.error(`❌ Failed to log error for ${imei}`, logError);
    }
  }

  /**
   * Get device processing status
   */
  async getDeviceStatus(imei: string): Promise<DeviceProcessingStatus | null> {
    try {
      const query = `
        SELECT 
          di.imei,
          di.input_status,
          di.error_message,
          smr.matched_sku,
          smr.match_score,
          smr.confidence_level,
          smr.match_status,
          smr.processed_at
        FROM device_input di
        LEFT JOIN sku_matching_results smr ON di.imei = smr.imei
        WHERE di.imei = $1
      `;
      
      const result = await this.dbService.query(query, [imei]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      
      return {
        imei: row.imei,
        inputStatus: row.input_status,
        skuMatchingStatus: row.match_status || 'pending',
        matchedSku: row.matched_sku,
        matchScore: row.match_score,
        confidenceLevel: row.confidence_level,
        processedAt: row.processed_at,
        errorMessage: row.error_message
      };
      
    } catch (error) {
      logger.error(`❌ Failed to get device status for ${imei}`, error);
      return null;
    }
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN input_status = 'received' THEN 1 END) as pending,
          COUNT(CASE WHEN input_status = 'processing' THEN 1 END) as processing,
          COUNT(CASE WHEN input_status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN input_status = 'failed' THEN 1 END) as failed
        FROM device_input
      `;
      
      const result = await this.dbService.query(query);
      return result.rows[0];
      
    } catch (error) {
      logger.error(`❌ Failed to get processing stats`, error);
      return {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0
      };
    }
  }

  /**
   * Retry failed devices
   */
  async retryFailedDevices(): Promise<BackgroundProcessingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let processed = 0;
    
    try {
      // Get failed devices
      const query = `
        SELECT imei, brand, model, capacity, color, carrier, device_notes, working_status, battery_health, source
        FROM device_input
        WHERE input_status = 'failed'
        ORDER BY created_at ASC
        LIMIT 100
      `;
      
      const result = await this.dbService.query(query);
      const failedDevices = result.rows;
      
      if (failedDevices.length === 0) {
        return { success: true, processed: 0, errors: [], processingTime: Date.now() - startTime };
      }
      
      logger.info(`🔄 Retrying ${failedDevices.length} failed devices`);
      
      // Process each failed device
      for (const device of failedDevices) {
        try {
          const deviceData: FlexibleDeviceInput = {
            imei: device.imei,
            brand: device.brand,
            model: device.model,
            capacity: device.capacity,
            color: device.color,
            carrier: device.carrier,
            device_notes: device.device_notes,
            working_status: device.working_status,
            battery_health: device.battery_health,
            source: device.source
          };
          
          await this.processSkuMatching(device.imei, deviceData);
          processed++;
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`${device.imei}: ${errorMessage}`);
        }
      }
      
      return {
        success: true,
        processed,
        errors,
        processingTime: Date.now() - startTime
      };
      
    } catch (error) {
      logger.error(`❌ Failed to retry failed devices`, error);
      return {
        success: false,
        processed,
        errors: [...errors, error instanceof Error ? error.message : String(error)],
        processingTime: Date.now() - startTime
      };
    }
  }
}

export default SimpleBackgroundProcessor;


