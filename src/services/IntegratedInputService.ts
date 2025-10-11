import { logger } from '../utils/logger';
import { DatabaseConnectionService } from './DatabaseConnectionService';
import { IntegratedBackgroundProcessor } from './IntegratedBackgroundProcessor';
import { FlexibleDeviceInput } from './UnifiedSkuMatchingService';

export interface BulkInputItem {
  imei: string;
  brand?: string;
  model?: string;
  capacity?: string;
  color?: string;
  carrier?: string;
  device_notes?: string;
  working_status?: string;
  battery_health?: string;
}

export interface PhonecheckInputItem {
  imei: string;
}

export interface InputResult {
  success: boolean;
  processed: number;
  queued: number;
  errors: string[];
  message: string;
  processingTime: number;
}

export interface BulkInputResult extends InputResult {
  batchId: string;
}

export interface PhonecheckInputResult extends InputResult {
  imei: string;
  deviceData?: any;
}

export class IntegratedInputService {
  private dbService: DatabaseConnectionService;
  private backgroundProcessor: IntegratedBackgroundProcessor;

  constructor() {
    this.dbService = DatabaseConnectionService.getInstance();
    this.backgroundProcessor = new IntegratedBackgroundProcessor();
  }

  /**
   * Process bulk input - returns immediately (works with existing imei_data_queue)
   */
  async processBulkInput(items: BulkInputItem[]): Promise<BulkInputResult> {
    const startTime = Date.now();
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const errors: string[] = [];
    let processed = 0;
    let queued = 0;

    try {
      logger.info(`📥 BULK INPUT: Processing ${items.length} items`, { batchId });

      // Validate input
      const validationResult = this.validateBulkInput(items);
      if (!validationResult.isValid) {
        return {
          success: false,
          processed: 0,
          queued: 0,
          errors: [validationResult.error || 'Unknown validation error'],
          message: 'Input validation failed',
          processingTime: Date.now() - startTime,
          batchId
        };
      }

      // Store device data in existing imei_data_queue table
      const storedItems = await this.storeBulkDeviceData(items, batchId);
      processed = storedItems.length;

      // Queue for background processing
      const deviceDataArray = storedItems.map(item => ({
        imei: item.imei,
        deviceData: this.mapToFlexibleDeviceInput(item)
      }));

      await this.backgroundProcessor.processMultipleInBackground(deviceDataArray);
      queued = deviceDataArray.length;

      logger.info(`✅ BULK INPUT: Processed ${processed} items, queued ${queued} for SKU matching`, { batchId });

      return {
        success: true,
        processed,
        queued,
        errors,
        message: `Successfully processed ${processed} items and queued for SKU matching`,
        processingTime: Date.now() - startTime,
        batchId
      };

    } catch (error) {
      logger.error(`❌ BULK INPUT: Failed to process bulk input`, error);
      return {
        success: false,
        processed,
        queued,
        errors: [...errors, error instanceof Error ? error.message : String(error)],
        message: 'Failed to process bulk input',
        processingTime: Date.now() - startTime,
        batchId
      };
    }
  }

  /**
   * Process phonecheck input - returns immediately
   */
  async processPhonecheckInput(imei: string): Promise<PhonecheckInputResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      logger.info(`📱 PHONECHECK INPUT: Processing IMEI ${imei}`);

      // Validate IMEI
      if (!this.validateImei(imei)) {
        return {
          success: false,
          processed: 0,
          queued: 0,
          errors: ['Invalid IMEI format'],
          message: 'Invalid IMEI format',
          processingTime: Date.now() - startTime,
          imei
        };
      }

      // Fetch device data from Phonecheck API
      const phonecheckData = await this.fetchPhonecheckData(imei);
      
      // Store device data in existing imei_data_queue table
      const storedDevice = await this.storePhonecheckDeviceData(imei, phonecheckData);
      
      // Queue for background processing
      const deviceData = this.mapPhonecheckToFlexibleDeviceInput(imei, phonecheckData);
      await this.backgroundProcessor.processInBackground(imei, deviceData);

      logger.info(`✅ PHONECHECK INPUT: Processed IMEI ${imei} and queued for SKU matching`);

