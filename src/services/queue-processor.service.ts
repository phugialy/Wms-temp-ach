import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env['SUPABASE_URL']!,
  process.env['SUPABASE_API_KEY']!
);

export interface QueueItem {
  id: number;
  raw_data: any;
  status: string;
  created_at: string;
  processed_at?: string;
  error_message?: string;
}

export class QueueProcessorService {
  
  /**
   * Process all pending queue items using JavaScript instead of complex SQL
   */
  async processPendingItems(): Promise<{ processed: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;

    try {
      // Get all pending items
      const { data: pendingItems, error: fetchError } = await supabase
        .from('imei_data_queue')
        .select('*')
        .eq('status', 'pending');

      if (fetchError) {
        throw new Error(`Failed to fetch pending items: ${fetchError.message}`);
      }

      if (!pendingItems || pendingItems.length === 0) {
        return { processed: 0, errors: [] };
      }

      console.log(`Processing ${pendingItems.length} pending items...`);

      // Mark items as processing
      await supabase
        .from('imei_data_queue')
        .update({ status: 'processing' })
        .eq('status', 'pending');

      // Process each item
      for (const item of pendingItems) {
        try {
          await this.processSingleItem(item);
          processed++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Item ${item.id}: ${errorMsg}`);
          
          // Mark item as failed
          await supabase
            .from('imei_data_queue')
            .update({ 
              status: 'failed', 
              processed_at: new Date().toISOString(),
              error_message: errorMsg
            })
            .eq('id', item.id);
        }
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Processing failed: ${errorMsg}`);
    }

    return { processed, errors };
  }

  /**
   * Process a single queue item with flexible data handling
   */
  private async processSingleItem(item: QueueItem): Promise<void> {
    console.log(`🔍 Processing item ${item.id} with IMEI: ${item.raw_data.imei || item.raw_data.IMEI}`);
    const rawData = item.raw_data;
    
    // Extract data with fallbacks
    const imei = rawData.imei || rawData.IMEI || rawData.serialNumber || `UNKNOWN_${Date.now()}`;
    const name = rawData.name || rawData.deviceName || rawData.model || 'Unknown Device';
    const brand = rawData.brand || rawData.manufacturer || 'Unknown';
    const model = rawData.model || rawData.deviceModel || 'Unknown Model';
    const storage = rawData.storage || rawData.capacity || 'Unknown';
    const color = rawData.color || rawData.deviceColor || 'Unknown';
    const carrier = rawData.carrier || rawData.network || 'Unlocked';
    const location = rawData.location || 'Default Location';
    const working = rawData.working || rawData.status || 'PENDING';
    const failed = rawData.failed || rawData.defects || 'NO';
    const batteryHealth = rawData.batteryHealth || rawData.battery || null;
    const screenCondition = rawData.screenCondition || rawData.screen || 'Unknown';
    const bodyCondition = rawData.bodyCondition || rawData.condition || 'Unknown';
    const notes = rawData.notes || rawData.comments || '';
    const quantity = rawData.quantity || 1;

    // Flexible validation - only IMEI is truly required
    if (!imei || imei === 'UNKNOWN_') {
      throw new Error('Missing IMEI - this is the only required field');
    }

    // Generate SKU with fallbacks (limited to 15 characters)
    const sku = rawData.sku || `${brand.substring(0, 3).toUpperCase()}${model.substring(0, 3).toUpperCase()}`.replace(/\s+/g, '').substring(0, 15);
    console.log(`📝 Generated SKU: "${sku}" (length: ${sku.length})`);

    // Determine working status
    let workingStatus = 'PENDING';
    let testResult = 'PENDING';
    
    if (working === 'YES' || working === 'true' || working === 'TRUE') {
      workingStatus = 'YES';
      testResult = 'PASSED';
    } else if (failed === 'YES' || failed === 'true' || failed === 'TRUE') {
      workingStatus = 'NO';
      testResult = 'FAILED';
    }

    // Find or create location
    let locationId: number;
    const { data: existingLocation } = await supabase
      .from('Location')
      .select('id')
      .eq('name', location)
      .limit(1);

    if (existingLocation && existingLocation.length > 0) {
      locationId = existingLocation[0]?.id!;
    } else {
      // Create new location
      const { data: newLocation, error: locationError } = await supabase
        .from('Location')
        .insert({
          name: location,
          warehouse_id: 1,
          description: `Auto-created location for ${location}`
        })
        .select('id')
        .single();

      if (locationError) {
        throw new Error(`Failed to create location: ${locationError.message}`);
      }
      locationId = newLocation.id;
    }

    // Create or update Item with flexible field handling
    let itemId: number;
    const { data: existingItem } = await supabase
      .from('Item')
      .select('id')
      .eq('imei', imei)
      .limit(1);

    // Prepare item data with only existing columns
    const itemData: any = {
      name,
      sku,
      description: `${brand} ${model} ${storage || ''} ${color || ''} ${carrier || ''} - ${notes || ''}`.trim()
    };
    console.log(`📋 Item data to insert:`, itemData);

    if (existingItem && existingItem.length > 0) {
      itemId = existingItem[0]?.id!;
      // Update existing item with available fields
      await supabase
        .from('Item')
        .update(itemData)
        .eq('id', itemId);
    } else {
      // Create new item with available fields
      const { data: newItem, error: itemError } = await supabase
        .from('Item')
        .insert({
          imei,
          ...itemData,
          status: 'active'
        })
        .select('id')
        .single();

      if (itemError) {
        throw new Error(`Failed to create item: ${itemError.message}`);
      }
      itemId = newItem.id;
    }

    // Create or update Inventory
    const { data: existingInventory } = await supabase
      .from('Inventory')
      .select('id, quantity')
      .eq('item_id', itemId)
      .eq('location_id', locationId)
      .limit(1);

    if (existingInventory && existingInventory.length > 0) {
      // Update existing inventory
      await supabase
        .from('Inventory')
        .update({
          quantity: (existingInventory[0]?.quantity || 0) + quantity
        })
        .eq('id', existingInventory[0]?.id!);
    } else {
      // Create new inventory
      await supabase
        .from('Inventory')
        .insert({
          item_id: itemId,
          location_id: locationId,
          quantity,
          status: 'in_stock'
        });
    }

    // Create DeviceTest record (optional)
    try {
      await supabase
        .from('DeviceTest')
        .insert({
          item_id: itemId,
          test_type: 'PHONECHECK',
          test_result: testResult,
          notes: `PhoneCheck test for ${brand} ${model} - Status: ${workingStatus}`
        });
    } catch (error) {
      console.log(`Warning: Could not create DeviceTest for ${imei}: ${error}`);
    }

    // Create IMEI-related records (optional - only if they exist)
    try {
      // imei_sku_info
      await supabase
        .from('imei_sku_info')
        .upsert({
          imei,
          sku
        }, { onConflict: 'imei' });
    } catch (error) {
      console.log(`Warning: Could not create imei_sku_info for ${imei}: ${error}`);
    }

    try {
      // imei_inspect_data
      await supabase
        .from('imei_inspect_data')
        .upsert({
          imei,
          test_type: 'PHONECHECK',
          test_result: {
            rawStatus: {
              failed,
              working,
              status: testResult
            },
            batteryHealth,
            screenCondition,
            bodyCondition,
            notes,
            workingStatus
          }
        }, { onConflict: 'imei' });
    } catch (error) {
      console.log(`Warning: Could not create imei_inspect_data for ${imei}: ${error}`);
    }

    try {
      // imei_units
      await supabase
        .from('imei_units')
        .upsert({
          imei,
          unit_name: 'PHONECHECK_UNIT',
          unit_data: {
            deviceName: name,
            brand,
            model,
            storage,
            color,
            carrier,
            working: workingStatus,
            batteryHealth,
            notes
          }
        }, { onConflict: 'imei' });
    } catch (error) {
      console.log(`Warning: Could not create imei_units for ${imei}: ${error}`);
    }

    // Mark queue item as completed
    await supabase
      .from('imei_data_queue')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        error_message: null
      })
      .eq('id', item.id);
  }
}

export const queueProcessorService = new QueueProcessorService();
