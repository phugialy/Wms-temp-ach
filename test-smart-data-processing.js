// Smart Data Processing Test Suite
const BASE_URL = 'http://localhost:3001';

async function testSmartDataProcessing() {
  console.log('🧠 Testing Smart Data Processing Features...\n');
  
  const testCases = [
    {
      name: 'Enhanced Device Details - Both Formats',
      endpoint: 'GET /api/phonecheck/device/{imei}/enhanced',
      method: 'GET',
      url: '/api/phonecheck/device/123456789012345/enhanced?includeRawData=true&dataFormat=both'
    },
    {
      name: 'Enhanced Device Details - Abstracted Only',
      endpoint: 'GET /api/phonecheck/device/{imei}/enhanced',
      method: 'GET',
      url: '/api/phonecheck/device/123456789012345/enhanced?includeRawData=false&dataFormat=abstracted'
    },
    {
      name: 'Enhanced Device Details - Raw Only',
      endpoint: 'GET /api/phonecheck/device/{imei}/enhanced',
      method: 'GET',
      url: '/api/phonecheck/device/123456789012345/enhanced?includeRawData=true&dataFormat=raw'
    },
    {
      name: 'Smart Bulk Processing - Minimal Format',
      endpoint: 'POST /api/phonecheck/process-bulk-smart',
      method: 'POST',
      url: '/api/phonecheck/process-bulk-smart',
      body: {
        station: 'dncltz8',
        startDate: '2025-08-18',
        endDate: '2025-08-18',
        location: 'Test Location',
        batchSize: 5,
        preserveDataQuality: true,
        dataFormat: 'minimal',
        includeRawData: false
      }
    },
    {
      name: 'Smart Bulk Processing - Standard Format',
      endpoint: 'POST /api/phonecheck/process-bulk-smart',
      method: 'POST',
      url: '/api/phonecheck/process-bulk-smart',
      body: {
        station: 'dncltz8',
        startDate: '2025-08-18',
        endDate: '2025-08-18',
        location: 'Test Location',
        batchSize: 5,
        preserveDataQuality: true,
        dataFormat: 'standard',
        includeRawData: true
      }
    },
    {
      name: 'Smart Bulk Processing - Full Format',
      endpoint: 'POST /api/phonecheck/process-bulk-smart',
      method: 'POST',
      url: '/api/phonecheck/process-bulk-smart',
      body: {
        station: 'dncltz8',
        startDate: '2025-08-18',
        endDate: '2025-08-18',
        location: 'Test Location',
        batchSize: 5,
        preserveDataQuality: true,
        dataFormat: 'full',
        includeRawData: true
      }
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
        
        if (testCase.name.includes('Enhanced Device Details')) {
          console.log(`📱 Enhanced Device Details Results:`, {
            success: result.success,
            hasAbstracted: !!result.data?.abstracted,
            hasRaw: !!result.data?.raw,
            hasMetadata: !!result.data?.metadata,
            dataQuality: result.data?.metadata?.dataQuality,
            processingLevel: result.data?.metadata?.processingLevel,
            message: result.message
          });
        } else if (testCase.name.includes('Smart Bulk Processing')) {
          console.log(`📊 Smart Bulk Processing Results:`, {
            totalDevices: result.data?.count || 0,
            successCount: result.data?.successCount || 0,
            errorCount: result.data?.errorCount || 0,
            dataQualityStats: result.data?.dataQualityStats || {},
            processingConfig: result.data?.processingConfig || {},
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

// Test data quality detection
async function testDataQualityDetection() {
  console.log('🔍 Testing Data Quality Detection...\n');
  
  const testConfig = {
    station: 'dncltz8',
    startDate: '2025-08-18',
    endDate: '2025-08-18',
    location: 'Test Location',
    batchSize: 10,
    preserveDataQuality: true,
    dataFormat: 'both',
    includeRawData: true
  };

  try {
    const response = await fetch(`${BASE_URL}/api/phonecheck/process-bulk-smart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testConfig)
    });
    
    if (response.ok) {
      const result = await response.json();
      const stats = result.data?.dataQualityStats;
      
      console.log('📈 Data Quality Analysis:');
      console.log(`• Total Devices: ${stats?.total || 0}`);
      console.log(`• Comprehensive Data: ${stats?.comprehensive || 0} (${stats?.comprehensiveRate || '0%'})`);
      console.log(`• Processed Data: ${stats?.processed || 0} (${stats?.processedRate || '0%'})`);
      console.log(`• Basic Data: ${stats?.basic || 0}`);
      
      console.log('\n🎯 Data Quality Insights:');
      if (stats?.comprehensive > 0) {
        console.log('✅ Found devices with comprehensive data (likely from another Phonecheck channel)');
        console.log('   → These devices will use minimal processing to preserve data integrity');
      }
      if (stats?.processed > 0) {
        console.log('🔄 Found devices requiring full processing');
        console.log('   → These devices will undergo complete data abstraction');
      }
      if (stats?.basic > 0) {
        console.log('⚠️  Found devices with basic data only');
        console.log('   → These devices will use fallback processing');
      }
    }
  } catch (error) {
    console.log(`❌ Data quality detection failed:`, error.message);
  }
}

// Test flexible data formats
async function testFlexibleDataFormats() {
  console.log('🎨 Testing Flexible Data Formats...\n');
  
  const formats = ['minimal', 'standard', 'full'];
  
  for (const format of formats) {
    console.log(`📋 Testing ${format.toUpperCase()} format:`);
    
    try {
      const response = await fetch(`${BASE_URL}/api/phonecheck/process-bulk-smart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station: 'dncltz8',
          startDate: '2025-08-18',
          endDate: '2025-08-18',
          location: 'Test Location',
          batchSize: 3,
          preserveDataQuality: true,
          dataFormat: format,
          includeRawData: false
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        const devices = result.data?.devices || [];
        
        if (devices.length > 0) {
          const sampleDevice = devices[0];
          const fields = Object.keys(sampleDevice).filter(key => 
            !['type', 'quantity', 'location', 'status', 'source', 'success'].includes(key)
          );
          
          console.log(`   • Fields included: ${fields.length}`);
          console.log(`   • Sample fields: ${fields.slice(0, 5).join(', ')}${fields.length > 5 ? '...' : ''}`);
          console.log(`   • Data quality: ${sampleDevice.dataQuality || 'unknown'}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ ${format} format test failed:`, error.message);
    }
    
    console.log('');
  }
}

// Test backend data authority
async function testBackendDataAuthority() {
  console.log('🏛️  Testing Backend Data Authority...\n');
  
  const testCases = [
    {
      name: 'Enhanced Device Details with Raw Data',
      url: '/api/phonecheck/device/123456789012345/enhanced?includeRawData=true&dataFormat=both'
    },
    {
      name: 'Enhanced Device Details without Raw Data',
      url: '/api/phonecheck/device/123456789012345/enhanced?includeRawData=false&dataFormat=abstracted'
    }
  ];

  for (const testCase of testCases) {
    console.log(`📊 Testing: ${testCase.name}`);
    
    try {
      const response = await fetch(`${BASE_URL}${testCase.url}`);
      
      if (response.ok) {
        const result = await response.json();
        
        console.log(`   ✅ Backend Authority Features:`);
        console.log(`   • Data validation: ${result.success ? 'Passed' : 'Failed'}`);
        console.log(`   • Metadata included: ${!!result.data?.metadata ? 'Yes' : 'No'}`);
        console.log(`   • Data quality assessment: ${result.data?.metadata?.dataQuality || 'Unknown'}`);
        console.log(`   • Processing level: ${result.data?.metadata?.processingLevel || 'Unknown'}`);
        console.log(`   • Timestamp: ${result.data?.metadata?.timestamp || 'Missing'}`);
        console.log(`   • Source tracking: ${result.data?.metadata?.source || 'Missing'}`);
      }
    } catch (error) {
      console.log(`   ❌ Test failed:`, error.message);
    }
    
    console.log('');
  }
}

// Run the tests
async function main() {
  console.log('🎯 Smart Data Processing Test Suite\n');
  
  try {
    await testSmartDataProcessing();
    await testDataQualityDetection();
    await testFlexibleDataFormats();
    await testBackendDataAuthority();
    console.log('🎉 All smart data processing tests completed!');
  } catch (error) {
    console.log('💥 Test suite failed:', error.message);
  }
}

// Run if this file is executed directly
if (typeof window === 'undefined') {
  main();
}

module.exports = { 
  testSmartDataProcessing, 
  testDataQualityDetection, 
  testFlexibleDataFormats,
  testBackendDataAuthority
};


