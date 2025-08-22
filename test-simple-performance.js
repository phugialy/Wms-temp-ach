// Simple performance test to verify current improvements
const BASE_URL = 'http://localhost:3001';

async function testSimplePerformance() {
  console.log('🚀 Simple Performance Test...\n');
  
  const testCases = [
    {
      name: 'Standard Processing (Original)',
      optimizeData: false,
      batchSize: 10
    },
    {
      name: 'Optimized Processing (New)',
      optimizeData: true,
      batchSize: 20
    }
  ];

  for (const testCase of testCases) {
    console.log(`📊 Testing: ${testCase.name}`);
    console.log(`⚙️  Configuration: optimizeData=${testCase.optimizeData}, batchSize=${testCase.batchSize}`);
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${BASE_URL}/api/phonecheck/process-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station: 'dncltz8',
          startDate: '2025-08-18',
          endDate: '2025-08-18',
          location: 'Test Location',
          batchSize: testCase.batchSize,
          streamMode: false,
          optimizeData: testCase.optimizeData
        })
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`📥 Status: ${response.status}`);
      
      if (response.ok) {
        const result = await response.json();
        const responseSize = JSON.stringify(result).length;
        
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`📦 Response Size: ${(responseSize / 1024).toFixed(2)}KB`);
        
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
        
        // Calculate performance metrics
        const totalDevices = result.data.summary?.totalDevices || result.data.count || 0;
        const successCount = result.data.summary?.successCount || result.data.successCount || 0;
        const devicesPerSecond = totalDevices > 0 ? (totalDevices / (duration / 1000)).toFixed(1) : '0';
        const successRate = totalDevices > 0 ? `${Math.round((successCount / totalDevices) * 100)}%` : '0%';
        
        console.log(`🚀 Performance Metrics:`);
        console.log(`   • Processing Time: ${duration}ms`);
        console.log(`   • Devices/Second: ${devicesPerSecond}`);
        console.log(`   • Response Size: ${(responseSize / 1024).toFixed(2)}KB`);
        console.log(`   • Success Rate: ${successRate}`);
        
        console.log(`✅ ${testCase.name} - SUCCESS`);
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
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Test data structure comparison
async function testDataStructureComparison() {
  console.log('📊 Data Structure Comparison Test...\n');
  
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
      const response = await fetch(`${BASE_URL}/api/phonecheck/process-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station: 'dncltz8',
          startDate: '2025-08-18',
          endDate: '2025-08-18',
          location: 'Test Location',
          batchSize: 5,
          streamMode: false,
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
        } else if (result.data.processed && result.data.processed.length > 0) {
          const firstDevice = result.data.processed[0];
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
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Run the tests
async function main() {
  console.log('🎯 Simple Performance Test\n');
  
  try {
    await testSimplePerformance();
    await testDataStructureComparison();
    console.log('🎉 Simple performance tests completed!');
  } catch (error) {
    console.log('💥 Test failed:', error.message);
  }
}

// Run if this file is executed directly
if (typeof window === 'undefined') {
  main();
}

module.exports = { testSimplePerformance, testDataStructureComparison };
