const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';

async function testFinalQueue() {
  console.log('🧪 Final Queue Processing Test');
  console.log('==============================\n');

  try {
    // Step 1: Add fresh test data with unique IMEI
    console.log('1️⃣ Adding fresh test data to queue...');
    const testData = [
      {
        name: 'Final Test iPhone 16',
        brand: 'Apple',
        model: 'iPhone 16',
        storage: '512GB',
        color: 'Gold',
        carrier: 'Unlocked',
        type: 'SMARTPHONE',
        imei: '888888888888888',
        serialNumber: 'FINAL888888',
        quantity: 1,
        location: 'Final Test Station',
        working: 'YES',
        failed: 'NO',
        batteryHealth: 100,
        screenCondition: 'Perfect',
        bodyCondition: 'Mint',
        notes: 'Final test device - should PASS'
      }
    ];

    const addResponse = await fetch(`${BASE_URL}/api/imei-queue/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: testData,
        source: 'final-test'
      })
    });

    const addResult = await addResponse.json();
    console.log('📦 Add result:', addResult);

    if (!addResult.success) {
      console.log('❌ Failed to add test data');
      return;
    }

    // Step 2: Check queue status
    console.log('\n2️⃣ Checking queue status...');
    const statsResponse = await fetch(`${BASE_URL}/api/imei-queue/stats`);
    const statsResult = await statsResponse.json();
    
    if (statsResult.success) {
      console.log('📊 Queue status:');
      console.log(`   Total items: ${statsResult.data.total_items}`);
      console.log(`   Pending items: ${statsResult.data.pending_items}`);
      console.log(`   Completed items: ${statsResult.data.completed_items}`);
      console.log(`   Failed items: ${statsResult.data.failed_items}`);
    }

    // Step 3: Process the queue
    console.log('\n3️⃣ Processing queue...');
    const processResponse = await fetch(`${BASE_URL}/api/imei-queue/process-pending`, {
      method: 'POST'
    });
    const processResult = await processResponse.json();
    
    console.log('📊 Processing result:', processResult);

    // Step 4: Check queue status after processing
    console.log('\n4️⃣ Checking queue status after processing...');
    const statsAfterResponse = await fetch(`${BASE_URL}/api/imei-queue/stats`);
    const statsAfterResult = await statsAfterResponse.json();
    
    if (statsAfterResult.success) {
      console.log('📊 Queue status after processing:');
      console.log(`   Total items: ${statsAfterResult.data.total_items}`);
      console.log(`   Pending items: ${statsAfterResult.data.pending_items}`);
      console.log(`   Completed items: ${statsAfterResult.data.completed_items}`);
      console.log(`   Failed items: ${statsAfterResult.data.failed_items}`);
    }

    // Step 5: Check if data was created in database
    console.log('\n5️⃣ Checking if data was created in database...');
    const inventoryResponse = await fetch(`${BASE_URL}/api/admin/inventory`);
    const inventoryResult = await inventoryResponse.json();
    
    if (inventoryResult.success) {
      console.log('📦 Inventory check:');
      console.log(`   Total items in inventory: ${inventoryResult.data.length}`);
      
      // Look for our test item
      const testItem = inventoryResult.data.find(item => item.imei === '888888888888888');
      
      if (testItem) {
        console.log('✅ Test item found in inventory!');
        console.log(`   - Name: ${testItem.name}`);
        console.log(`   - IMEI: ${testItem.imei}`);
        console.log(`   - SKU: ${testItem.sku}`);
        console.log(`   - Status: ${testItem.status}`);
      } else {
        console.log('❌ Test item NOT found in inventory');
      }
    }

    // Step 6: Check IMEI data
    console.log('\n6️⃣ Checking IMEI data...');
    const imeiResponse = await fetch(`${BASE_URL}/api/admin/search-imei?query=888888888888888`);
    const imeiResult = await imeiResponse.json();
    
    if (imeiResult.success) {
      console.log('📱 IMEI search result:');
      console.log(`   Found ${imeiResult.data.length} records for test IMEI`);
      
      imeiResult.data.forEach((record, index) => {
        console.log(`   Record ${index + 1}: ${record.table} - ${record.imei}`);
      });
    }

    console.log('\n🎯 Final Test Summary:');
    console.log('=====================');
    if (processResult.success && processResult.data.processed > 0) {
      console.log('✅ SUCCESS! Queue processing is working!');
      console.log('✅ Data is being moved from queue to database');
      console.log('✅ The ambiguous column reference issue is fixed!');
    } else {
      console.log('❌ Queue processing is still not working properly');
      console.log('   Items are not being processed into database tables');
      console.log('   There may still be an issue with the function');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testFinalQueue().catch(console.error);
