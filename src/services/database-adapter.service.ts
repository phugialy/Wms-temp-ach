import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

/**
 * Database Adapter Service
 * Bridges old Prisma-based APIs to new IMEI-based database structure
 * This allows gradual migration without breaking existing functionality
 */

export interface ItemData {
  id?: number;
  sku?: string;
  name: string;
  description?: string;
  upc?: string;
  brand?: string;
  model?: string;
  grade?: string;
  working?: string;
  cost?: number;
  price?: number;
  weightOz?: number;
  dimensions?: string;
  imageUrl?: string;
  type: string;
  imei: string;
  serialNumber?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  carrier?: string;
  color?: string;
  modelNumber?: string;
  storage?: string;
  carrierId?: string;
  skuGeneratedAt?: Date;
  condition?: string;
  batteryHealth?: number;
  screenCondition?: string;
  bodyCondition?: string;
  testResults?: any;
}

export interface InventoryData {
  id?: number;
  itemId?: number;
  locationId?: number;
  sku: string;
  quantity: number;
  reserved: number;
  available: number;
  updatedAt?: Date;
}

export class DatabaseAdapterService {
  
  /**
   * Get all items (compatible with old Item table structure)
   */
  async getAllItems(): Promise<ItemData[]> {
    try {
      // Get data from new IMEI tables and transform to old format
      const { data: skuInfo, error } = await supabase
        .from('imei_sku_info')
        .select(`
          *,
          imei_inspect_data(*),
          imei_units(*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error getting items from new system', { error });
        throw error;
      }

      // Transform to old Item format
      return (skuInfo || []).map(sku => this.transformSkuInfoToItem(sku));
      
    } catch (error) {
      logger.error('Error in getAllItems', { error });
      throw error;
    }
  }

  /**
   * Get item by IMEI (compatible with old Item table structure)
   */
  async getItemByImei(imei: string): Promise<ItemData | null> {
    try {
      const { data: skuInfo, error } = await supabase
        .from('imei_sku_info')
        .select(`
          *,
          imei_inspect_data(*),
          imei_units(*)
        `)
        .eq('imei', imei)
        .single();

      if (error || !skuInfo) {
        return null;
      }

      return this.transformSkuInfoToItem(skuInfo);
      
    } catch (error) {
      logger.error('Error in getItemByImei', { error, imei });
      throw error;
    }
  }

  /**
   * Get item by SKU (compatible with old Item table structure)
   */
  async getItemBySku(sku: string): Promise<ItemData | null> {
    try {
      const { data: skuInfo, error } = await supabase
        .from('imei_sku_info')
        .select(`
          *,
          imei_inspect_data(*),
          imei_units(*)
        `)
        .eq('sku', sku)
        .single();

      if (error || !skuInfo) {
        return null;
      }

      return this.transformSkuInfoToItem(skuInfo);
      
    } catch (error) {
      logger.error('Error in getItemBySku', { error, sku });
      throw error;
    }
  }

  /**
   * Create/Update item (compatible with old Item table structure)
   */
  async createOrUpdateItem(itemData: ItemData): Promise<ItemData> {
    try {
      // Transform old Item format to new IMEI format
      const imeiData = this.transformItemToImeiData(itemData);
      
      // Insert into queue for processing
      const { data: queueItem, error: queueError } = await supabase
        .from('imei_data_queue')
        .insert({
          raw_data: imeiData,
          source: 'api-adapter',
          status: 'pending'
        })
        .select()
        .single();

      if (queueError) {
        logger.error('Error adding item to queue', { error: queueError });
        throw queueError;
      }

      // Process the queue item immediately
      const { data: processResult, error: processError } = await supabase
        .rpc('process_imei_queue');

      if (processError) {
        logger.error('Error processing queue item', { error: processError });
        throw processError;
      }

      // Return the transformed item
      return itemData;
      
    } catch (error) {
      logger.error('Error in createOrUpdateItem', { error, itemData });
      throw error;
    }
  }

  /**
   * Get inventory data (compatible with old Inventory table structure)
   */
  async getInventory(): Promise<InventoryData[]> {
    try {
      // Get data from new IMEI tables and transform to old format
      const { data: units, error } = await supabase
        .from('imei_units')
        .select(`
          *,
          imei_sku_info(*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error getting inventory from new system', { error });
        throw error;
      }

      // Transform to old Inventory format
      return (units || []).map(unit => this.transformUnitToInventory(unit));
      
    } catch (error) {
      logger.error('Error in getInventory', { error });
      throw error;
    }
  }

  /**
   * Get inventory by location (compatible with old Inventory table structure)
   */
  async getInventoryByLocation(locationId: number): Promise<InventoryData[]> {
    try {
      // For now, we'll use location as a string since new system uses location names
      // You may need to create a location mapping table
      const { data: units, error } = await supabase
        .from('imei_units')
        .select(`
          *,
          imei_sku_info(*)
        `)
        .eq('location', `Location-${locationId}`) // This is a placeholder mapping
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error getting inventory by location', { error, locationId });
        throw error;
      }

      return (units || []).map(unit => this.transformUnitToInventory(unit));
      
    } catch (error) {
      logger.error('Error in getInventoryByLocation', { error, locationId });
      throw error;
    }
  }

