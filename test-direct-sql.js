const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

async function testDirectSQL() {
  console.log('🔍 Testing Direct SQL Function');
  console.log('==============================\n');

  try {
    // Step 1: Check current queue status
    console.log('1️⃣ Checking current queue status...');
    const { data: statsData, error: statsError } = await supabase
      .rpc('get_queue_stats');
    
    if (statsError) {
      console.error('❌ Error getting queue stats:', statsError);
      return;
    }
    
    console.log('📊 Queue stats:', statsData);

    // Step 2: Check what's in the queue
    console.log('\n2️⃣ Checking queue items...');
    const { data: queueData, error: queueError } = await supabase
      .from('imei_data_queue')
      .select('*')
      .eq('status', 'pending')
      .limit(3);
    
    if (queueError) {
      console.error('❌ Error getting queue items:', queueError);
      return;
    }
    
    console.log('📦 Pending queue items:', queueData.length);
    if (queueData.length > 0) {
      console.log('   First item raw_data:', JSON.stringify(queueData[0].raw_data, null, 2));
    }

    // Step 3: Try to process directly
    console.log('\n3️⃣ Testing direct SQL processing...');
    const { data: processData, error: processError } = await supabase
      .rpc('process_all_pending_queue');
    
    if (processError) {
      console.error('❌ Error processing queue:', processError);
      console.error('   Error details:', processError.message);
      console.error('   Error code:', processError.code);
      return;
    }
    
    console.log('✅ Processing result:', processData);

    // Step 4: Check queue status after processing
    console.log('\n4️⃣ Checking queue status after processing...');
    const { data: statsAfterData, error: statsAfterError } = await supabase
      .rpc('get_queue_stats');
    
    if (statsAfterError) {
      console.error('❌ Error getting queue stats after processing:', statsAfterError);
      return;
    }
    
    console.log('📊 Queue stats after processing:', statsAfterData);

    // Step 5: Check if any items were created in the database
    console.log('\n5️⃣ Checking if items were created...');
    const { data: itemData, error: itemError } = await supabase
      .from('Item')
      .select('*')
      .limit(5);
    
    if (itemError) {
      console.error('❌ Error getting items:', itemError);
      return;
    }
    
    console.log('📦 Items in database:', itemData.length);
    if (itemData.length > 0) {
      console.log('   Latest items:', itemData.map(item => `${item.name} (${item.imei})`));
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testDirectSQL().catch(console.error);
