// Test to demonstrate performance improvements with new dynamic processing options
const BASE_URL = 'http://localhost:3001';

async function testPerformanceImprovements() {
  console.log('🚀 Testing performance improvements...\n');
  
  const testCases = [
    {
      name: 'Standard Processing (Original)',
      endpoint: '/api/phonecheck/process-bulk',
      body: {
        station: 'dncltz8',
        startDate: '2025-08-15',
        endDate: '2025-08-15',
        location: 'Test Location'
      }
    },
    {
      name: 'Batch Processing (10 devices per batch)',
      endpoint: '/api/phonecheck/process-bulk',
      body: {
        station: 'dncltz8',
        startDate: '2025-08-15',
        endDate: '2025-08-15',
        location: 'Test Location',
        batchSize: 10,
        streamMode: false
      }
    },
    {
      name: 'Streaming Processing (Real-time progress)',
      endpoint: '/api/phonecheck/process-bulk',
      body: {
        station: 'dncltz8',
        startDate: '2025-08-15',
        endDate: '2025-08-15',
        location: 'Test Location',
        batchSize: 5,
        streamMode: true
      }
    },
    {
      name: 'Chunked Processing (5 devices at a time)',
      endpoint: '/api/phonecheck/process-bulk-chunked',
      body: {
        station: 'dncltz8',
        startDate: '2025-08-15',
        endDate: '2025-08-15',
        location: 'Test Location',
        chunkSize: 5,
        offset: 0
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`📊 Testing: ${testCase.name}`);
    console.log(`🔗 Endpoint: ${testCase.endpoint}`);
    console.log(`⚙️  Configuration:`, JSON.stringify(testCase.body, null, 2));
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${BASE_URL}${testCase.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase.body)
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`📥 Status: ${response.status}`);
      
      if (response.ok) {
        if (testCase.body.streamMode) {
          // Handle streaming response
          console.log(`⏱️  Duration: ${duration}ms`);
          console.log(`📡 Streaming response received`);
          console.log(`✅ ${testCase.name} - SUCCESS (Streaming)`);
        } else {
          const result = await response.json();
          console.log(`⏱️  Duration: ${duration}ms`);
          console.log(`📊 Result:`, {
            totalDevices: result.data?.count || 0,
            successCount: result.data?.successCount || 0,
            errorCount: result.data?.errorCount || 0,
            message: result.message
          });
          console.log(`✅ ${testCase.name} - SUCCESS`);
        }
      } else {
        const errorData = await response.json();
        console.log(`❌ ${testCase.name} - FAILED:`, errorData.error);
      }
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log(`❌ ${testCase.name} - ERROR:`, error.message);
    }
    
    console.log('─'.repeat(80) + '\n');
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Test chunked processing with multiple chunks
async function testChunkedProcessing() {
  console.log('🔄 Testing chunked processing with multiple chunks...\n');
  
  let offset = 0;
  let hasMore = true;
  let chunkNumber = 1;
  
  while (hasMore) {
    console.log(`📦 Processing chunk ${chunkNumber} (offset: ${offset})`);
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${BASE_URL}/api/phonecheck/process-bulk-chunked`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station: 'dncltz8',
          startDate: '2025-08-15',
          endDate: '2025-08-15',
          location: 'Test Location',
          chunkSize: 3,
          offset: offset
        })
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      if (response.ok) {
        const result = await response.json();
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`📊 Chunk ${chunkNumber}:`, {
          devicesInChunk: result.data?.count || 0,
          totalDevices: result.data?.totalCount || 0,
          successCount: result.data?.successCount || 0,
          errorCount: result.data?.errorCount || 0,
          hasMore: result.data?.hasMore || false,
          nextOffset: result.data?.nextOffset || null
        });
        
        hasMore = result.data?.hasMore || false;
        offset = result.data?.nextOffset || 0;
        chunkNumber++;
        
        if (hasMore) {
          console.log(`⏳ Waiting before next chunk...`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else {
        const errorData = await response.json();
        console.log(`❌ Chunk ${chunkNumber} failed:`, errorData.error);
        break;
      }
    } catch (error) {
      console.log(`❌ Chunk ${chunkNumber} error:`, error.message);
      break;
    }
  }
  
  console.log(`✅ Chunked processing completed: ${chunkNumber - 1} chunks processed\n`);
}

// Run the tests
async function main() {
  console.log('🎯 Performance Improvement Tests\n');
  
  try {
    await testPerformanceImprovements();
    await testChunkedProcessing();
    console.log('🎉 All performance tests completed!');
  } catch (error) {
    console.log('💥 Test failed:', error.message);
  }
}

// Run if this file is executed directly
if (typeof window === 'undefined') {
  main();
}

module.exports = { testPerformanceImprovements, testChunkedProcessing };
