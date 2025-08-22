import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

export interface PhoneCheckData {
  imei: string;
  deviceName: string;
  brand: string;
  model: string;
  storage: string;
  color: string;
  carrier: string;
  workingStatus: string;
  batteryHealth: number;
  condition: string;
  rawData: any; // Full PhoneCheck response
}

export interface BulkProcessingResult {
  success: boolean;
  processed: number;
  errors: string[];
  details: {
    imeiDetailsCreated: number;
    imeiDetailsUpdated: number;
    inventoryItemsCreated: number;
    inventoryItemsUpdated: number;
    inventoryUnitsCreated: number;
    inventoryUnitsUpdated: number;
  };
}

export class OptimizedPhoneCheckService {
  
  /**
   * Process PhoneCheck data in bulk with database-level operations
   * Optimized for 500+ units with 20-30 variables each
   */
  async processBulkPhoneCheckData(data: PhoneCheckData[]): Promise<BulkProcessingResult> {
    const startTime = Date.now();
    const result: BulkProcessingResult = {
      success: true,
      processed: 0,
      errors: [],
      details: {
        imeiDetailsCreated: 0,
        imeiDetailsUpdated: 0,
        inventoryItemsCreated: 0,
        inventoryItemsUpdated: 0,
        inventoryUnitsCreated: 0,
        inventoryUnitsUpdated: 0
      }
    };

    try {
      logger.info(`🚀 Starting bulk PhoneCheck processing for ${data.length} items`);

      // Step 1: Process IMEI Details in batches
      await this.processImeiDetailsBatch(data, result);

      // Step 2: Process Inventory Items in batches
      await this.processInventoryItemsBatch(data, result);

      // Step 3: Process Inventory Units in batches
      await this.processInventoryUnitsBatch(data, result);

      const processingTime = Date.now() - startTime;
      logger.info(`✅ Bulk processing completed in ${processingTime}ms`, {
        processed: result.processed,
        details: result.details
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Bulk processing failed', { error: errorMessage });
      result.success = false;
      result.errors.push(errorMessage);
    }

    return result;
  }

  /**
   * Process IMEI Details with upsert operations
   */
  private async processImeiDetailsBatch(data: PhoneCheckData[], result: BulkProcessingResult): Promise<void> {
    const batchSize = 50; // Process in smaller batches for better performance
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      try {
        // Use upsert operation for batch processing
        const { data: upsertedData, error } = await supabase
          .from('imei_details')
          .upsert(
            batch.map(item => ({
              imei: item.imei,
              device_name: item.deviceName,
              brand: item.brand,
              model: item.model,
              storage: item.storage,
              color: item.color,
              carrier: item.carrier,
              working_status: item.workingStatus,
              battery_health: item.batteryHealth,
              condition: item.condition,
              phonecheck_data: item.rawData,
              last_updated: new Date().toISOString()
            })),
            { 
              onConflict: 'imei',
              ignoreDuplicates: false 
            }
          )
          .select();

        if (error) {
          throw new Error(`IMEI Details batch error: ${error.message}`);
        }

        // Count created vs updated (this is approximate since upsert doesn't return this info)
        result.details.imeiDetailsCreated += batch.length;
        result.processed += batch.length;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`IMEI Details batch ${Math.floor(i / batchSize) + 1}: ${errorMessage}`);
        logger.error('IMEI Details batch processing error', { error: errorMessage, batchIndex: i });
      }
    }
  }

  /**
   * Process Inventory Items with aggregation
   */
  private async processInventoryItemsBatch(data: PhoneCheckData[], result: BulkProcessingResult): Promise<void> {
    // Group by SKU to aggregate quantities
    const skuGroups = new Map<string, PhoneCheckData[]>();
    
    data.forEach(item => {
      const sku = this.generateSku(item);
      if (!skuGroups.has(sku)) {
        skuGroups.set(sku, []);
      }
      skuGroups.get(sku)!.push(item);
    });

    const batchSize = 50;
    const skuArray = Array.from(skuGroups.entries());
    
    for (let i = 0; i < skuArray.length; i += batchSize) {
      const batch = skuArray.slice(i, i + batchSize);
      
      try {
        const upsertData = batch.map(([sku, items]) => {
          const firstItem = items[0];
          return {
            sku,
            brand: firstItem.brand,
            model: firstItem.model,
            storage: firstItem.storage,
            color: firstItem.color,
            carrier: firstItem.carrier,
            total_quantity: items.length,
            available_quantity: items.length, // Assuming all are available initially
            last_updated: new Date().toISOString()
          };
        });

        const { error } = await supabase
          .from('inventory_items')
          .upsert(upsertData, { 
            onConflict: 'sku',
            ignoreDuplicates: false 
          });

        if (error) {
          throw new Error(`Inventory Items batch error: ${error.message}`);
        }

        result.details.inventoryItemsCreated += batch.length;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Inventory Items batch ${Math.floor(i / batchSize) + 1}: ${errorMessage}`);
        logger.error('Inventory Items batch processing error', { error: errorMessage, batchIndex: i });
      }
    }
  }

  /**
   * Process Inventory Units
   */
  private async processInventoryUnitsBatch(data: PhoneCheckData[], result: BulkProcessingResult): Promise<void> {
    const batchSize = 50;
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      try {
        const upsertData = batch.map(item => ({
          imei: item.imei,
          sku: this.generateSku(item),
          location: 'DNCL-Inspection', // Default location
          status: 'active',
          phonecheck_synced: true,
          last_phonecheck: new Date().toISOString()
        }));

        const { error } = await supabase
          .from('inventory_units')
          .upsert(upsertData, { 
            onConflict: 'imei',
            ignoreDuplicates: false 
          });

        if (error) {
          throw new Error(`Inventory Units batch error: ${error.message}`);
        }

        result.details.inventoryUnitsCreated += batch.length;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Inventory Units batch ${Math.floor(i / batchSize) + 1}: ${errorMessage}`);
        logger.error('Inventory Units batch processing error', { error: errorMessage, batchIndex: i });
      }
    }
  }

  /**
   * Generate SKU from PhoneCheck data
   */
  private generateSku(data: PhoneCheckData): string {
    const parts = [
      data.brand?.toUpperCase().replace(/\s+/g, ''),
      data.model?.toUpperCase().replace(/\s+/g, ''),
      data.storage?.toUpperCase().replace(/\s+/g, ''),
      data.color?.toUpperCase().replace(/\s+/g, ''),
      data.carrier?.toUpperCase().replace(/\s+/g, '')
    ].filter(Boolean);
    
    return parts.join('-') || 'UNKNOWN-SKU';
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<any> {
    try {
      const [imeiCount, itemCount, unitCount] = await Promise.all([
        supabase.from('imei_details').select('imei', { count: 'exact' }),
        supabase.from('inventory_items').select('sku', { count: 'exact' }),
        supabase.from('inventory_units').select('imei', { count: 'exact' })
      ]);

      return {
        imeiDetails: imeiCount.count || 0,
        inventoryItems: itemCount.count || 0,
        inventoryUnits: unitCount.count || 0
      };
    } catch (error) {
      logger.error('Error getting processing stats', { error });
      return { imeiDetails: 0, inventoryItems: 0, inventoryUnits: 0 };
    }
  }
}
