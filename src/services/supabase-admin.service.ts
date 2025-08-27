import { supabase } from '../lib/supabase';
import { InventoryPushInput } from '../utils/validator';
import { generateSku } from '../utils/skuGenerator';
import { logger } from '../utils/logger';

export class SupabaseAdminService {
  async pushInventory(data: InventoryPushInput): Promise<{ itemId: number; sku: string; location: string; quantity: number }> {
    try {
      // Debug: Log the incoming data structure
      logger.info('📥 pushInventory received data:', {
        keys: Object.keys(data),
        working: data.working,
        failed: data.failed,
        workingStatus: data.workingStatus,
        originalWorking: (data as any).originalWorking,
        originalWorkingStatus: (data as any).originalWorkingStatus,
        originalFailed: (data as any).originalFailed,
        originalFailedType: typeof (data as any).originalFailed,
        batteryHealth: data.batteryHealth
      });
      
      // Generate SKU if not provided
      let finalSku = data.sku;
      if (!finalSku) {
        finalSku = generateSku({
          name: data.name,
          imei: data.imei
        });
      }

      // Find or create the Item record using Supabase API
      let item: any = null;
      let foundBy = null;
      
      // ONLY check for existing IMEI (each IMEI should be a unique row)
      if (data.imei) {
        const { data: itemData, error } = await supabase
          .from('Item')
          .select('*')
          .eq('imei', data.imei)
          .single();
        
        if (!error && itemData) {
          item = itemData;
          foundBy = 'IMEI';
          logger.info('Found existing item by IMEI', { 
            itemId: item.id, 
            imei: data.imei,
            action: 'will update existing item'
          });
        }
      }
      
      if (!item) {
        logger.info('No existing item found with this IMEI, will create new item', { 
          imei: data.imei,
          serialNumber: data.serialNumber,
          sku: finalSku,
          action: 'will create new item'
        });
      }

      // Create item if not found
      if (!item) {
        const { data: newItem, error } = await supabase
          .from('Item')
          .insert({
            imei: data.imei,
            name: data.name,
            sku: finalSku,
            description: `${data.name} - ${data.imei}`,
            status: 'active'
          })
          .select()
          .single();

        if (error) {
          logger.error('Error creating item via Supabase', { error, data });
          throw new Error(`Failed to create item: ${error.message}`);
        }

        item = newItem;
        logger.info('New item created via Supabase', { itemId: item.id, sku: finalSku });
      } else {
        // Update existing item with new data if needed
        const updateData: any = {};
        let needsUpdate = false;

        if (item.name !== data.name) {
          updateData.name = data.name;
          needsUpdate = true;
        }
        if (item.sku !== finalSku) {
          updateData.sku = finalSku;
          needsUpdate = true;
        }
        const newDescription = `${data.name} - ${data.imei}`;
        if (item.description !== newDescription) {
          updateData.description = newDescription;
          needsUpdate = true;
        }

        if (needsUpdate) {
          const { error } = await supabase
            .from('Item')
            .update(updateData)
            .eq('id', item.id);

          if (error) {
            logger.error('Error updating item via Supabase', { error, itemId: item.id });
            throw new Error(`Failed to update item: ${error.message}`);
          }

          logger.info('Item updated via Supabase', { itemId: item.id, updates: updateData });
        }
      }

      // Handle location and inventory
      let locationId = 1; // Default location ID
      
      // Try to find or create location
      if (data.location) {
        const { data: locationData, error: locationError } = await supabase
          .from('Location')
          .select('id')
          .eq('name', data.location)
          .single();

        if (!locationError && locationData) {
          locationId = locationData.id;
        } else {
          // Create default warehouse if it doesn't exist
          const { data: warehouseData, error: warehouseError } = await supabase
            .from('Warehouse')
            .select('id')
            .eq('name', 'DNCL Warehouse')
            .single();

          let warehouseId = 1;
          if (warehouseError || !warehouseData) {
            const { data: newWarehouse, error: createWarehouseError } = await supabase
              .from('Warehouse')
              .insert({
                name: 'DNCL Warehouse',
                address: 'Default warehouse for DNCL operations'
              })
              .select()
              .single();

            if (createWarehouseError) {
              logger.warn('Could not create warehouse, using default', { error: createWarehouseError });
            } else {
              warehouseId = newWarehouse.id;
            }
          } else {
            warehouseId = warehouseData.id;
          }

          // Create location
          const { data: newLocation, error: createLocationError } = await supabase
            .from('Location')
            .insert({
              name: data.location,
              warehouse_id: warehouseId,
              description: `Location for ${data.location}`
            })
            .select()
            .single();

          if (createLocationError) {
            logger.warn('Could not create location, using default', { error: createLocationError });
          } else {
            locationId = newLocation.id;
          }
        }
      }

      // Create or update inventory record
      const { data: existingInventory, error: inventoryCheckError } = await supabase
        .from('Inventory')
        .select('*')
        .eq('item_id', item.id)
        .eq('location_id', locationId)
        .single();

      if (inventoryCheckError && inventoryCheckError.code !== 'PGRST116') {
        logger.error('Error checking inventory via Supabase', { error: inventoryCheckError });
        throw new Error(`Failed to check inventory: ${inventoryCheckError.message}`);
      }

      if (!existingInventory) {
        // Create new inventory record
        const { error: createInventoryError } = await supabase
          .from('Inventory')
          .insert({
            item_id: item.id,
            location_id: locationId,
            quantity: data.quantity || 1,
            status: 'in_stock'
          });

        if (createInventoryError) {
          logger.error('Error creating inventory via Supabase', { error: createInventoryError });
          throw new Error(`Failed to create inventory: ${createInventoryError.message}`);
        }

        logger.info('New inventory record created via Supabase', { 
          itemId: item.id, 
          locationId, 
          sku: finalSku 
        });
      } else {
        // Update existing inventory
        const newQuantity = existingInventory.quantity + (data.quantity || 1);
        const { error: updateInventoryError } = await supabase
          .from('Inventory')
          .update({
            quantity: newQuantity
          })
          .eq('id', existingInventory.id);

        if (updateInventoryError) {
          logger.error('Error updating inventory via Supabase', { error: updateInventoryError });
          throw new Error(`Failed to update inventory: ${updateInventoryError.message}`);
        }

        logger.info('Inventory updated via Supabase', { 
          itemId: item.id, 
          locationId, 
          newQuantity 
        });
      }

      // Create DeviceTest record (always create one for tracking)
      const testResults = {
        // Raw PhoneCheck status
        rawStatus: {
          failed: data.failed,
          working: data.working,
          status: data.failed === 'YES' ? 'FAILED' : data.failed === 'NO' ? 'PASSED' : 'PENDING'
        },
        // Device condition data
        batteryHealth: data.batteryHealth && data.batteryHealth.toString() !== 'Health not supported' ? parseInt(data.batteryHealth.toString(), 10) : null,
        screenCondition: data.screenCondition,
        bodyCondition: data.bodyCondition,
        // Additional PhoneCheck fields
        batteryCycle: data.batteryCycle ? parseInt(data.batteryCycle.toString(), 10) : null,
        mdm: data.mdm,
        notes: data.notes,
        testerName: data.testerName,
        repairNotes: data.repairNotes,
        firstReceived: data.firstReceived,
        lastUpdate: data.lastUpdate,
        checkDate: data.checkDate,
        dataQuality: data.dataQuality,
        processingLevel: data.processingLevel,
        source: data.source,
        // Additional PhoneCheck fields for defects and custom data
        defects: data.defects,
        custom1: data.custom1,
        // Merge with existing testResults if provided
        ...(data.testResults || {})
      };

      const { error: deviceTestError } = await supabase
        .from('DeviceTest')
        .insert({
          item_id: item.id,
          test_type: 'PHONECHECK',
          test_result: this.determineWorkingStatus(data) === 'YES' ? 'PASSED' : 'FAILED',
          notes: `PhoneCheck test for ${data.brand} ${data.model} - Status: ${testResults.rawStatus.status}`
        });

      if (deviceTestError) {
        logger.warn('Could not create DeviceTest record', { error: deviceTestError });
      } else {
        logger.info('DeviceTest record created', { itemId: item.id });
      }

      // Create IMEI-related records
      await this.createImeiRelatedRecords(item.id, data.imei, finalSku, testResults);

      return {
        itemId: item.id,
        sku: finalSku,
        location: data.location || 'Default Location',
        quantity: data.quantity || 1
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in pushInventory via Supabase', { error: errorMessage, data });
      throw new Error(`Failed to push inventory: ${errorMessage}`);
    }
  }

  private async createImeiRelatedRecords(itemId: number, imei: string, sku: string, testResults: any) {
    try {
      // Create imei_sku_info record
      const { error: skuError } = await supabase
        .from('imei_sku_info')
        .insert({
          imei: imei,
          sku: sku
        });

      if (skuError) {
        logger.warn('Could not create imei_sku_info record', { error: skuError });
      }

      // Create imei_inspect_data record
      const { error: inspectError } = await supabase
        .from('imei_inspect_data')
        .insert({
          imei: imei,
          test_type: 'PHONECHECK',
          test_result: testResults
        });

      if (inspectError) {
        logger.warn('Could not create imei_inspect_data record', { error: inspectError });
      }

      // Create imei_units record
      const { error: unitsError } = await supabase
        .from('imei_units')
        .insert({
          imei: imei,
          unit_name: 'PHONECHECK_UNIT',
          unit_data: testResults
        });

      if (unitsError) {
        logger.warn('Could not create imei_units record', { error: unitsError });
      }

      // Create imei_data_queue record
      const { error: queueError } = await supabase
        .from('imei_data_queue')
        .insert({
          imei: imei,
          raw_data: testResults,
          status: 'processed'
        });

      if (queueError) {
        logger.warn('Could not create imei_data_queue record', { error: queueError });
      }

    } catch (error) {
      logger.warn('Error creating IMEI-related records', { error });
    }
  }

  async getInventory(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('Item')
        .select(`
          *,
          inventory:Inventory(
            *,
            location:Location(*)
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching inventory via Supabase', { error });
        throw new Error(`Failed to fetch inventory: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getInventory via Supabase', { error: errorMessage });
      throw new Error(`Failed to get inventory: ${errorMessage}`);
    }
  }

  async getLocations(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('Location')
        .select('*')
        .order('name');

      if (error) {
        logger.error('Error fetching locations via Supabase', { error });
        throw new Error(`Failed to fetch locations: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getLocations via Supabase', { error: errorMessage });
      throw new Error(`Failed to get locations: ${errorMessage}`);
    }
  }

  /**
   * Determine the working status based on PhoneCheck data
   * Now works with the updated schema that converts booleans to strings
   */
  private determineWorkingStatus(data: any): string {
    logger.info('🔧 determineWorkingStatus called with data:', { 
      working: data.working, 
      failed: data.failed, 
      workingStatus: data.workingStatus,
      originalWorking: data.originalWorking,
      originalWorkingStatus: data.originalWorkingStatus,
      originalFailed: data.originalFailed
    });
    
    // PRIORITY 1: Use the processed working field (now converted to string by schema)
    if (data.working) {
      const workingStatus = data.working.toString().toUpperCase();
      logger.info('🔧 Working status check:', { original: data.working, uppercase: workingStatus });
      
      if (workingStatus === 'YES' || workingStatus === 'PASS' || workingStatus === 'PASSED' || workingStatus === 'TRUE') {
        logger.info('🔧 Working status is PASS/YES, returning YES');
        return 'YES';
      } else if (workingStatus === 'NO' || workingStatus === 'FAIL' || workingStatus === 'FAILED' || workingStatus === 'FALSE') {
        logger.info('🔧 Working status is FAIL/NO, returning NO');
        return 'NO';
      }
    }
    
    // PRIORITY 2: Use the processed failed field (now converted to string by schema)
    if (data.failed) {
      const failedStatus = data.failed.toString().toUpperCase();
      logger.info('🔧 Failed status check:', { original: data.failed, uppercase: failedStatus });
      
      if (failedStatus === 'YES' || failedStatus === 'FAIL' || failedStatus === 'FAILED' || failedStatus === 'TRUE') {
        logger.info('🔧 Failed status is YES/FAIL, returning NO');
        return 'NO';
      } else if (failedStatus === 'NO' || failedStatus === 'PASS' || failedStatus === 'PASSED' || failedStatus === 'FALSE') {
        logger.info('🔧 Failed status is NO/PASS, returning YES');
        return 'YES';
      }
    }
    
    // PRIORITY 3: Use original PhoneCheck data if available (most reliable)
    if (data.originalFailed !== undefined) {
      if (data.originalFailed === false || data.originalFailed === 'false' || data.originalFailed === 'PASSED') {
        logger.info('🔧 Original failed = false, returning YES');
        return 'YES';
      } else if (data.originalFailed === true || data.originalFailed === 'true' || data.originalFailed === 'FAILED') {
        logger.info('🔧 Original failed = true, returning NO');
        return 'NO';
      }
    }
    
    // PRIORITY 4: Use original working status from PhoneCheck
    if (data.originalWorking) {
      const originalWorking = data.originalWorking.toString().toUpperCase();
      logger.info('🔧 Original working status check:', { original: data.originalWorking, uppercase: originalWorking });
      
      if (originalWorking === 'YES' || originalWorking === 'PASS' || originalWorking === 'PASSED' || originalWorking === 'TRUE') {
        logger.info('🔧 Original working status is PASS/YES, returning YES');
        return 'YES';
      } else if (originalWorking === 'NO' || originalWorking === 'FAIL' || originalWorking === 'FAILED' || originalWorking === 'FALSE') {
        logger.info('🔧 Original working status is FAIL/NO, returning NO');
        return 'NO';
      }
    }
    
    // PRIORITY 5: Use original workingStatus field
    if (data.originalWorkingStatus) {
      const originalWorkingStatus = data.originalWorkingStatus.toString().toUpperCase();
      logger.info('🔧 Original workingStatus field check:', { original: data.originalWorkingStatus, uppercase: originalWorkingStatus });
      
      if (originalWorkingStatus === 'YES' || originalWorkingStatus === 'PASS' || originalWorkingStatus === 'PASSED' || originalWorkingStatus === 'TRUE') {
        logger.info('🔧 Original workingStatus is PASS/YES, returning YES');
        return 'YES';
      } else if (originalWorkingStatus === 'NO' || originalWorkingStatus === 'FAIL' || originalWorkingStatus === 'FAILED' || originalWorkingStatus === 'FALSE') {
        logger.info('🔧 Original workingStatus is FAIL/NO, returning NO');
        return 'NO';
      }
    }
    
    // FALLBACK: Check battery health as indicator
    if (data.batteryHealth !== undefined) {
      if (data.batteryHealth >= 80) {
        logger.info('🔧 Battery health >= 80, returning YES');
        return 'YES';
      } else if (data.batteryHealth < 50) {
        logger.info('🔧 Battery health < 50, returning NO');
        return 'NO';
      }
    }
    
    // Default to YES if no clear indication (safer than PENDING)
    logger.info('🔧 No clear indication, returning YES (default)');
    return 'YES';
  }

  async cleanupImeiData(imei: string): Promise<{ archivedCount: number }> {
    try {
      // Execute the cleanup function using Supabase RPC
      const { data, error } = await supabase.rpc('cleanup_imei_data', {
        target_imei: imei
      });

      if (error) {
        logger.error('Error calling cleanup_imei_data RPC', { error, imei });
        throw new Error(`Failed to cleanup IMEI data: ${error.message}`);
      }

      const archivedCount = data || 0;

      logger.info('IMEI cleanup completed via Supabase', { 
        imei, 
        archivedCount 
      });

      return { archivedCount };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in cleanupImeiData service (Supabase)', { error: errorMessage, imei });
      throw error;
    }
  }

  async cleanupMultipleImeiData(imeiList: string[]): Promise<{
    success: boolean;
    totalProcessed: number;
    successCount: number;
    errorCount: number;
    totalArchived: number;
    errors: Array<{ imei: string; error: string }>;
  }> {
    try {
      // Execute the bulk cleanup function using Supabase RPC
      const { data, error } = await supabase.rpc('cleanup_multiple_imei_data', {
        imei_list: imeiList
      });

      if (error) {
        logger.error('Error calling cleanup_multiple_imei_data RPC', { error, imeiList });
        throw new Error(`Failed to cleanup multiple IMEI data: ${error.message}`);
      }

      const result = data || {
        success: false,
        total_processed: 0,
        success_count: 0,
        error_count: 0,
        total_deleted: 0,
        errors: []
      };

      logger.info('Multiple IMEI cleanup completed via Supabase', { 
        totalProcessed: result.total_processed,
        successCount: result.success_count,
        errorCount: result.error_count,
        totalDeleted: result.total_deleted
      });

      return {
        success: result.success,
        totalProcessed: result.total_processed,
        successCount: result.success_count,
        errorCount: result.error_count,
        totalArchived: result.total_deleted, // Note: new system uses total_deleted instead of total_archived
        errors: result.errors || []
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in cleanupMultipleImeiData service (Supabase)', { error: errorMessage, imeiList });
      throw error;
    }
  }

  async cleanupAllImeiData(): Promise<{
    success: boolean;
    message: string;
    totalArchived: number;
    timestamp: string;
  }> {
    try {
      // Execute the nuclear cleanup function using Supabase RPC
      const { data, error } = await supabase.rpc('cleanup_all_imei_data');

      if (error) {
        logger.error('Error calling cleanup_all_imei_data RPC', { error });
        throw new Error(`Failed to cleanup all IMEI data: ${error.message}`);
      }

      const result = data || {
        success: false,
        message: 'Unknown error',
        total_deleted: 0,
        timestamp: new Date().toISOString()
      };

      logger.info('All IMEI data cleanup completed via Supabase', { 
        success: result.success,
        totalDeleted: result.total_deleted,
        timestamp: result.timestamp
      });

      return {
        success: result.success,
        message: result.message,
        totalArchived: result.total_deleted, // Note: new system uses total_deleted instead of total_archived
        timestamp: result.timestamp
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in cleanupAllImeiData service (Supabase)', { error: errorMessage });
      throw error;
    }
  }

  async getDeletionStats(): Promise<{
    currentData: {
      items: number;
      imeiSkuInfo: number;
      imeiInspectData: number;
      imeiUnits: number;
      imeiDataQueue: number;
      deviceTests: number;
      inventory: number;
    };
    archivedData: {
      items: number;
      imeiSkuInfo: number;
      imeiInspectData: number;
      imeiUnits: number;
      imeiDataQueue: number;
      deviceTests: number;
      inventory: number;
    };
    recentDeletions: Array<{
      imei: string;
      tableName: string;
      archivedAt: string;
      archiveReason: string;
    }>;
  }> {
    try {
      // Since the new system doesn't have archiving, we'll return current data counts
      const [itemsResult, imeiSkuResult, imeiInspectResult, imeiUnitsResult, imeiQueueResult, deviceTestsResult, inventoryResult] = await Promise.all([
        supabase.from('Item').select('*', { count: 'exact', head: true }),
        supabase.from('imei_sku_info').select('*', { count: 'exact', head: true }),
        supabase.from('imei_inspect_data').select('*', { count: 'exact', head: true }),
        supabase.from('imei_units').select('*', { count: 'exact', head: true }),
        supabase.from('imei_data_queue').select('*', { count: 'exact', head: true }),
        supabase.from('DeviceTest').select('*', { count: 'exact', head: true }),
        supabase.from('Inventory').select('*', { count: 'exact', head: true })
      ]);

      const currentData = {
        items: itemsResult.count || 0,
        imeiSkuInfo: imeiSkuResult.count || 0,
        imeiInspectData: imeiInspectResult.count || 0,
        imeiUnits: imeiUnitsResult.count || 0,
        imeiDataQueue: imeiQueueResult.count || 0,
        deviceTests: deviceTestsResult.count || 0,
        inventory: inventoryResult.count || 0
      };

      return {
        currentData,
        archivedData: {
          items: 0,
          imeiSkuInfo: 0,
          imeiInspectData: 0,
          imeiUnits: 0,
          imeiDataQueue: 0,
          deviceTests: 0,
          inventory: 0
        },
        recentDeletions: []
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getDeletionStats service (Supabase)', { error: errorMessage });
      throw error;
    }
  }

  async restoreImeiData(imei: string): Promise<{
    success: boolean;
    message: string;
    restoredCount: number;
    imei: string;
  }> {
    try {
      // Since the new system doesn't have archiving, we'll return a message indicating this
      logger.info('Restore requested for IMEI (new system has no archiving)', { imei });

      return {
        success: false,
        message: 'Restore functionality not available in new system (no archiving)',
        restoredCount: 0,
        imei: imei
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in restoreImeiData service (Supabase)', { error: errorMessage, imei });
      throw error;
    }
  }

  async searchAllImeiData(searchTerm: string): Promise<{
    imeiSkuInfo: any[];
    imeiInspectData: any[];
    imeiUnits: any[];
    imeiDataQueue: any[];
    items: any[];
    totalRecords: number;
  }> {
    try {
      // Search across all IMEI-related tables with correct column names for new structure
      const [imeiSkuResult, imeiInspectResult, imeiUnitsResult, imeiQueueResult, itemsResult] = await Promise.all([
        // Search in imei_sku_info
        supabase
          .from('imei_sku_info')
          .select('*')
          .or(`imei.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`)
          .limit(100),
        
        // Search in imei_inspect_data
        supabase
          .from('imei_inspect_data')
          .select('*')
          .or(`imei.ilike.%${searchTerm}%,test_type.ilike.%${searchTerm}%`)
          .limit(100),
        
        // Search in imei_units
        supabase
          .from('imei_units')
          .select('*')
          .or(`imei.ilike.%${searchTerm}%,unit_name.ilike.%${searchTerm}%`)
          .limit(100),
        
        // Search in imei_data_queue
        supabase
          .from('imei_data_queue')
          .select('*')
          .or(`imei.ilike.%${searchTerm}%,status.ilike.%${searchTerm}%`)
          .limit(100),
        
        // Search in Item table
        supabase
          .from('Item')
          .select('*')
          .or(`imei.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`)
          .limit(100)
      ]);

      // Check for errors
      const errors = [imeiSkuResult.error, imeiInspectResult.error, imeiUnitsResult.error, imeiQueueResult.error, itemsResult.error].filter(Boolean);
      if (errors.length > 0) {
        logger.error('Error searching IMEI data', { errors });
        throw new Error(`Search failed: ${errors.map(e => e?.message).join(', ')}`);
      }

      const imeiSkuInfo = imeiSkuResult.data || [];
      const imeiInspectData = imeiInspectResult.data || [];
      const imeiUnits = imeiUnitsResult.data || [];
      const imeiDataQueue = imeiQueueResult.data || [];
      const items = itemsResult.data || [];

      const totalRecords = imeiSkuInfo.length + imeiInspectData.length + imeiUnits.length + imeiDataQueue.length + items.length;

      logger.info('IMEI search completed', { 
        searchTerm, 
        totalRecords,
        breakdown: {
          imeiSkuInfo: imeiSkuInfo.length,
          imeiInspectData: imeiInspectData.length,
          imeiUnits: imeiUnits.length,
          imeiDataQueue: imeiDataQueue.length,
          items: items.length
        }
      });

      return {
        imeiSkuInfo,
        imeiInspectData,
        imeiUnits,
        imeiDataQueue,
        items,
        totalRecords
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in searchAllImeiData service', { error: errorMessage, searchTerm });
      throw error;
    }
  }

  async getAllImeiData(): Promise<{
    imeiSkuInfo: any[];
    imeiInspectData: any[];
    imeiUnits: any[];
    imeiDataQueue: any[];
    items: any[];
    totalRecords: number;
  }> {
    try {
      // Get all data from IMEI-related tables for bulk selection
      const [imeiSkuResult, imeiInspectResult, imeiUnitsResult, imeiQueueResult, itemsResult] = await Promise.all([
        // Get all from imei_sku_info
        supabase
          .from('imei_sku_info')
          .select('*')
          .limit(1000),
        
        // Get all from imei_inspect_data
        supabase
          .from('imei_inspect_data')
          .select('*')
          .limit(1000),
        
        // Get all from imei_units
        supabase
          .from('imei_units')
          .select('*')
          .limit(1000),
        
        // Get all from imei_data_queue
        supabase
          .from('imei_data_queue')
          .select('*')
          .limit(1000),
        
        // Get all from Item table
        supabase
          .from('Item')
          .select('*')
          .limit(1000)
      ]);

      // Check for errors
      const errors = [imeiSkuResult.error, imeiInspectResult.error, imeiUnitsResult.error, imeiQueueResult.error, itemsResult.error].filter(Boolean);
      if (errors.length > 0) {
        logger.error('Error fetching all IMEI data', { errors });
        throw new Error(`Failed to fetch all data: ${errors.map(e => e?.message).join(', ')}`);
      }

      const imeiSkuInfo = imeiSkuResult.data || [];
      const imeiInspectData = imeiInspectResult.data || [];
      const imeiUnits = imeiUnitsResult.data || [];
      const imeiDataQueue = imeiQueueResult.data || [];
      const items = itemsResult.data || [];

      const totalRecords = imeiSkuInfo.length + imeiInspectData.length + imeiUnits.length + imeiDataQueue.length + items.length;

      logger.info('All IMEI data fetched for bulk selection', { 
        totalRecords,
        breakdown: {
          imeiSkuInfo: imeiSkuInfo.length,
          imeiInspectData: imeiInspectData.length,
          imeiUnits: imeiUnits.length,
          imeiDataQueue: imeiDataQueue.length,
          items: items.length
        }
      });

      return {
        imeiSkuInfo,
        imeiInspectData,
        imeiUnits,
        imeiDataQueue,
        items,
        totalRecords
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getAllImeiData service', { error: errorMessage });
      throw error;
    }
  }
}
