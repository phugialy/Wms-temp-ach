// Test to demonstrate performance optimizations
const BASE_URL = 'http://localhost:3001';

async function testPerformanceOptimizations() {
  console.log('🚀 Testing Performance Optimizations...\n');
  
  const testCases = [
    {
      name: 'Standard Processing (Original)',
      endpoint: '/api/phonecheck/process-bulk',
      body: {
        station: 'dncltz8',
        startDate: '2025-08-18',
        endDate: '2025-08-18',
        location: 'Test Location',
        batchSize: 10,
        streamMode: false,
        optimizeData: false
      }
    },
    {
      name: 'Optimized Processing (New)',
      endpoint: '/api/phonecheck/process-bulk',
      body: {
        station: 'dncltz8',
        startDate: '2025-08-18',
        endDate: '2025-08-18',
        location: 'Test Location',
        batchSize: 20,
        streamMode: false,
        optimizeData: true
      }
    },
    {
      name: 'Ultra-Fast Chunked Processing',
      endpoint: '/api/phonecheck/process-bulk-chunked',
      body: {
        station: 'dncltz8',
        startDate: '2025-08-18',
        endDate: '2025-08-18',
        location: 'Test Location',
        chunkSize: 15,
        offset: 0,
        optimizeData: true
      }
    },
    {
      name: 'Streaming Optimized Processing',
      endpoint: '/api/phonecheck/process-bulk',
      body: {
        station: 'dncltz8',
        startDate: '2025-08-18',
        endDate: '2025-08-18',
        location: 'Test Location',
        batchSize: 25,
        streamMode: true,
        optimizeData: true
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
          
          if (result.data.summary) {
            // Optimized response structure
            console.log(`📊 Optimized Result:`, {
              totalDevices: result.data.summary.totalDevices || 0,
              successCount: result.data.summary.successCount || 0,
              errorCount: result.data.summary.errorCount || 0,
              devicesProcessed: result.data.devices?.length || 0,
              message: result.message
            });
          } else {
            // Standard response structure
            console.log(`📊 Standard Result:`, {
              totalDevices: result.data?.count || 0,
              successCount: result.data?.successCount || 0,
              errorCount: result.data?.errorCount || 0,
              processedDevices: result.data?.processed?.length || 0,
              message: result.message
            });
          }
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

// Test chunked processing with multiple chunks for performance comparison
async function testChunkedPerformanceComparison() {
  console.log('🔄 Testing Chunked Performance Comparison...\n');
  
  const chunkSizes = [5, 10, 15, 20];
  
  for (const chunkSize of chunkSizes) {
    console.log(`📦 Testing chunk size: ${chunkSize}`);
    
    let offset = 0;
    let hasMore = true;
    let chunkNumber = 1;
    let totalSuccess = 0;
    let totalErrors = 0;
    const startTime = Date.now();
    
    while (hasMore && chunkNumber <= 3) { // Limit to 3 chunks for testing
      console.log(`  Processing chunk ${chunkNumber} (offset: ${offset})`);
      
      try {
        const response = await fetch(`${BASE_URL}/api/phonecheck/process-bulk-chunked`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            station: 'dncltz8',
            startDate: '2025-08-18',
            endDate: '2025-08-18',
            location: 'Test Location',
            chunkSize: chunkSize,
            offset: offset,
            optimizeData: true
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          
          if (result.data.summary) {
            totalSuccess += result.data.summary.successCount || 0;
            totalErrors += result.data.summary.errorCount || 0;
            hasMore = result.data.summary.hasMore || false;
            offset = result.data.summary.nextOffset || 0;
          }
          
          console.log(`    ✅ Chunk ${chunkNumber}: ${result.data.summary?.chunkDevices || 0} devices processed`);
        } else {
          const errorData = await response.json();
          console.log(`    ❌ Chunk ${chunkNumber} failed:`, errorData.error);
          break;
        }
        
        chunkNumber++;
        
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 200)); // Reduced delay
        }
      } catch (error) {
        console.log(`    ❌ Chunk ${chunkNumber} error:`, error.message);
        break;
      }
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`  📊 Chunk Size ${chunkSize} Results:`);
    console.log(`    ⏱️  Total Duration: ${duration}ms`);
    console.log(`    📦 Chunks Processed: ${chunkNumber - 1}`);
    console.log(`    ✅ Total Success: ${totalSuccess}`);
    console.log(`    ❌ Total Errors: ${totalErrors}`);
    console.log(`    🚀 Average per chunk: ${Math.round(duration / (chunkNumber - 1))}ms`);
    console.log('');
  }
}

// Test data structure optimization
async function testDataStructureOptimization() {
  console.log('📊 Testing Data Structure Optimization...\n');
  
  const testCases = [
    {
      name: 'Full Data Structure',
      optimizeData: false
    },
    {
      name: 'Optimized Data Structure',
      optimizeData: true
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`📊 Testing: ${testCase.name}`);
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${BASE_URL}/api/phonecheck/process-bulk-chunked`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station: 'dncltz8',
          startDate: '2025-08-18',
          endDate: '2025-08-18',
          location: 'Test Location',
          chunkSize: 5,
          offset: 0,
          optimizeData: testCase.optimizeData
        })
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      if (response.ok) {
        const result = await response.json();
        
        // Calculate response size
        const responseSize = JSON.stringify(result).length;
        const responseSizeKB = (responseSize / 1024).toFixed(2);
        
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`📦 Response Size: ${responseSizeKB} KB`);
        
        if (result.data.devices && result.data.devices.length > 0) {
          const firstDevice = result.data.devices[0];
          const deviceKeys = Object.keys(firstDevice);
          console.log(`🔑 Device Fields: ${deviceKeys.length} fields`);
          console.log(`📋 Fields: ${deviceKeys.join(', ')}`);
        }
        
        console.log(`✅ ${testCase.name} - SUCCESS`);
      } else {
        const errorData = await response.json();
        console.log(`❌ ${testCase.name} - FAILED:`, errorData.error);
      }
    } catch (error) {
      console.log(`❌ ${testCase.name} - ERROR:`, error.message);
    }
    
    console.log('─'.repeat(60) + '\n');
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Run the tests
async function main() {
  console.log('🎯 Performance Optimization Tests\n');
  
  try {
    await testPerformanceOptimizations();
    await testChunkedPerformanceComparison();
    await testDataStructureOptimization();
    console.log('🎉 All performance optimization tests completed!');
  } catch (error) {
    console.log('💥 Test failed:', error.message);
  }
}

// Run if this file is executed directly
if (typeof window === 'undefined') {
  main();
}

module.exports = { 
  testPerformanceOptimizations, 
  testChunkedPerformanceComparison, 
  testDataStructureOptimization 
};
