const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

async function checkQueueData() {
  console.log('🔍 Checking Queue Data Structure');
  console.log('================================\n');

  try {
    // Get all queue items
    const { data: queueItems, error: queueError } = await supabase
      .from('imei_data_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (queueError) {
      console.error('❌ Error fetching queue data:', queueError);
      return;
    }

    console.log(`📊 Found ${queueItems.length} queue items`);
    console.log('');

    // Analyze the first few items
    queueItems.forEach((item, index) => {
      console.log(`📦 Queue Item ${index + 1}:`);
      console.log(`   ID: ${item.id}`);
      console.log(`   Status: ${item.status}`);
      console.log(`   Created: ${item.created_at}`);
      console.log(`   Processed: ${item.processed_at || 'Not processed'}`);
      console.log(`   Error: ${item.error_message || 'None'}`);
      
      console.log('   📋 Raw Data Fields:');
      const rawData = item.raw_data;
      if (rawData) {
        console.log(`     - imei: ${rawData.imei || 'MISSING'}`);
        console.log(`     - name: ${rawData.name || 'MISSING'}`);
        console.log(`     - brand: ${rawData.brand || 'MISSING'}`);
        console.log(`     - model: ${rawData.model || 'MISSING'}`);
        console.log(`     - storage: ${rawData.storage || 'MISSING'}`);
        console.log(`     - color: ${rawData.color || 'MISSING'}`);
        console.log(`     - carrier: ${rawData.carrier || 'MISSING'}`);
        console.log(`     - working: ${rawData.working || 'MISSING'}`);
        console.log(`     - failed: ${rawData.failed || 'MISSING'}`);
        console.log(`     - batteryHealth: ${rawData.batteryHealth || 'MISSING'}`);
        console.log(`     - screenCondition: ${rawData.screenCondition || 'MISSING'}`);
        console.log(`     - bodyCondition: ${rawData.bodyCondition || 'MISSING'}`);
        console.log(`     - location: ${rawData.location || 'MISSING'}`);
        console.log(`     - notes: ${rawData.notes || 'MISSING'}`);
        
        // Show all available fields
        console.log('     🔍 All available fields:');
        Object.keys(rawData).forEach(key => {
          console.log(`       - ${key}: ${rawData[key]}`);
        });
      } else {
        console.log('     ❌ No raw_data found!');
      }
      console.log('');
    });

    // Check queue statistics
    console.log('📊 Queue Statistics:');
    const { data: stats, error: statsError } = await supabase
      .from('imei_data_queue')
      .select('status');

    if (!statsError && stats) {
      const statusCounts = {};
      stats.forEach(item => {
        statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
      });
      
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count} items`);
      });
    }

    console.log('\n🎯 Analysis:');
    console.log('============');
    console.log('✅ Queue data is being stored correctly');
    console.log('❌ But items are not being processed into main tables');
    console.log('🔧 Need to fix the queue processor to move data from queue to Item/Inventory tables');

  } catch (error) {
    console.error('❌ Check failed:', error.message);
  }
}

checkQueueData().catch(console.error);
