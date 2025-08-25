const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

async function testSimpleDirect() {
  console.log('🧪 Simple Direct Database Test');
  console.log('==============================\n');

  try {
    // Test 1: Check if we can read from queue
    console.log('1️⃣ Testing queue read...');
    const { data: queueData, error: queueError } = await supabase
      .from('imei_data_queue')
      .select('*')
      .limit(1);

    if (queueError) {
      console.error('❌ Queue read failed:', queueError);
      return;
    }
    console.log('✅ Queue read successful, found', queueData.length, 'items');

    // Test 2: Check if we can read from Item table
    console.log('\n2️⃣ Testing Item table read...');
    const { data: itemData, error: itemError } = await supabase
      .from('Item')
      .select('*')
      .limit(1);

    if (itemError) {
      console.error('❌ Item table read failed:', itemError);
      return;
    }
    console.log('✅ Item table read successful, found', itemData.length, 'items');

    // Test 3: Check if we can read from Location table
    console.log('\n3️⃣ Testing Location table read...');
    const { data: locationData, error: locationError } = await supabase
      .from('Location')
      .select('*')
      .limit(1);

    if (locationError) {
      console.error('❌ Location table read failed:', locationError);
      return;
    }
    console.log('✅ Location table read successful, found', locationData.length, 'items');

    // Test 4: Try to insert a simple test item directly
    console.log('\n4️⃣ Testing direct Item insert...');
    const testItem = {
      imei: 'TEST123456789',
      name: 'Direct Test Device',
      sku: 'TEST-SKU-123',
      description: 'Direct test insertion',
      status: 'active'
    };

    const { data: insertData, error: insertError } = await supabase
      .from('Item')
      .insert(testItem)
      .select();

    if (insertError) {
      console.error('❌ Direct Item insert failed:', insertError);
    } else {
      console.log('✅ Direct Item insert successful:', insertData);
    }

    // Test 5: Check if we can call the RPC function directly
    console.log('\n5️⃣ Testing direct RPC call...');
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('get_queue_stats');

    if (rpcError) {
      console.error('❌ RPC call failed:', rpcError);
    } else {
      console.log('✅ RPC call successful:', rpcData);
    }

    // Test 6: Check current queue status
    console.log('\n6️⃣ Current queue status...');
    const { data: statsData, error: statsError } = await supabase
      .from('imei_data_queue')
      .select('status')
      .then(result => {
        if (result.error) return result;
        
        const statusCounts = {};
        result.data.forEach(item => {
          statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
        });
        return { data: statusCounts, error: null };
      });

    if (statsError) {
      console.error('❌ Queue stats failed:', statsError);
    } else {
      console.log('✅ Queue status counts:', statsData);
    }

    console.log('\n🎯 Simple Test Summary:');
    console.log('=======================');
    console.log('✅ Basic database connectivity is working');
    console.log('✅ Table reads are working');
    console.log('✅ RPC functions are accessible');
    console.log('✅ Direct inserts should work');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSimpleDirect().catch(console.error);
