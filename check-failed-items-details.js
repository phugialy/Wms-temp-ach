const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

async function checkFailedItemsDetails() {
  console.log('🔍 Checking Failed Queue Items Details');
  console.log('=====================================\n');

  try {
    // Get failed items
    const { data: failedItems, error } = await supabase
      .from('imei_data_queue')
      .select('*')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error fetching failed items:', error);
      return;
    }

    console.log(`📊 Found ${failedItems.length} failed items\n`);

    failedItems.forEach((item, index) => {
      console.log(`❌ Failed Item ${index + 1}:`);
      console.log(`   ID: ${item.id}`);
      console.log(`   IMEI: ${item.raw_data.imei || item.raw_data.IMEI || 'Unknown'}`);
      console.log(`   Error: ${item.error_message}`);
      console.log(`   Created: ${item.created_at}`);
      console.log(`   Processed: ${item.processed_at}`);
      console.log('');
    });

    // Also check for items that are still pending
    const { data: pendingItems } = await supabase
      .from('imei_data_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);

    if (pendingItems && pendingItems.length > 0) {
      console.log(`📦 Found ${pendingItems.length} pending items\n`);
      
      pendingItems.forEach((item, index) => {
        console.log(`⏳ Pending Item ${index + 1}:`);
        console.log(`   ID: ${item.id}`);
        console.log(`   IMEI: ${item.raw_data.imei || item.raw_data.IMEI || 'Unknown'}`);
        console.log(`   Created: ${item.created_at}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Check failed:', error.message);
  }
}

checkFailedItemsDetails().catch(console.error);
