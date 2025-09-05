const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testApiLogging() {
  console.log('🧪 Testing API Logging System');
  console.log('============================');
  
  try {
    // Test 1: Make a bulk add request
    console.log('\n📋 Test 1: Making bulk add request...');
    
    const testData = {
      items: [
        {
          imei: '123456789012345',
          brand: 'Samsung',
          model: 'Galaxy S21',
          storage: '256',
          color: 'Black',
          carrier: 'Unlocked',
          working: 'YES',
          location: 'INCOMING',
          notes: 'Test device for logging'
        },
        {
          imei: '123456789012346',
          brand: 'Apple',
          model: 'iPhone 13',
          storage: '128',
          color: 'Blue',
          carrier: 'Verizon',
          working: 'YES',
          location: 'INCOMING',
          notes: 'Another test device'
        }
      ],
      source: 'bulk-add'
    };
    
    const response = await axios.post(`${BASE_URL}/api/imei-queue/add`, testData);
    
    console.log('✅ Bulk add response:', {
      success: response.data.success,
      added: response.data.added,
      batch_id: response.data.batch_id,
      processing_triggered: response.data.processing_triggered
    });
    
    const batchId = response.data.batch_id;
    
    // Test 2: Check batch status
    console.log('\n📋 Test 2: Checking batch status...');
    
    const statusResponse = await axios.get(`${BASE_URL}/api/imei-queue/status/${batchId}`);
    
    console.log('✅ Batch status:', {
      batch_id: statusResponse.data.status.batch_id,
      status: statusResponse.data.status.status,
      processing_triggered: statusResponse.data.status.processing_triggered,
      items_count: statusResponse.data.status.items_count
    });
    
    // Test 3: Get recent logs
    console.log('\n📋 Test 3: Getting recent logs...');
    
    const logsResponse = await axios.get(`${BASE_URL}/api/imei-queue/logs?limit=5`);
    
    console.log('✅ Recent logs:', {
      count: logsResponse.data.count,
      latest_log: logsResponse.data.logs[0] ? {
        batch_id: logsResponse.data.logs[0].batch_id,
        status: logsResponse.data.logs[0].status,
        items_count: logsResponse.data.logs[0].items_count,
        processing_triggered: logsResponse.data.logs[0].processing_triggered
      } : 'No logs found'
    });
    
    // Test 4: Get processing statistics
    console.log('\n📋 Test 4: Getting processing statistics...');
    
    const statsResponse = await axios.get(`${BASE_URL}/api/imei-queue/processing-stats`);
    
    console.log('✅ Processing statistics:', {
      total_requests: statsResponse.data.stats.total_requests,
      completed_requests: statsResponse.data.stats.completed_requests,
      failed_requests: statsResponse.data.stats.failed_requests,
      triggered_requests: statsResponse.data.stats.triggered_requests,
      total_items_processed: statsResponse.data.stats.total_items_processed
    });
    
    // Test 5: Wait a bit and check status again
    console.log('\n📋 Test 5: Waiting 5 seconds and checking status again...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const finalStatusResponse = await axios.get(`${BASE_URL}/api/imei-queue/status/${batchId}`);
    
    console.log('✅ Final batch status:', {
      batch_id: finalStatusResponse.data.status.batch_id,
      status: finalStatusResponse.data.status.status,
      processing_triggered: finalStatusResponse.data.status.processing_triggered,
      processing_started_at: finalStatusResponse.data.status.processing_started_at,
      processing_completed_at: finalStatusResponse.data.status.processing_completed_at,
      items_processed: finalStatusResponse.data.status.items_processed,
      items_failed: finalStatusResponse.data.status.items_failed,
      processing_duration_ms: finalStatusResponse.data.status.processing_duration_ms
    });
    
    console.log('\n🎉 API Logging System Test Completed Successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response ? {
      status: error.response.status,
      statusText: error.response.statusText,
      data: error.response.data
    } : error.message);
  }
}

testApiLogging();


