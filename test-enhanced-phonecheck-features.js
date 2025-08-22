// Enhanced Phonecheck Features Test Suite
const BASE_URL = 'http://localhost:3001';

async function testEnhancedPhonecheckFeatures() {
  console.log('🚀 Testing Enhanced Phonecheck Features...\n');
  
  const testCases = [
    {
      name: 'Cache Management - Get Stats',
      endpoint: 'GET /api/phonecheck/cache/stats',
      method: 'GET',
      url: '/api/phonecheck/cache/stats'
    },
    {
      name: 'Cache-Optimized Bulk Processing',
      endpoint: 'POST /api/phonecheck/process-bulk-optimized',
      method: 'POST',
      url: '/api/phonecheck/process-bulk-optimized',
      body: {
        station: 'dncltz8',
        startDate: '2025-08-18',
        endDate: '2025-08-18',
        location: 'Test Location',
        batchSize: 10,
        useCache: true,
        optimizeData: true
      }
    },
    {
      name: 'Cache-Optimized Processing (No Cache)',
      endpoint: 'POST /api/phonecheck/process-bulk-optimized',
      method: 'POST',
      url: '/api/phonecheck/process-bulk-optimized',
      body: {
        station: 'dncltz8',
        startDate: '2025-08-18',
        endDate: '2025-08-18',
        location: 'Test Location',
        batchSize: 10,
        useCache: false,
        optimizeData: true
      }
    },
    {
      name: 'Individual Device Lookup (Cache Test)',
      endpoint: 'GET /api/phonecheck/device/123456789012345',
      method: 'GET',
      url: '/api/phonecheck/device/123456789012345'
    },
    {
      name: 'Cache Management - Clear Cache',
      endpoint: 'DELETE /api/phonecheck/cache',
      method: 'DELETE',
      url: '/api/phonecheck/cache'
    }
  ];

  for (const testCase of testCases) {
    console.log(`📊 Testing: ${testCase.name}`);
    console.log(`🔗 Endpoint: ${testCase.endpoint}`);
    
    const startTime = Date.now();
    
    try {
      const options = {
        method: testCase.method,
        headers: { 'Content-Type': 'application/json' }
      };

      if (testCase.body) {
        options.body = JSON.stringify(testCase.body);
        console.log(`📦 Request Body:`, JSON.stringify(testCase.body, null, 2));
      }

      const response = await fetch(`${BASE_URL}${testCase.url}`, options);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`📥 Status: ${response.status}`);
      console.log(`⏱️  Duration: ${duration}ms`);
      
      if (response.ok) {
        const result = await response.json();
        
        if (testCase.name.includes('Cache Stats')) {
          console.log(`📊 Cache Statistics:`, {
            cacheSize: result.data.size,
            entries: result.data.entries?.length || 0,
            message: result.message
          });
        } else if (testCase.name.includes('Bulk Processing')) {
          if (result.data.summary) {
            console.log(`📊 Optimized Processing Results:`, {
              totalDevices: result.data.summary.totalDevices || 0,
              successCount: result.data.summary.successCount || 0,
              errorCount: result.data.summary.errorCount || 0,
              cacheHits: result.data.summary.cacheHits || 0,
              cacheMisses: result.data.summary.cacheMisses || 0,
              cacheHitRate: result.data.summary.cacheHitRate || '0%',
              devicesProcessed: result.data.devices?.length || 0,
              message: result.message
            });
          } else {
            console.log(`📊 Standard Processing Results:`, {
              totalDevices: result.data?.count || 0,
              successCount: result.data?.successCount || 0,
              errorCount: result.data?.errorCount || 0,
              cacheHits: result.data?.cacheHits || 0,
              cacheMisses: result.data?.cacheMisses || 0,
              cacheHitRate: result.data?.cacheHitRate || '0%',
              processedDevices: result.data?.processed?.length || 0,
              message: result.message
            });
          }
        } else if (testCase.name.includes('Device Lookup')) {
          console.log(`📱 Device Lookup Results:`, {
            success: result.success,
            hasData: !!result.data,
            message: result.message
          });
        } else if (testCase.name.includes('Clear Cache')) {
          console.log(`🗑️  Cache Clear Results:`, {
            success: result.success,
            message: result.message
          });
        }
        
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
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Test cache performance comparison
async function testCachePerformanceComparison() {
  console.log('🔄 Testing Cache Performance Comparison...\n');
  
  const testConfig = {
    station: 'dncltz8',
    startDate: '2025-08-18',
    endDate: '2025-08-18',
    location: 'Test Location',
    batchSize: 5
  };

  // Test 1: First run (cache miss)
  console.log('📊 Test 1: First Run (Cache Miss)');
  const startTime1 = Date.now();
  
  try {
    const response1 = await fetch(`${BASE_URL}/api/phonecheck/process-bulk-optimized`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...testConfig,
        useCache: true,
        optimizeData: true
      })
    });
    
    const endTime1 = Date.now();
    const duration1 = endTime1 - startTime1;
    
    if (response1.ok) {
      const result1 = await response1.json();
      console.log(`⏱️  Duration: ${duration1}ms`);
      console.log(`📊 Results:`, {
        cacheHits: result1.data.summary?.cacheHits || 0,
        cacheMisses: result1.data.summary?.cacheMisses || 0,
        cacheHitRate: result1.data.summary?.cacheHitRate || '0%'
      });
    }
  } catch (error) {
    console.log(`❌ Test 1 failed:`, error.message);
  }

  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Second run (cache hit)
  console.log('\n📊 Test 2: Second Run (Cache Hit)');
  const startTime2 = Date.now();
  
  try {
    const response2 = await fetch(`${BASE_URL}/api/phonecheck/process-bulk-optimized`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...testConfig,
        useCache: true,
        optimizeData: true
      })
    });
    
    const endTime2 = Date.now();
    const duration2 = endTime2 - startTime2;
    
    if (response2.ok) {
      const result2 = await response2.json();
      console.log(`⏱️  Duration: ${duration2}ms`);
      console.log(`📊 Results:`, {
        cacheHits: result2.data.summary?.cacheHits || 0,
        cacheMisses: result2.data.summary?.cacheMisses || 0,
        cacheHitRate: result2.data.summary?.cacheHitRate || '0%'
      });
    }
  } catch (error) {
    console.log(`❌ Test 2 failed:`, error.message);
  }

  // Test 3: No cache run
  console.log('\n📊 Test 3: No Cache Run');
  const startTime3 = Date.now();
  
  try {
    const response3 = await fetch(`${BASE_URL}/api/phonecheck/process-bulk-optimized`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...testConfig,
        useCache: false,
        optimizeData: true
      })
    });
    
    const endTime3 = Date.now();
    const duration3 = endTime3 - startTime3;
    
    if (response3.ok) {
      const result3 = await response3.json();
      console.log(`⏱️  Duration: ${duration3}ms`);
      console.log(`📊 Results:`, {
        cacheHits: result3.data.summary?.cacheHits || 0,
        cacheMisses: result3.data.summary?.cacheMisses || 0,
        cacheHitRate: result3.data.summary?.cacheHitRate || '0%'
      });
    }
  } catch (error) {
    console.log(`❌ Test 3 failed:`, error.message);
  }

  console.log('\n📈 Performance Summary:');
  console.log(`• Cache Miss Run: ${duration1}ms`);
  console.log(`• Cache Hit Run: ${duration2}ms`);
  console.log(`• No Cache Run: ${duration3}ms`);
  
  if (duration1 > 0 && duration2 > 0) {
    const improvement = ((duration1 - duration2) / duration1 * 100).toFixed(2);
    console.log(`• Cache Improvement: ${improvement}% faster with cache`);
  }
}

