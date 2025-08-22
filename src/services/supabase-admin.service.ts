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
          brand: data.brand,
          model: data.model,
          storage: data.storage,
          color: data.color,
          carrier: data.carrier
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
            name: data.name,
            brand: data.brand,
            model: data.model,
            storage: data.storage,
            color: data.color,
            carrier: data.carrier,
            type: data.type.toUpperCase(), // Ensure consistent case
            imei: data.imei,
            serialNumber: data.serialNumber,
            sku: finalSku,
            skuGeneratedAt: data.sku ? null : new Date().toISOString(),
            condition: data.condition || 'UNKNOWN',
            batteryHealth: data.batteryHealth && data.batteryHealth.toString() !== 'Health not supported' ? parseInt(data.batteryHealth.toString(), 10) : null,
            screenCondition: data.screenCondition,
            bodyCondition: data.bodyCondition,
            testResults: data.testResults, // Store all PhoneCheck data in testResults JSON
            working: this.determineWorkingStatus(data),
            isActive: true
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
        if (item.brand !== data.brand) {
          updateData.brand = data.brand;
          needsUpdate = true;
        }
        if (item.model !== data.model) {
          updateData.model = data.model;
          needsUpdate = true;
        }
        if (item.storage !== data.storage) {
          updateData.storage = data.storage;
          needsUpdate = true;
        }
        if (item.color !== data.color) {
          updateData.color = data.color;
          needsUpdate = true;
        }
        if (item.carrier !== data.carrier) {
          updateData.carrier = data.carrier;
          needsUpdate = true;
        }
        if (item.type !== data.type) {
          updateData.type = data.type;
          needsUpdate = true;
        }
        if (item.sku !== finalSku) {
          updateData.sku = finalSku;
          needsUpdate = true;
        }
        // Also update PhoneCheck related fields on existing item if provided (only use existing columns)
        if (data.batteryHealth !== undefined && data.batteryHealth.toString() !== 'Health not supported' && item.batteryHealth !== parseInt(data.batteryHealth.toString(), 10)) { 
          updateData.batteryHealth = parseInt(data.batteryHealth.toString(), 10); 
          needsUpdate = true; 
        }
        if (data.screenCondition !== undefined && item.screenCondition !== data.screenCondition) { 
          updateData.screenCondition = data.screenCondition; 
          needsUpdate = true; 
        }
        if (data.bodyCondition !== undefined && item.bodyCondition !== data.bodyCondition) { 
          updateData.bodyCondition = data.bodyCondition; 
          needsUpdate = true; 
        }
        if (data.condition !== undefined && item.condition !== data.condition) { 
          updateData.condition = data.condition; 
          needsUpdate = true; 
        }
        if (data.working !== undefined && item.working !== this.determineWorkingStatus(data)) { 
          updateData.working = this.determineWorkingStatus(data); 
          needsUpdate = true; 
        }
        // Merge testResults if new data is more comprehensive
        if (data.testResults && JSON.stringify(item.testResults) !== JSON.stringify(data.testResults)) {
            updateData.testResults = { ...(item.testResults || {}), ...data.testResults };
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
                description: 'Default warehouse for DNCL operations',
                isActive: true
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
              warehouseId: warehouseId,
              description: `Location for ${data.location}`,
              isActive: true
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
        .eq('itemId', item.id)
        .eq('locationId', locationId)
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
            itemId: item.id,
            locationId: locationId,
            sku: finalSku,
            quantity: data.quantity || 1,
            reserved: 0,
            available: data.quantity || 1
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
            quantity: newQuantity,
            available: newQuantity - existingInventory.reserved
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
            status: data.failed === true ? 'FAILED' : data.failed === false ? 'PASSED' : 'PENDING'
          },
          // Device condition data
                     batteryHealth: data.batteryHealth && data.batteryHealth.toString() !== 'Health not supported' ? parseInt(data.batteryHealth.toString(), 10) : null,
          screenCondition: data.screenCondition,
          bodyCondition: data.bodyCondition,
          // Additional PhoneCheck fields (store in testResults since columns don't exist)
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
           itemId: item.id,
           testType: 'PHONECHECK',
           testResults: testResults,
           passed: this.determineWorkingStatus(data) === 'YES',
           notes: `PhoneCheck test for ${data.brand} ${data.model} - Status: ${testResults.rawStatus.status}`,
           testedBy: 'SYSTEM'
         });

       if (deviceTestError) {
         logger.warn('Could not create DeviceTest record', { error: deviceTestError });
       } else {
         logger.info('DeviceTest record created', { itemId: item.id });
       }

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
        .eq('isActive', true)
        .order('createdAt', { ascending: false });

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
        .eq('isActive', true)
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
   * Determine working status based on PhoneCheck data and pass/fail status
   * Maps PhoneCheck status to our system: YES=PASS, NO=FAIL, PENDING=PENDING
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
    
    // PRIORITY 1: Use original PhoneCheck data if available (most reliable)
    if (data.originalFailed !== undefined) {
      if (data.originalFailed === false || data.originalFailed === 'false' || data.originalFailed === 'PASSED') {
        logger.info('🔧 Original failed = false, returning YES');
        return 'YES';
      } else if (data.originalFailed === true || data.originalFailed === 'true' || data.originalFailed === 'FAILED') {
        logger.info('🔧 Original failed = true, returning NO');
        return 'NO';
      }
    }
    
    // PRIORITY 2: Use original working status from PhoneCheck
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
    
    // PRIORITY 3: Use original workingStatus field
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
    
    // FALLBACK 1: Check processed failed status
    if (data.failed === true || data.failed === 'true' || data.failed === 'FAILED') {
      logger.info('🔧 Processed failed status detected, returning NO');
      return 'NO';
    }
    
    if (data.failed === false || data.failed === 'false' || data.failed === 'PASSED') {
      logger.info('🔧 Processed passed status detected, returning YES');
      return 'YES';
    }
    
    // FALLBACK 2: Check processed working field
    if (data.working) {
      const workingStatus = data.working.toString().toUpperCase();
      logger.info('🔧 Processed working status check:', { original: data.working, uppercase: workingStatus });
      
      if (workingStatus === 'YES' || workingStatus === 'PASS' || workingStatus === 'PASSED' || workingStatus === 'TRUE') {
        logger.info('🔧 Processed working status is PASS/YES, returning YES');
        return 'YES';
      } else if (workingStatus === 'NO' || workingStatus === 'FAIL' || workingStatus === 'FAILED' || workingStatus === 'FALSE') {
        logger.info('🔧 Processed working status is FAIL/NO, returning NO');
        return 'NO';
      }
    }
    
    // FALLBACK 3: Check processed workingStatus field
    if (data.workingStatus) {
      const workingStatusUpper = data.workingStatus.toString().toUpperCase();
      logger.info('🔧 Processed workingStatus field check:', { original: data.workingStatus, uppercase: workingStatusUpper });
      
      if (workingStatusUpper === 'YES' || workingStatusUpper === 'PASS' || workingStatusUpper === 'PASSED' || workingStatusUpper === 'TRUE') {
        logger.info('🔧 Processed workingStatus is PASS/YES, returning YES');
        return 'YES';
      } else if (workingStatusUpper === 'NO' || workingStatusUpper === 'FAIL' || workingStatusUpper === 'FAILED' || workingStatusUpper === 'FALSE') {
        logger.info('🔧 Processed workingStatus is FAIL/NO, returning NO');
        return 'NO';
      }
    }
    
    // FALLBACK 4: Check battery health as indicator
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
}
