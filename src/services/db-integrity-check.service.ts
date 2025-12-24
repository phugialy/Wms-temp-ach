import { Pool } from 'pg';
import { PhonecheckService } from './phonecheck.service';
import { logger } from '../utils/logger';

export interface IntegrityCheckOptions {
  missingFields?: ('model' | 'capacity' | 'color' | 'carrier')[];
  batchSize?: number;
  maxItems?: number;
  delayBetweenBatches?: number; // milliseconds
}

export interface MissingDataRecord {
  imei: string;
  missingFields: string[];
  model?: string | null;
  capacity?: string | null;
  color?: string | null;
  carrier?: string | null;
}

export interface IntegrityCheckResult {
  success: boolean;
  totalScanned: number;
  recordsWithMissingData: number;
  recordsProcessed: number;
  recordsUpdated: number;
  recordsFailed: number;
  errors: Array<{ imei: string; error: string }>;
  processingTime: number; // milliseconds
  details: {
    found: MissingDataRecord[];
    processed: Array<{ imei: string; status: 'updated' | 'failed' | 'no_data' }>;
  };
}

export class DbIntegrityCheckService {
  private pool: Pool;
  private phonecheckService: PhonecheckService;

  constructor(pool: Pool) {
    this.pool = pool;
    this.phonecheckService = new PhonecheckService();
  }

  /**
   * Execute SQL query using direct PostgreSQL connection
   * 
   * Note: Supabase MCP tools (mcp_supabase_execute_sql) can be used for verification/testing
   * in development, but the service uses direct connections for production runtime.
   * MCP tools are available in AI assistant context for query verification.
   */
  private async executeQuery(query: string, params: any[] = []): Promise<any> {
    return await this.pool.query(query, params);
  }

