const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

async function testQueueDataStructure() {
  console.log('🔍 Testing Queue Data Structure');
  console.log('================================\n');

  try {
    // Get a sample queue item to see the data structure
    console.log('1️⃣ Getting sample queue item...');
    const { data: queueItems, error: queueError } = await supabase
      .from('imei_data_queue')
      .select('*')
      .limit(1);

    if (queueError) {
      console.error('❌ Error getting queue items:', queueError);
      return;
    }

    if (queueItems && queueItems.length > 0) {
      const sampleItem = queueItems[0];
      console.log('📦 Sample Queue Item:');
      console.log('   ID:', sampleItem.id);
      console.log('   Status:', sampleItem.status);
      console.log('   Created:', sampleItem.created_at);
      console.log('   Raw Data Structure:');
      console.log(JSON.stringify(sampleItem.raw_data, null, 2));
      
      // Analyze the raw data
      const rawData = sampleItem.raw_data;
      console.log('\n🔍 Raw Data Analysis:');
      console.log('   IMEI:', rawData.imei);
      console.log('   Name:', rawData.name);
      console.log('   Brand:', rawData.brand);
      console.log('   Model:', rawData.model);
      console.log('   Storage:', rawData.storage);
      console.log('   Color:', rawData.color);
      console.log('   Carrier:', rawData.carrier);
      console.log('   Working:', rawData.working);
      console.log('   Failed:', rawData.failed);
      console.log('   Battery Health:', rawData.batteryHealth);
      console.log('   Screen Condition:', rawData.screenCondition);
      console.log('   Body Condition:', rawData.bodyCondition);
      console.log('   Notes:', rawData.notes);
      console.log('   Location:', rawData.location);
    }

    // Check what's in the Item table for comparison
    console.log('\n2️⃣ Checking Item table for comparison...');
    const { data: items, error: itemsError } = await supabase
      .from('Item')
      .select('*')
      .limit(3);

    if (itemsError) {
      console.error('❌ Error getting items:', itemsError);
      return;
    }

    if (items && items.length > 0) {
      console.log('📋 Sample Items from Database:');
      items.forEach((item, index) => {
        console.log(`\n   Item ${index + 1}:`);
        console.log(`   - IMEI: ${item.imei}`);
        console.log(`   - Name: ${item.name}`);
        console.log(`   - Brand: ${item.brand}`);
        console.log(`   - Model: ${item.model}`);
        console.log(`   - Storage: ${item.storage}`);
        console.log(`   - Color: ${item.color}`);
        console.log(`   - Carrier: ${item.carrier}`);
        console.log(`   - Working: ${item.working}`);
        console.log(`   - Condition: ${item.condition}`);
        console.log(`   - Battery Health: ${item.batteryHealth}`);
        console.log(`   - Screen Condition: ${item.screenCondition}`);
        console.log(`   - Body Condition: ${item.bodyCondition}`);
        console.log(`   - Notes: ${item.notes}`);
      });
    }

    // Check queue stats
    console.log('\n3️⃣ Queue Statistics:');
    const { data: stats, error: statsError } = await supabase
      .rpc('get_queue_stats');

    if (statsError) {
      console.error('❌ Error getting queue stats:', statsError);
    } else {
      console.log('📊 Queue Stats:', stats);
    }

    console.log('\n🎯 Data Structure Analysis Summary:');
    console.log('=====================================');
    console.log('✅ Queue data structure has been analyzed');
    console.log('✅ Database item structure has been compared');
    console.log('✅ This will help identify missing field mappings');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testQueueDataStructure().catch(console.error);
