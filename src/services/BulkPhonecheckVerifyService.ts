import { logger } from '../utils/logger';
import { DatabaseConnectionService } from './DatabaseConnectionService';
import { PhonecheckService } from './phonecheck.service';
import { IntegratedBackgroundProcessor } from './IntegratedBackgroundProcessor';

export interface BulkVerifyItem {
  imei: string;
}

export interface BulkVerifyResult {
  success: boolean;
  batchId: string;
  totalItems: number;
  processedItems: number;
  queuedItems: number;
  failedItems: number;
  errors: string[];
  processingTime: number;
}

export class BulkPhonecheckVerifyService {
  private dbService: DatabaseConnectionService;
  private phonecheckService: PhonecheckService;
  private backgroundProcessor: IntegratedBackgroundProcessor;

  constructor() {
    this.dbService = DatabaseConnectionService.getInstance();
    this.phonecheckService = new PhonecheckService();
    this.backgroundProcessor = new IntegratedBackgroundProcessor();
  }

  async verifyAndQueue(items: BulkVerifyItem[]): Promise<BulkVerifyResult> {
    const startTime = Date.now();
    const batchId = `pc_bulk_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const errors: string[] = [];

    // Validate input
    if (!Array.isArray(items) || items.length === 0) {
      return {
        success: false,
        batchId,
        totalItems: 0,
        processedItems: 0,
        queuedItems: 0,
        failedItems: 0,
        errors: ['Items array is required and must not be empty'],
        processingTime: Date.now() - startTime
      };
    }

    // Normalize and filter IMEIs
    const normalized = items
      .map((x) => ({ imei: String(x.imei || '').trim() }))
      .filter((x) => x.imei.length > 0);

    if (normalized.length === 0) {
      return {
        success: false,
        batchId,
        totalItems: items.length,
        processedItems: 0,
        queuedItems: 0,
        failedItems: items.length,
        errors: ['No valid IMEIs provided'],
        processingTime: Date.now() - startTime
      };
    }

    let processedItems = 0;
    let queuedItems = 0;
    let failedItems = 0;

    logger.info('📦 BULK PHONECHECK VERIFY: starting', { count: normalized.length, batchId });

    // Process sequentially in safe batches to respect API rate limits
    const chunkSize = 20;
    const deviceDataArray: Array<{ imei: string; deviceData: any }> = [];

    for (let i = 0; i < normalized.length; i += chunkSize) {
      const chunk = normalized.slice(i, i + chunkSize);

      // Fetch phonecheck data for the chunk
      for (const { imei } of chunk) {
        if (!this.validateImei(imei)) {
          failedItems++;
          errors.push(`${imei}: Invalid IMEI format`);
          continue;
        }

        try {
          const rawData = await this.phonecheckService.getDeviceDetailsEnhanced(imei, true);
          const abstracted = rawData?.abstracted;
          if (!abstracted || (!abstracted.model && !abstracted.imei)) {
            failedItems++;
            errors.push(`${imei}: Device not found in Phonecheck`);
            continue;
          }

          // Store to imei_data_queue
          await this.storePhonecheckQueueRecord(batchId, abstracted);
          processedItems++;

          // Prepare for background processing
          deviceDataArray.push({
            imei,
            deviceData: this.mapPhonecheckToFlexibleInput(imei, abstracted)
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error('Phonecheck fetch failed', { imei, error: message });
          failedItems++;
          errors.push(`${imei}: ${message}`);
        }
      }
    }

    // Queue background processing non-blocking
    if (deviceDataArray.length > 0) {
      try {
        await this.backgroundProcessor.processMultipleInBackground(deviceDataArray);
        queuedItems = deviceDataArray.length;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Background queueing failed', { error: message });
        errors.push(`Background queueing failed: ${message}`);
      }
    }

    const result: BulkVerifyResult = {
      success: processedItems > 0,
      batchId,
      totalItems: normalized.length,
      processedItems,
      queuedItems,
      failedItems,
      errors,
      processingTime: Date.now() - startTime
    };

    logger.info('✅ BULK PHONECHECK VERIFY: completed', result);
    return result;
  }

  private validateImei(imei: string): boolean {
    return /^\d{8,15}$/.test(imei);
  }

  private async storePhonecheckQueueRecord(batchId: string, data: any): Promise<void> {
    const query = `
      INSERT INTO imei_data_queue (
        imei, brand, model, capacity, color, carrier,
        device_notes, working_status, battery_health,
        source, batch_id, input_status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'phonecheck-bulk', $10, 'received', NOW())
      ON CONFLICT (imei) DO UPDATE SET
        brand = EXCLUDED.brand,
        model = EXCLUDED.model,
        capacity = EXCLUDED.capacity,
        color = EXCLUDED.color,
        carrier = EXCLUDED.carrier,
        device_notes = EXCLUDED.device_notes,
        working_status = EXCLUDED.working_status,
        battery_health = EXCLUDED.battery_health,
        batch_id = EXCLUDED.batch_id,
        input_status = 'received',
        updated_at = NOW()
    `;

    const params = [
      data.imei || null,
      data.brand || null,
      data.model || null,
      data.storage || data.capacity || null,
      data.color || null,
      data.carrier || null,
      data.notes || null,
      data.working || data.working_status || null,
      data.battery_health || null,
      batchId
    ];

    await this.dbService.query(query, params);
  }

  private mapPhonecheckToFlexibleInput(imei: string, data: any): any {
    return {
      imei,
      brand: data.brand || undefined,
      model: data.model || undefined,
      capacity: data.storage || data.capacity || undefined,
      color: data.color || undefined,
      carrier: data.carrier || undefined,
      device_notes: data.notes || undefined,
      working_status: data.working || data.working_status || undefined,
      battery_health: data.battery_health || undefined
    };
  }
}

export default BulkPhonecheckVerifyService;



