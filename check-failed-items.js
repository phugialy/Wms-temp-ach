const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

async function checkFailedItems() {
  console.log('🔍 Checking Failed Queue Items');
  console.log('==============================\n');

  try {
    // Check failed items
    console.log('1️⃣ Checking failed queue items...');
    const { data: failedData, error: failedError } = await supabase
      .from('imei_data_queue')
      .select('*')
      .eq('status', 'failed')
      .limit(5);
    
    if (failedError) {
      console.error('❌ Error getting failed items:', failedError);
      return;
    }
    
    console.log(`📛 Found ${failedData.length} failed items (showing first 5)`);
    
    failedData.forEach((item, index) => {
      console.log(`\n   Failed Item ${index + 1}:`);
      console.log(`   - ID: ${item.id}`);
      console.log(`   - Status: ${item.status}`);
      console.log(`   - Created: ${item.created_at}`);
      console.log(`   - Processed: ${item.processed_at}`);
      console.log(`   - Error: ${item.error_message || 'No error message'}`);
      
      if (item.raw_data) {
        console.log(`   - Raw data keys: ${Object.keys(item.raw_data).join(', ')}`);
        console.log(`   - IMEI: ${item.raw_data.imei || 'MISSING'}`);
        console.log(`   - Name: ${item.raw_data.name || 'MISSING'}`);
        console.log(`   - Brand: ${item.raw_data.brand || 'MISSING'}`);
        console.log(`   - Model: ${item.raw_data.model || 'MISSING'}`);
      }
    });

    // Check if there are any pending items
    console.log('\n2️⃣ Checking for pending items...');
    const { data: pendingData, error: pendingError } = await supabase
      .from('imei_data_queue')
      .select('*')
      .eq('status', 'pending');
    
    if (pendingError) {
      console.error('❌ Error getting pending items:', pendingError);
      return;
    }
    
    console.log(`📦 Pending items: ${pendingData.length}`);

    // Check completed items
    console.log('\n3️⃣ Checking completed items...');
    const { data: completedData, error: completedError } = await supabase
      .from('imei_data_queue')
      .select('*')
      .eq('status', 'completed')
      .limit(3);
    
    if (completedError) {
      console.error('❌ Error getting completed items:', completedError);
      return;
    }
    
    console.log(`✅ Completed items: ${completedData.length}`);
    if (completedData.length > 0) {
      console.log('   First completed item:');
      console.log(`   - ID: ${completedData[0].id}`);
      console.log(`   - IMEI: ${completedData[0].raw_data?.imei || 'MISSING'}`);
      console.log(`   - Name: ${completedData[0].raw_data?.name || 'MISSING'}`);
    }

    // Check if the completed items actually exist in the database
    console.log('\n4️⃣ Checking if completed items exist in database...');
    if (completedData.length > 0) {
      const testImei = completedData[0].raw_data?.imei;
      if (testImei) {
        const { data: itemData, error: itemError } = await supabase
          .from('Item')
          .select('*')
          .eq('imei', testImei);
        
        if (itemError) {
          console.error('❌ Error checking item in database:', itemError);
        } else {
          console.log(`📦 Item with IMEI ${testImei} in database: ${itemData.length > 0 ? 'YES' : 'NO'}`);
          if (itemData.length > 0) {
            console.log(`   - Name: ${itemData[0].name}`);
            console.log(`   - SKU: ${itemData[0].sku}`);
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Check failed:', error.message);
  }
}

// Run the check
checkFailedItems().catch(console.error);