      return {
        success: true,
        processed: 1,
        queued: 1,
        errors,
        message: 'Device data fetched and queued for SKU matching',
        processingTime: Date.now() - startTime,
        imei,
        deviceData: phonecheckData
      };

    } catch (error) {
      logger.error(`❌ PHONECHECK INPUT: Failed to process IMEI ${imei}`, error);
      return {
        success: false,
        processed: 0,
        queued: 0,
        errors: [...errors, error instanceof Error ? error.message : String(error)],
        message: 'Failed to process phonecheck input',
        processingTime: Date.now() - startTime,
        imei
      };
    }
  }

  /**
   * Validate bulk input
   */
  private validateBulkInput(items: BulkInputItem[]): { isValid: boolean; error?: string } {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return { isValid: false, error: 'Items array is required and cannot be empty' };
    }

    const invalidItems = items.filter(item => !item.imei || !this.validateImei(item.imei));
    if (invalidItems.length > 0) {
      return { isValid: false, error: `${invalidItems.length} items have invalid IMEI numbers` };
    }

    return { isValid: true };
  }

  /**
   * Validate IMEI format
   */
  private validateImei(imei: string | undefined): boolean {
    if (!imei || typeof imei !== 'string') return false;
    return /^\d{8,15}$/.test(imei);
  }

  /**
   * Store bulk device data in existing imei_data_queue table
   */
  private async storeBulkDeviceData(items: BulkInputItem[], batchId: string): Promise<StoredDeviceData[]> {
    const query = `
      INSERT INTO imei_data_queue (
        raw_data, 
        source, 
        status, 
        batch_id, 
        input_status, 
        created_at
      ) VALUES ($1, $2, 'pending', $3, 'received', NOW())
      ON CONFLICT DO NOTHING
      RETURNING *
    `;

    const storedItems: StoredDeviceData[] = [];

    for (const item of items) {
      try {
        const rawData = {
          imei: item.imei,
          brand: item.brand,
          model: item.model,
          capacity: item.capacity,
          color: item.color,
          carrier: item.carrier,
          device_notes: item.device_notes,
          working_status: item.working_status,
          battery_health: item.battery_health,
          source: 'bulk-add',
          batch_id: batchId
        };

        const result = await this.dbService.query(query, [
          JSON.stringify(rawData),
          'bulk-add',
          batchId
        ]);

        if (result.rows.length > 0) {
          storedItems.push({
            id: result.rows[0].id,
            imei: item.imei,
            rawData: rawData
          });
        }
      } catch (error) {
        logger.error(`❌ Failed to store device data for IMEI ${item.imei}`, error);
        // Continue with other items
      }
    }

    return storedItems;
  }

  /**
   * Store phonecheck device data in existing imei_data_queue table
   */
  private async storePhonecheckDeviceData(imei: string, phonecheckData: any): Promise<StoredDeviceData> {
    const query = `
      INSERT INTO imei_data_queue (
        raw_data, 
        source, 
        status, 
        input_status, 
        created_at
      ) VALUES ($1, $2, 'pending', 'received', NOW())
      ON CONFLICT DO NOTHING
      RETURNING *
    `;

    const rawData = {
      imei: imei,
      brand: phonecheckData.brand,
      model: phonecheckData.model,
      capacity: phonecheckData.capacity,
      color: phonecheckData.color,
      carrier: phonecheckData.carrier,
      device_notes: phonecheckData.notes,
      working_status: phonecheckData.working,
      battery_health: phonecheckData.battery_health,
      source: 'phonecheck-add'
    };

    const result = await this.dbService.query(query, [
      JSON.stringify(rawData),
      'phonecheck-add'
    ]);

    return {
      id: result.rows[0].id,
      imei: imei,
      rawData: rawData
    };
  }

  /**
   * Fetch device data from Phonecheck API
   */
  private async fetchPhonecheckData(imei: string): Promise<any> {
    // This would integrate with your existing Phonecheck API
    // For now, return mock data
    return {
      brand: 'Samsung',
      model: 'Galaxy S23',
      capacity: '256GB',
      color: 'Black',
      carrier: 'Unlocked',
      notes: 'Phonecheck data',
      working: 'YES',
      battery_health: '85%'
    };
  }

  /**
   * Map stored device data to flexible device input
   */
  private mapToFlexibleDeviceInput(device: StoredDeviceData): FlexibleDeviceInput {
    return {
      imei: device.imei,
      brand: device.rawData.brand,
      model: device.rawData.model,
      capacity: device.rawData.capacity,
      color: device.rawData.color,
      carrier: device.rawData.carrier,
      device_notes: device.rawData.device_notes,
      working_status: device.rawData.working_status,
      battery_health: device.rawData.battery_health,
      source: device.rawData.source
    };
  }

  /**
   * Map phonecheck data to flexible device input
   */
  private mapPhonecheckToFlexibleDeviceInput(imei: string, phonecheckData: any): FlexibleDeviceInput {
    return {
      imei,
      brand: phonecheckData.brand,
      model: phonecheckData.model,
      capacity: phonecheckData.capacity,
      color: phonecheckData.color,
      carrier: phonecheckData.carrier,
      device_notes: phonecheckData.notes,
      working_status: phonecheckData.working,
      battery_health: phonecheckData.battery_health,
      source: 'phonecheck-add'
    };
  }
}

// Type definitions
interface StoredDeviceData {
  id: number;
  imei: string;
  rawData: any;
}

export default IntegratedInputService;