  /**
   * Update inventory (compatible with old Inventory table structure)
   */
  async updateInventory(inventoryData: InventoryData): Promise<InventoryData> {
    try {
      // Find the unit by SKU and update it
      const { data: unit, error } = await supabase
        .from('imei_units')
        .update({
          location: `Location-${inventoryData.locationId}`, // Placeholder mapping
          updated_at: new Date().toISOString()
        })
        .eq('sku', inventoryData.sku)
        .select()
        .single();

      if (error) {
        logger.error('Error updating inventory', { error, inventoryData });
        throw error;
      }

      return this.transformUnitToInventory(unit);
      
    } catch (error) {
      logger.error('Error in updateInventory', { error, inventoryData });
      throw error;
    }
  }

  /**
   * Transform SKU info to old Item format
   */
  private transformSkuInfoToItem(skuInfo: any): ItemData {
    const latestInspect = skuInfo.imei_inspect_data?.[0] || {};
    const unit = skuInfo.imei_units?.[0] || {};

    return {
      id: skuInfo.id,
      sku: skuInfo.sku,
      name: `${skuInfo.brand} ${skuInfo.model}`,
      description: `${skuInfo.brand} ${skuInfo.model} ${skuInfo.storage} ${skuInfo.color}`,
      brand: skuInfo.brand,
      model: skuInfo.model,
      grade: 'used',
      working: latestInspect.passed ? 'YES' : 'NO',
      type: 'phone',
      imei: skuInfo.imei,
      serialNumber: unit.serial_number,
      isActive: true,
      createdAt: new Date(skuInfo.created_at),
      updatedAt: new Date(skuInfo.updated_at),
      carrier: skuInfo.carrier,
      color: skuInfo.color,
      modelNumber: skuInfo.model_number,
      storage: skuInfo.storage,
      condition: unit.condition || 'UNKNOWN',
      batteryHealth: latestInspect.battery_health,
      testResults: latestInspect.test_results
    };
  }

  /**
   * Transform old Item format to new IMEI data format
   */
  private transformItemToImeiData(itemData: ItemData): any {
    return {
      imei: itemData.imei,
      brand: itemData.brand,
      model: itemData.model,
      modelNumber: itemData.modelNumber,
      storage: itemData.storage,
      color: itemData.color,
      carrier: itemData.carrier,
      type: itemData.type,
      serialNumber: itemData.serialNumber,
      condition: itemData.condition,
      working: itemData.working,
      batteryHealth: itemData.batteryHealth,
      testResults: itemData.testResults,
      name: itemData.name,
      description: itemData.description
    };
  }

  /**
   * Transform unit to old Inventory format
   */
  private transformUnitToInventory(unit: any): InventoryData {
    return {
      id: unit.id,
      sku: unit.sku,
      quantity: 1,
      reserved: 0,
      available: 1,
      updatedAt: new Date(unit.updated_at)
    };
  }

  /**
   * Get inventory summary (for admin dashboard compatibility)
   */
  async getInventorySummary(): Promise<{
    totalItems: number;
    availableItems: number;
    reservedItems: number;
    byBrand: Record<string, number>;
    byModel: Record<string, number>;
    byCondition: Record<string, number>;
  }> {
    try {
      const { data: units, error } = await supabase
        .from('imei_units')
        .select(`
          *,
          imei_sku_info(*),
          imei_inspect_data(*)
        `);

      if (error) {
        logger.error('Error getting inventory summary', { error });
        throw error;
      }

      const summary = {
        totalItems: units?.length || 0,
        availableItems: 0,
        reservedItems: 0,
        byBrand: {} as Record<string, number>,
        byModel: {} as Record<string, number>,
        byCondition: {} as Record<string, number>
      };

      units?.forEach(unit => {
        const skuInfo = unit.imei_sku_info;
        const inspectData = unit.imei_inspect_data?.[0];
        
        if (skuInfo) {
          // Count by brand
          if (skuInfo.brand) {
            summary.byBrand[skuInfo.brand] = (summary.byBrand[skuInfo.brand] || 0) + 1;
          }
          
          // Count by model
          if (skuInfo.model) {
            summary.byModel[skuInfo.model] = (summary.byModel[skuInfo.model] || 0) + 1;
          }
        }
        
        // Count by condition
        if (unit.condition) {
          summary.byCondition[unit.condition] = (summary.byCondition[unit.condition] || 0) + 1;
        }
        
        // Count available/reserved (simplified logic)
        if (inspectData?.passed) {
          summary.availableItems++;
        } else {
          summary.reservedItems++;
        }
      });

      return summary;
      
    } catch (error) {
      logger.error('Error in getInventorySummary', { error });
      throw error;
    }
  }

  /**
   * Search items (compatible with old search functionality)
   */
  async searchItems(query: string): Promise<ItemData[]> {
    try {
      const { data: skuInfo, error } = await supabase
        .from('imei_sku_info')
        .select(`
          *,
          imei_inspect_data(*),
          imei_units(*)
        `)
        .or(`imei.ilike.%${query}%,sku.ilike.%${query}%,brand.ilike.%${query}%,model.ilike.%${query}%`)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error searching items', { error, query });
        throw error;
      }

      return (skuInfo || []).map(sku => this.transformSkuInfoToItem(sku));
      
    } catch (error) {
      logger.error('Error in searchItems', { error, query });
      throw error;
    }
  }
}

export default new DatabaseAdapterService();
