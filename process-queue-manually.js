const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

async function processQueueManually() {
  console.log('🔧 Manually Processing Queue Items');
  console.log('==================================\n');

  try {
    // Get all pending items
    const { data: pendingItems, error: fetchError } = await supabase
      .from('imei_data_queue')
      .select('*')
      .eq('status', 'pending');

    if (fetchError) {
      console.error('❌ Error fetching pending items:', fetchError);
      return;
    }

    if (!pendingItems || pendingItems.length === 0) {
      console.log('✅ No pending items to process');
      return;
    }

    console.log(`📊 Found ${pendingItems.length} pending items to process\n`);

    let processed = 0;
    let errors = 0;

    // Process each item
    for (const item of pendingItems) {
      try {
        console.log(`🔄 Processing item ${item.id} (IMEI: ${item.raw_data.imei})`);
        
        const rawData = item.raw_data;
        
        // Extract data
        const imei = rawData.imei;
        const name = rawData.name;
        const brand = rawData.brand;
        const model = rawData.model;
        const storage = rawData.storage;
        const color = rawData.color;
        const carrier = rawData.carrier;
        const location = rawData.location;
        const working = rawData.working;
        const batteryHealth = rawData.batteryHealth;
        const notes = rawData.notes;
        const quantity = rawData.quantity || 1;
        const condition = rawData.condition || 'UNKNOWN';

        // Generate SKU
        const sku = `${brand.toUpperCase()}-${model.toUpperCase()}-${storage || ''}-${color || ''}-${carrier || 'UNLOCKED'}`.replace(/\s+/g, '');

        // Determine working status
        let workingStatus = 'PENDING';
        if (working === 'YES' || working === 'true' || working === 'TRUE') {
          workingStatus = 'YES';
        } else if (working === 'NO' || working === 'false' || working === 'FALSE') {
          workingStatus = 'NO';
        }

        // Find or create location
        let locationId;
        const { data: existingLocation } = await supabase
          .from('Location')
          .select('id')
          .eq('name', location)
          .limit(1);

        if (existingLocation && existingLocation.length > 0) {
          locationId = existingLocation[0].id;
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

        // Create or update Item
        let itemId;
        const { data: existingItem } = await supabase
          .from('Item')
          .select('id')
          .eq('imei', imei)
          .limit(1);

        if (existingItem && existingItem.length > 0) {
          itemId = existingItem[0].id;
          // Update existing item
          await supabase
            .from('Item')
            .update({
              name,
              sku,
              brand,
              model,
              storage,
              color,
              carrier,
              working: workingStatus,
              condition,
              batteryHealth,
              notes,
              description: `${brand} ${model} ${storage || ''} ${color || ''} ${carrier || ''}`.trim()
            })
            .eq('id', itemId);
        } else {
          // Create new item
          const { data: newItem, error: itemError } = await supabase
            .from('Item')
            .insert({
              imei,
              name,
              sku,
              brand,
              model,
              storage,
              color,
              carrier,
              working: workingStatus,
              condition,
              batteryHealth,
              notes,
              type: 'SMARTPHONE',
              status: 'active',
              description: `${brand} ${model} ${storage || ''} ${color || ''} ${carrier || ''}`.trim()
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
              quantity: (existingInventory[0].quantity || 0) + quantity
            })
            .eq('id', existingInventory[0].id);
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

        // Mark queue item as completed
        await supabase
          .from('imei_data_queue')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
            error_message: null
          })
          .eq('id', item.id);

        console.log(`✅ Successfully processed item ${item.id}`);
        processed++;

      } catch (error) {
        console.error(`❌ Error processing item ${item.id}:`, error.message);
        
        // Mark item as failed
        await supabase
          .from('imei_data_queue')
          .update({
            status: 'failed',
            processed_at: new Date().toISOString(),
            error_message: error.message
          })
          .eq('id', item.id);
        
        errors++;
      }
    }

    console.log('\n🎯 Processing Complete!');
    console.log('=======================');
    console.log(`✅ Successfully processed: ${processed} items`);
    console.log(`❌ Errors: ${errors} items`);
    console.log(`📊 Total items: ${pendingItems.length}`);

    // Check final queue status
    const { data: finalStats } = await supabase
      .from('imei_data_queue')
      .select('status');

    if (finalStats) {
      const statusCounts = {};
      finalStats.forEach(item => {
        statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
      });
      
      console.log('\n📊 Final Queue Status:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count} items`);
      });
    }

  } catch (error) {
    console.error('❌ Processing failed:', error.message);
  }
}

processQueueManually().catch(console.error);
