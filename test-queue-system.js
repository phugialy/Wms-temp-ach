const { addBulkDataToQueue, addPhoneCheckToQueue, getQueueStats } = require('./src/services/simpleQueueService');
const { startQueueSystem } = require('./src/services/simpleQueueProcessor');

async function testQueueSystem() {
  console.log('🧪 Testing Queue System...');
  
  try {
    // Start the queue system
    startQueueSystem();
    console.log('✅ Queue system started');
    
    // Wait a moment for setup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 1: Add bulk data to queue
    console.log('\n📦 Testing bulk data queue...');
    const bulkData = {
      source: 'bulk-add',
      batchId: 'test-batch-001',
      items: [
        {
          imei: '111111111111111',
          model: 'iPhone 14 Pro',
          brand: 'Apple',
          capacity: '256GB',
          color: 'Space Black',
          carrier: 'Unlocked',
          working: 'YES',
          location: 'DNCL-Inspection'
        },
        {
          imei: '222222222222222',
          model: 'Samsung Galaxy S23',
          brand: 'Samsung',
          capacity: '512GB',
          color: 'Phantom Black',
          carrier: 'AT&T',
          working: 'PENDING',
          location: 'DNCL-Inspection'
        }
      ]
    };
    
    await addBulkDataToQueue(bulkData);
    console.log('✅ Bulk data added to queue');
    
    // Test 2: Add PhoneCheck data to queue
    console.log('\n📱 Testing PhoneCheck queue...');
    const phonecheckData = {
      imei: '333333333333333',
      source: 'phonecheck-api'
    };
    
    await addPhoneCheckToQueue(phonecheckData);
    console.log('✅ PhoneCheck data added to queue');
    
    // Wait for processing
    console.log('\n⏳ Waiting for queue processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test 3: Get queue stats
    console.log('\n📊 Getting queue statistics...');
    const stats = await getQueueStats();
    console.log('Queue Stats:', JSON.stringify(stats, null, 2));
    
    console.log('\n🎉 Queue system test completed!');
    
  } catch (error) {
    console.error('❌ Queue test failed:', error.message);
  }
}

// Run test
testQueueSystem();
