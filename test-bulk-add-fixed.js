const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';

async function testBulkAddFixed() {
  console.log('🧪 Testing Bulk Add with Fixed Queue System');
  console.log('============================================\n');

  try {
    // Test 1: Test adding items to the queue
    console.log('1️⃣ Testing bulk add to queue...');
    const mockBulkData = [
      {
        name: 'Test iPhone 13',
        brand: 'Apple',
        model: 'iPhone 13',
        storage: '128GB',
        color: 'Blue',
        carrier: 'Unlocked',
        type: 'SMARTPHONE',
        imei: '111111111111111',
        serialNumber: 'TEST111111',
        quantity: 1,
        location: 'Station 1',
        working: true,
        failed: false,
        batteryHealth: 95,
        screenCondition: 'Excellent',
        bodyCondition: 'Good'
      },
      {
        name: 'Test Samsung Galaxy S22',
        brand: 'Samsung',
        model: 'Galaxy S22',
        storage: '256GB',
        color: 'Black',
        carrier: 'Verizon',
        type: 'SMARTPHONE',
        imei: '222222222222222',
        serialNumber: 'TEST222222',
        quantity: 1,
        location: 'Station 2',
        working: 'YES',
        failed: 'NO',
        batteryHealth: 88,
        screenCondition: 'Good',
        bodyCondition: 'Excellent'
      }
    ];

    const queueResponse = await fetch(`${BASE_URL}/api/imei-queue/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: mockBulkData,
        source: 'bulk-add'
      })
    });

    const queueResult = await queueResponse.json();
    console.log('📦 Queue add result:', queueResult);

    if (queueResult.success) {
      console.log('✅ Bulk add to queue successful');
      console.log(`   Added: ${queueResult.added} items`);
      console.log(`   Errors: ${queueResult.errors.length}`);
    } else {
      console.log('❌ Bulk add to queue failed:', queueResult.error);
    }

    // Test 2: Test queue statistics
    console.log('\n2️⃣ Testing queue statistics...');
    const statsResponse = await fetch(`${BASE_URL}/api/imei-queue/stats`);
    const statsResult = await statsResponse.json();
    
    if (statsResult.success) {
      console.log('✅ Queue stats working');
      console.log(`   Total items: ${statsResult.data.total_items}`);
      console.log(`   Pending items: ${statsResult.data.pending_items}`);
      console.log(`   Processing items: ${statsResult.data.processing_items}`);
      console.log(`   Completed items: ${statsResult.data.completed_items}`);
      console.log(`   Failed items: ${statsResult.data.failed_items}`);
    } else {
      console.log('❌ Queue stats failed:', statsResult.error);
    }

    // Test 3: Test processing pending items
    console.log('\n3️⃣ Testing manual processing of pending items...');
    const processResponse = await fetch(`${BASE_URL}/api/imei-queue/process-pending`, {
      method: 'POST'
    });
    const processResult = await processResponse.json();
    
    if (processResult.success) {
      console.log('✅ Manual processing successful');
      console.log(`   Processed: ${processResult.data.processed} items`);
    } else {
      console.log('❌ Manual processing failed:', processResult.error);
    }

    // Test 4: Check final queue status
    console.log('\n4️⃣ Checking final queue status...');
    const finalStatsResponse = await fetch(`${BASE_URL}/api/imei-queue/stats`);
    const finalStatsResult = await finalStatsResponse.json();
    
    if (finalStatsResult.success) {
      console.log('✅ Final queue status:');
      console.log(`   Total items: ${finalStatsResult.data.total_items}`);
      console.log(`   Pending items: ${finalStatsResult.data.pending_items}`);
      console.log(`   Completed items: ${finalStatsResult.data.completed_items}`);
      console.log(`   Failed items: ${finalStatsResult.data.failed_items}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testBulkAddFixed().catch(console.error);