// Test environment variable configuration
async function testEnvironmentConfiguration() {
  console.log('⚙️  Testing Environment Configuration...\n');
  
  try {
    const response = await fetch(`${BASE_URL}/health`);
    if (response.ok) {
      const health = await response.json();
      console.log(`🏥 Health Check:`, {
        status: health.status,
        environment: health.environment,
        timestamp: health.timestamp
      });
    }
  } catch (error) {
    console.log(`❌ Health check failed:`, error.message);
  }

  console.log('\n🔧 Environment Variables (Expected):');
  console.log('• PHONECHECK_USERNAME - Phonecheck API username');
  console.log('• PHONECHECK_PASSWORD - Phonecheck API password');
  console.log('• PHONECHECK_BASE_URL - Phonecheck API base URL');
  console.log('• PHONECHECK_CLIENT_API_URL - Phonecheck client API URL');
  console.log('• PHONECHECK_RETRY_ATTEMPTS - Number of retry attempts');
  console.log('• PHONECHECK_RETRY_DELAY - Delay between retries (ms)');
  console.log('• PHONECHECK_TIMEOUT - Request timeout (ms)');
  console.log('• PHONECHECK_CACHE_TIMEOUT - Cache timeout (ms)');
}

// Run the tests
async function main() {
  console.log('🎯 Enhanced Phonecheck Features Test Suite\n');
  
  try {
    await testEnhancedPhonecheckFeatures();
    await testCachePerformanceComparison();
    await testEnvironmentConfiguration();
    console.log('🎉 All enhanced feature tests completed!');
  } catch (error) {
    console.log('💥 Test suite failed:', error.message);
  }
}

// Run if this file is executed directly
if (typeof window === 'undefined') {
  main();
}

module.exports = { 
  testEnhancedPhonecheckFeatures, 
  testCachePerformanceComparison, 
  testEnvironmentConfiguration 
};


