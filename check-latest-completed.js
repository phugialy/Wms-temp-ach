const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

async function checkLatestCompleted() {
  console.log('🔍 Checking Latest Completed Queue Items');
  console.log('========================================\n');

  try {
    console.log('1️⃣ Checking most recent completed items...');
    const { data: completedData, error: completedError } = await supabase
      .from('imei_data_queue')
      .select('*')
      .eq('status', 'completed')
      .order('processed_at', { ascending: false })
      .limit(5);

    if (completedError) {
      console.error('❌ Error getting completed items:', completedError);
      return;
    }

    console.log(`✅ Found ${completedData.length} completed items (showing most recent 5)`);

    completedData.forEach((item, index) => {
      console.log(`\n   Completed Item ${index + 1}:`);
      console.log(`   - ID: ${item.id}`);
      console.log(`   - Status: ${item.status}`);
      console.log(`   - Created: ${item.created_at}`);
      console.log(`   - Processed: ${item.processed_at}`);
      console.log(`   - Error Message: ${item.error_message || 'No error message'}`);

      if (item.raw_data) {
        console.log(`   - IMEI: ${item.raw_data.imei || 'MISSING'}`);
        console.log(`   - Name: ${item.raw_data.name || 'MISSING'}`);
        console.log(`   - Brand: ${item.raw_data.brand || 'MISSING'}`);
        console.log(`   - Model: ${item.raw_data.model || 'MISSING'}`);
      }
    });

    // Check if any have the test message
    const testItems = completedData.filter(item => 
      item.error_message === 'TEST FUNCTION WORKING'
    );

    console.log('\n2️⃣ Test Function Results:');
    console.log('==========================');
    if (testItems.length > 0) {
      console.log(`✅ Found ${testItems.length} items with "TEST FUNCTION WORKING" message!`);
      console.log('✅ This confirms the function update mechanism is working!');
      console.log('✅ The simple test function is being executed properly!');
    } else {
      console.log('❌ No items found with "TEST FUNCTION WORKING" message');
      console.log('❌ This suggests the function may not have been updated properly');
    }

  } catch (error) {
    console.error('❌ Check failed:', error.message);
  }
}

checkLatestCompleted().catch(console.error);