  /**
   * Scan database for records with missing identification fields
   */
  async scanForMissingData(
    options: IntegrityCheckOptions = {}
  ): Promise<{ success: boolean; records: MissingDataRecord[]; total: number }> {
    try {
      const {
        missingFields = ['model', 'capacity', 'color', 'carrier'],
        maxItems = 1000
      } = options;

      logger.info('Scanning database for records with missing data', { missingFields, maxItems });

      // Build WHERE conditions for missing fields
      const conditions: string[] = [];
      const fieldsToCheck = {
        model: 'model IS NULL OR model = \'\' OR model = \'N/A\'',
        capacity: 'capacity IS NULL OR capacity = \'\' OR capacity = \'N/A\'',
        color: 'color IS NULL OR color = \'\' OR color = \'N/A\'',
        carrier: 'carrier IS NULL OR carrier = \'\' OR carrier = \'N/A\''
      };

      missingFields.forEach((field) => {
        if (fieldsToCheck[field]) {
          conditions.push(`(${fieldsToCheck[field]})`);
        }
      });

      if (conditions.length === 0) {
        return { success: true, records: [], total: 0 };
      }

      const whereClause = conditions.join(' OR ');

      // Query the item table for records with missing data
      const query = `
        SELECT 
          imei,
          model,
          capacity,
          color,
          carrier
        FROM item
        WHERE ${whereClause}
        ORDER BY imei
        LIMIT $1
      `;

      const result = await this.executeQuery(query, [maxItems]);

      const records: MissingDataRecord[] = result.rows.map((row: {
        imei: string;
        model: string | null;
        capacity: string | null;
        color: string | null;
        carrier: string | null;
      }) => {
        const missing: string[] = [];
        
        if (!row.model || row.model === '' || row.model === 'N/A') {
          missing.push('model');
        }
        if (!row.capacity || row.capacity === '' || row.capacity === 'N/A') {
          missing.push('capacity');
        }
        if (!row.color || row.color === '' || row.color === 'N/A') {
          missing.push('color');
        }
        if (!row.carrier || row.carrier === '' || row.carrier === 'N/A') {
          missing.push('carrier');
        }

        return {
          imei: row.imei,
          missingFields: missing,
          model: row.model,
          capacity: row.capacity,
          color: row.color,
          carrier: row.carrier
        };
      });

      logger.info(`Found ${records.length} records with missing data`);

      return {
        success: true,
        records,
        total: records.length
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error scanning for missing data', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Validate if IMEI format is compatible with PhoneCheck API
   * PhoneCheck API only accepts numeric IMEIs (8-15 digits)
   */
  private isValidImeiForPhoneCheck(imei: string): boolean {
    // PhoneCheck API only works with numeric IMEIs
    // Standard IMEIs are 15 digits, but some APIs accept 8-15 digits
    return /^\d{8,15}$/.test(imei);
  }

  /**
   * Fetch data from PhoneCheck API for a single IMEI
   */
  private async fetchPhoneCheckData(imei: string): Promise<any | null> {
    try {
      // Skip PhoneCheck API lookup for non-numeric IMEIs (e.g., serial numbers, alphanumeric IDs)
      if (!this.isValidImeiForPhoneCheck(imei)) {
        logger.info(`Skipping PhoneCheck API lookup for non-numeric IMEI: ${imei}`, {
          reason: 'PhoneCheck API only accepts numeric IMEIs (8-15 digits)',
          imeiFormat: 'alphanumeric_or_serial_number'
        });
        return null;
      }

      const rawData = await this.phonecheckService.getDeviceDetails(imei);
      const abstractedData = this.phonecheckService.abstractDeviceData(rawData);
      
      return abstractedData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Failed to fetch PhoneCheck data for IMEI ${imei}`, { 
        error: errorMessage,
        imei
      });
      return null;
    }
  }

  /**
   * Update database record with PhoneCheck data
   */
  private async updateRecordWithPhoneCheckData(
    imei: string,
    phoneCheckData: any
  ): Promise<boolean> {
    try {
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Map PhoneCheck data to database fields
      if (phoneCheckData.model && phoneCheckData.model !== 'N/A') {
        updateFields.push(`model = $${paramIndex}`);
        values.push(phoneCheckData.model);
        paramIndex++;
      }

      if (phoneCheckData.storage && phoneCheckData.storage !== 'N/A') {
        updateFields.push(`capacity = $${paramIndex}`);
        values.push(phoneCheckData.storage);
        paramIndex++;
      }

      if (phoneCheckData.color && phoneCheckData.color !== 'N/A') {
        updateFields.push(`color = $${paramIndex}`);
        values.push(phoneCheckData.color);
        paramIndex++;
      }

      if (phoneCheckData.carrier && phoneCheckData.carrier !== 'N/A') {
        updateFields.push(`carrier = $${paramIndex}`);
        values.push(phoneCheckData.carrier);
        paramIndex++;
      }

      // Only update if we have fields to update
      if (updateFields.length === 0) {
        return false;
      }

      // Add updated_at timestamp (doesn't need a parameter)
      updateFields.push(`updated_at = NOW()`);
      
      // Add IMEI to values for WHERE clause
      values.push(imei);

      const updateQuery = `
        UPDATE item
        SET ${updateFields.join(', ')}
        WHERE imei = $${paramIndex}
      `;

      await this.executeQuery(updateQuery, values);

      logger.debug(`Updated record for IMEI ${imei}`, { 
        fieldsUpdated: updateFields.length - 1 
      });

      return true;

    } catch (error) {
      logger.error(`Error updating record for IMEI ${imei}`, { error });
      throw error;
    }
  }

  /**
   * Process missing data records in batches
   */
  async processMissingData(
    records: MissingDataRecord[],
    options: IntegrityCheckOptions = {}
  ): Promise<IntegrityCheckResult> {
    const startTime = Date.now();
    const {
      batchSize = 5,
      delayBetweenBatches = 1000 // 1 second delay between batches
    } = options;

    const result: IntegrityCheckResult = {
      success: true,
      totalScanned: records.length,
      recordsWithMissingData: records.length,
      recordsProcessed: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors: [],
      processingTime: 0,
      details: {
        found: records,
        processed: []
      }
    };

    try {
      logger.info(`Processing ${records.length} records with missing data`, {
        batchSize,
        delayBetweenBatches
      });

      // Process records in batches
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        logger.info(`Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} items)`);

        // Process batch in parallel
        const batchPromises = batch.map(async (record) => {
          try {
            result.recordsProcessed++;

            // Fetch data from PhoneCheck
            const phoneCheckData = await this.fetchPhoneCheckData(record.imei);

            if (!phoneCheckData) {
              result.recordsFailed++;
              
              // Provide more specific error message based on IMEI format
              const isNonNumericImei = !this.isValidImeiForPhoneCheck(record.imei);
              const errorMessage = isNonNumericImei
                ? `IMEI format not compatible with PhoneCheck API (PhoneCheck only accepts numeric IMEIs: 8-15 digits, but received: ${record.imei})`
                : 'No data available from PhoneCheck API';
              
              result.details.processed.push({
                imei: record.imei,
                status: 'no_data'
              });
              result.errors.push({
                imei: record.imei,
                error: errorMessage
              });
              return;
            }

            // Update database record
            const updated = await this.updateRecordWithPhoneCheckData(
              record.imei,
              phoneCheckData
            );

            if (updated) {
              result.recordsUpdated++;
              result.details.processed.push({
                imei: record.imei,
                status: 'updated'
              });
            } else {
              result.recordsFailed++;
              result.details.processed.push({
                imei: record.imei,
                status: 'failed'
              });
              result.errors.push({
                imei: record.imei,
                error: 'No valid fields to update'
              });
            }

          } catch (error) {
            result.recordsFailed++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push({
              imei: record.imei,
              error: errorMessage
            });
            result.details.processed.push({
              imei: record.imei,
              status: 'failed'
            });
            logger.error(`Error processing record ${record.imei}`, { error: errorMessage });
          }
        });

        await Promise.all(batchPromises);

        // Delay between batches to avoid API rate limiting
        if (i + batchSize < records.length && delayBetweenBatches > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }

      result.processingTime = Date.now() - startTime;
      result.success = result.recordsFailed === 0 || result.recordsUpdated > 0;

      logger.info('Integrity check processing completed', {
        totalScanned: result.totalScanned,
        recordsUpdated: result.recordsUpdated,
        recordsFailed: result.recordsFailed,
        processingTime: result.processingTime
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error during integrity check processing', { error: errorMessage });
      result.success = false;
      result.errors.push({
        imei: 'BATCH',
        error: errorMessage
      });
    }

    return result;
  }

  /**
   * Run complete integrity check: scan + process
   */
  async runIntegrityCheck(
    options: IntegrityCheckOptions = {}
  ): Promise<IntegrityCheckResult> {
    try {
      logger.info('Starting complete integrity check', { options });

      // Step 1: Scan for missing data
      const scanResult = await this.scanForMissingData(options);

      if (scanResult.records.length === 0) {
        return {
          success: true,
          totalScanned: 0,
          recordsWithMissingData: 0,
          recordsProcessed: 0,
          recordsUpdated: 0,
          recordsFailed: 0,
          errors: [],
          processingTime: 0,
          details: {
            found: [],
            processed: []
          }
        };
      }

      // Step 2: Process missing data
      const processResult = await this.processMissingData(scanResult.records, options);

      return processResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error running integrity check', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Get statistics about missing data in the database
   */
  async getMissingDataStats(): Promise<{
    success: boolean;
    stats: {
      totalRecords: number;
      missingModel: number;
      missingCapacity: number;
      missingColor: number;
      missingCarrier: number;
      missingAnyField: number;
    };
  }> {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_records,
          COUNT(CASE WHEN model IS NULL OR model = '' OR model = 'N/A' THEN 1 END) as missing_model,
          COUNT(CASE WHEN capacity IS NULL OR capacity = '' OR capacity = 'N/A' THEN 1 END) as missing_capacity,
          COUNT(CASE WHEN color IS NULL OR color = '' OR color = 'N/A' THEN 1 END) as missing_color,
          COUNT(CASE WHEN carrier IS NULL OR carrier = '' OR carrier = 'N/A' THEN 1 END) as missing_carrier,
          COUNT(CASE WHEN 
            (model IS NULL OR model = '' OR model = 'N/A') OR
            (capacity IS NULL OR capacity = '' OR capacity = 'N/A') OR
            (color IS NULL OR color = '' OR color = 'N/A') OR
            (carrier IS NULL OR carrier = '' OR carrier = 'N/A')
          THEN 1 END) as missing_any_field
        FROM item
      `;

      const result = await this.executeQuery(statsQuery);

      return {
        success: true,
        stats: {
          totalRecords: parseInt(result.rows[0].total_records) || 0,
          missingModel: parseInt(result.rows[0].missing_model) || 0,
          missingCapacity: parseInt(result.rows[0].missing_capacity) || 0,
          missingColor: parseInt(result.rows[0].missing_color) || 0,
          missingCarrier: parseInt(result.rows[0].missing_carrier) || 0,
          missingAnyField: parseInt(result.rows[0].missing_any_field) || 0
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting missing data stats', { error: errorMessage });
      throw error;
    }
  }
}
