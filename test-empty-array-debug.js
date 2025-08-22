// Test to debug why processed array is empty
const BASE_URL = 'http://localhost:3001';

async function testEmptyArrayDebug() {
  console.log('🔍 Debugging empty array issue...\n');
  
  try {
    // Test 1: Pull devices first
    console.log('📤 Step 1: Pulling devices...');
    const pullResponse = await fetch(`${BASE_URL}/api/phonecheck/pull-devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        station: 'dncltz8',
        startDate: '2025-08-18',
        endDate: '2025-08-18'
      })
    });
    
    if (pullResponse.ok) {
      const pullData = await pullResponse.json();
      console.log(`✅ Pull successful: ${pullData.data.count} devices`);
      console.log(`📊 First device sample:`, JSON.stringify(pullData.data.devices[0], null, 2));
    } else {
      const error = await pullResponse.json();
      console.log(`❌ Pull failed:`, error.error);
      return;
    }
    
    // Test 2: Process with small batch size
    console.log('\n📤 Step 2: Processing with batch size 5...');
    const processResponse = await fetch(`${BASE_URL}/api/phonecheck/process-bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        station: 'dncltz8',
        startDate: '2025-08-18',
        endDate: '2025-08-18',
        location: 'Test Location',
        batchSize: 5,
        streamMode: false
      })
    });
    
    if (processResponse.ok) {
      const processData = await processResponse.json();
      console.log(`✅ Process successful:`);
      console.log(`📊 Total devices: ${processData.data.count}`);
      console.log(`📊 Processed devices: ${processData.data.processed.length}`);
      console.log(`📊 Success count: ${processData.data.successCount}`);
      console.log(`📊 Error count: ${processData.data.errorCount}`);
      
      if (processData.data.processed.length > 0) {
        console.log(`📊 First processed device:`, JSON.stringify(processData.data.processed[0], null, 2));
      } else {
        console.log(`⚠️  No processed devices in array!`);
      }
      
      if (processData.data.devices.length > 0) {
        console.log(`📊 First original device:`, JSON.stringify(processData.data.devices[0], null, 2));
      }
    } else {
      const error = await processResponse.json();
      console.log(`❌ Process failed:`, error.error);
    }
    
    // Test 3: Test chunked processing
    console.log('\n📤 Step 3: Testing chunked processing...');
    const chunkResponse = await fetch(`${BASE_URL}/api/phonecheck/process-bulk-chunked`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        station: 'dncltz8',
        startDate: '2025-08-18',
        endDate: '2025-08-18',
        location: 'Test Location',
        chunkSize: 3,
        offset: 0
      })
    });
    
    if (chunkResponse.ok) {
      const chunkData = await chunkResponse.json();
      console.log(`✅ Chunked process successful:`);
      console.log(`📊 Chunk devices: ${chunkData.data.count}`);
      console.log(`📊 Processed devices: ${chunkData.data.processed.length}`);
      console.log(`📊 Success count: ${chunkData.data.successCount}`);
      console.log(`📊 Error count: ${chunkData.data.errorCount}`);
      
      if (chunkData.data.processed.length > 0) {
        console.log(`📊 First chunked device:`, JSON.stringify(chunkData.data.processed[0], null, 2));
      } else {
        console.log(`⚠️  No processed devices in chunked array!`);
      }
    } else {
      const error = await chunkResponse.json();
      console.log(`❌ Chunked process failed:`, error.error);
    }
    
  } catch (error) {
    console.log(`💥 Test error:`, error.message);
  }
}

// Run the test
async function main() {
  console.log('🎯 Empty Array Debug Test\n');
  
  try {
    await testEmptyArrayDebug();
    console.log('\n🎉 Debug test completed!');
  } catch (error) {
    console.log('\n💥 Debug test failed:', error.message);
  }
}

// Run if this file is executed directly
if (typeof window === 'undefined') {
  main();
}

module.exports = { testEmptyArrayDebug };
