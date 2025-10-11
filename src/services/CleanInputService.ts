import { logger } from '../utils/logger';
import { DatabaseConnectionService } from './DatabaseConnectionService';
import { SimpleBackgroundProcessor } from './SimpleBackgroundProcessor';
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

export class CleanInputService {
  private dbService: DatabaseConnectionService;
  private backgroundProcessor: SimpleBackgroundProcessor;

  constructor() {
    this.dbService = DatabaseConnectionService.getInstance();
    this.backgroundProcessor = new SimpleBackgroundProcessor();
  }

  /**
   * Process bulk input - returns immediately
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

      // Store device data
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
      
      // Store device data
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
   * Store bulk device data
   */
  private async storeBulkDeviceData(items: BulkInputItem[], batchId: string): Promise<StoredDeviceData[]> {
    const query = `
      INSERT INTO device_input (
        imei, brand, model, capacity, color, carrier, 
        device_notes, working_status, battery_health, 
        source, batch_id, input_status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'received', NOW())
      ON CONFLICT (imei) DO UPDATE SET
        brand = EXCLUDED.brand,
        model = EXCLUDED.model,
        capacity = EXCLUDED.capacity,
        color = EXCLUDED.color,
        carrier = EXCLUDED.carrier,
        device_notes = EXCLUDED.device_notes,
        working_status = EXCLUDED.working_status,
        battery_health = EXCLUDED.battery_health,
        source = EXCLUDED.source,
        batch_id = EXCLUDED.batch_id,
        input_status = 'received',
        updated_at = NOW()
      RETURNING *
    `;

    const storedItems: StoredDeviceData[] = [];

    for (const item of items) {
      try {
        const result = await this.dbService.query(query, [
          item.imei,
          item.brand || null,
          item.model || null,
          item.capacity || null,
          item.color || null,
          item.carrier || null,
          item.device_notes || null,
          item.working_status || null,
          item.battery_health || null,
          'bulk-add',
          batchId
        ]);

        if (result.rows.length > 0) {
          storedItems.push(result.rows[0]);
        }
      } catch (error) {
        logger.error(`❌ Failed to store device data for IMEI ${item.imei}`, error);
        // Continue with other items
      }
    }

    return storedItems;
  }

  /**
   * Store phonecheck device data
   */
  private async storePhonecheckDeviceData(imei: string, phonecheckData: any): Promise<StoredDeviceData> {
    const query = `
      INSERT INTO device_input (
        imei, brand, model, capacity, color, carrier, 
        device_notes, working_status, battery_health, 
        source, input_status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'received', NOW())
      ON CONFLICT (imei) DO UPDATE SET
        brand = EXCLUDED.brand,
        model = EXCLUDED.model,
        capacity = EXCLUDED.capacity,
        color = EXCLUDED.color,
        carrier = EXCLUDED.carrier,
        device_notes = EXCLUDED.device_notes,
        working_status = EXCLUDED.working_status,
        battery_health = EXCLUDED.battery_health,
        source = EXCLUDED.source,
        input_status = 'received',
        updated_at = NOW()
      RETURNING *
    `;

    const result = await this.dbService.query(query, [
      imei,
      phonecheckData.brand || null,
      phonecheckData.model || null,
      phonecheckData.capacity || null,
      phonecheckData.color || null,
      phonecheckData.carrier || null,
      phonecheckData.notes || null,
      phonecheckData.working || null,
      phonecheckData.battery_health || null,
      'phonecheck-add'
    ]);

    return result.rows[0];
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
      brand: device.brand,
      model: device.model,
      capacity: device.capacity,
      color: device.color,
      carrier: device.carrier,
      device_notes: device.device_notes,
      working_status: device.working_status,
      battery_health: device.battery_health,
      source: device.source as 'bulk-add' | 'phonecheck-add' | 'manual' | 'api'
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
  brand?: string;
  model?: string;
  capacity?: string;
  color?: string;
  carrier?: string;
  device_notes?: string;
  working_status?: string;
  battery_health?: string;
  source: string;
  batch_id?: string;
  input_status: string;
  created_at: Date;
  updated_at: Date;
}

export default CleanInputService;


