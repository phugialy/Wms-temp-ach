const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';

async function debugQueue() {
  console.log('🔍 Debugging Queue Processing');
  console.log('=============================\n');

  try {
    // Check queue items
    console.log('1️⃣ Checking queue items...');
    const queueResponse = await fetch(`${BASE_URL}/api/imei-queue/items`);
    const queueResult = await queueResponse.json();
    
    if (queueResult.success) {
      console.log('📦 Queue items:');
      console.log(`   Total items: ${queueResult.data.length}`);
      
      // Show first few items
      const firstItems = queueResult.data.slice(0, 3);
      firstItems.forEach((item, index) => {
        console.log(`\n   Item ${index + 1}:`);
        console.log(`   - ID: ${item.id}`);
        console.log(`   - Status: ${item.status}`);
        console.log(`   - Raw data keys: ${Object.keys(item.raw_data || {}).join(', ')}`);
        
        if (item.raw_data) {
          console.log(`   - IMEI: ${item.raw_data.imei || 'MISSING'}`);
          console.log(`   - Name: ${item.raw_data.name || 'MISSING'}`);
          console.log(`   - Brand: ${item.raw_data.brand || 'MISSING'}`);
          console.log(`   - Model: ${item.raw_data.model || 'MISSING'}`);
        }
      });
    }

    // Check failed items specifically
    console.log('\n2️⃣ Checking failed items...');
    const failedResponse = await fetch(`${BASE_URL}/api/imei-queue/items?status=failed`);
    const failedResult = await failedResponse.json();
    
    if (failedResult.success && failedResult.data.length > 0) {
      console.log(`📛 Failed items: ${failedResult.data.length}`);
      
      const firstFailed = failedResult.data[0];
      console.log('\n   First failed item:');
      console.log(`   - ID: ${firstFailed.id}`);
      console.log(`   - Status: ${firstFailed.status}`);
      console.log(`   - Error: ${firstFailed.error_message || 'No error message'}`);
      
      if (firstFailed.raw_data) {
        console.log(`   - Raw data: ${JSON.stringify(firstFailed.raw_data, null, 2)}`);
      }
    }

    // Try to process just one item manually
    console.log('\n3️⃣ Testing manual processing...');
    const processResponse = await fetch(`${BASE_URL}/api/imei-queue/process-pending`, {
      method: 'POST'
    });
    const processResult = await processResponse.json();
    
    console.log('📊 Processing result:', processResult);

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

// Run the debug
debugQueue().catch(console.error);
