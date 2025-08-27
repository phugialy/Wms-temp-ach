const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

async function testHybridQueue() {
  console.log('🧪 Testing Hybrid Queue System...\n');

  try {
    // Test 1: Add items to queue via API
    console.log('1️⃣ Adding test items to hybrid queue...');
    const testItems = [
      {
        imei: '111111111111111',
        name: 'iPhone 13 Pro',
        brand: 'Apple',
        model: 'iPhone 13 Pro',
        storage: '256GB',
        color: 'Sierra Blue',
        carrier: 'Unlocked',
        location: 'Test Location 1',
        working: 'YES',
        failed: 'NO',
        batteryHealth: '95',
        screenCondition: 'Excellent',
        bodyCondition: 'Good',
        notes: 'Test item 1'
      },
      {
        imei: '222222222222222',
        name: 'Samsung Galaxy S21',
        brand: 'Samsung',
        model: 'Galaxy S21',
        storage: '128GB',
        color: 'Phantom Black',
        carrier: 'T-Mobile',
        location: 'Test Location 2',
        working: 'YES',
        failed: 'NO',
        batteryHealth: '88',
        screenCondition: 'Good',
        bodyCondition: 'Excellent',
        notes: 'Test item 2'
      },
      {
        imei: '333333333333333',
        name: 'Google Pixel 6',
        brand: 'Google',
        model: 'Pixel 6',
        storage: '128GB',
        color: 'Stormy Black',
        carrier: 'Verizon',
        location: 'Test Location 3',
        working: 'NO',
        failed: 'YES',
        batteryHealth: '45',
        screenCondition: 'Fair',
        bodyCondition: 'Poor',
        notes: 'Test item 3 - failed device'
      }
    ];

    const addResponse = await fetch('http://localhost:3001/api/hybrid-queue/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: testItems,
        source: 'test-hybrid-queue',
        priority: 1
      })
    });

    const addResult = await addResponse.json();
    console.log('✅ Add to queue result:', addResult);

    // Test 2: Get queue statistics
    console.log('\n2️⃣ Getting queue statistics...');
    const statsResponse = await fetch('http://localhost:3001/api/hybrid-queue/stats');
    const stats = await statsResponse.json();
    console.log('✅ Queue stats:', stats);

    // Test 3: Get queue items
    console.log('\n3️⃣ Getting queue items...');
    const itemsResponse = await fetch('http://localhost:3001/api/hybrid-queue/items?status=pending&limit=10');
    const items = await itemsResponse.json();
    console.log('✅ Queue items:', items);

    // Test 4: Process next item
    console.log('\n4️⃣ Processing next item...');
    const processResponse = await fetch('http://localhost:3001/api/hybrid-queue/process-next', {
      method: 'POST'
    });
    const processResult = await processResponse.json();
    console.log('✅ Process result:', processResult);

    // Test 5: Get updated statistics
    console.log('\n5️⃣ Getting updated statistics...');
    const updatedStatsResponse = await fetch('http://localhost:3001/api/hybrid-queue/stats');
    const updatedStats = await updatedStatsResponse.json();
    console.log('✅ Updated stats:', updatedStats);

    // Test 6: Get batch statistics (if batch ID is available)
    if (addResult.data && addResult.data.batchId) {
      console.log('\n6️⃣ Getting batch statistics...');
      const batchResponse = await fetch(`http://localhost:3001/api/hybrid-queue/batch/${addResult.data.batchId}`);
      const batchStats = await batchResponse.json();
      console.log('✅ Batch stats:', batchStats);
    }

    // Test 7: Check if items were created in the database
    console.log('\n7️⃣ Checking database for created items...');
    const { data: dbItems, error: itemsError } = await supabase
      .from('Item')
      .select('*')
      .in('imei', ['111111111111111', '222222222222222', '333333333333333'])
      .order('created_at', { ascending: false });

    if (itemsError) {
      console.log('❌ Error fetching items:', itemsError);
    } else {
      console.log('✅ Items in database:', dbItems);
    }

    // Test 8: Check inventory records
    console.log('\n8️⃣ Checking inventory records...');
    const { data: inventory, error: inventoryError } = await supabase
      .from('Inventory')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (inventoryError) {
      console.log('❌ Error fetching inventory:', inventoryError);
    } else {
      console.log('✅ Recent inventory records:', inventory);
    }

    // Test 9: Check IMEI-related records
    console.log('\n9️⃣ Checking IMEI-related records...');
    const { data: imeiSkuInfo, error: skuError } = await supabase
      .from('imei_sku_info')
      .select('*')
      .in('imei', ['111111111111111', '222222222222222', '333333333333333']);

    if (skuError) {
      console.log('❌ Error fetching IMEI SKU info:', skuError);
    } else {
      console.log('✅ IMEI SKU info:', imeiSkuInfo);
    }

    console.log('\n🎉 Hybrid Queue System Test Completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testHybridQueue().catch(console.error);
