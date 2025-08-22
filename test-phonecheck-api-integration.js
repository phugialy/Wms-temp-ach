// Test the full Phonecheck API integration
const BASE_URL = 'http://localhost:3001';

async function testBackendEndpoints() {
  console.log('🚀 Testing Phonecheck backend endpoints...');
  
  const testCases = [
    {
      name: 'Pull devices from station',
      method: 'POST',
      url: `${BASE_URL}/api/phonecheck/pull-devices`,
      body: {
        station: 'dncltechzoneinc',
        startDate: '2024-12-01',
        endDate: '2024-12-01'
      }
    },
    {
      name: 'Get device details by IMEI',
      method: 'GET',
      url: `${BASE_URL}/api/phonecheck/device/123456789012345`
    },
    {
      name: 'Process bulk devices',
      method: 'POST',
      url: `${BASE_URL}/api/phonecheck/process-bulk`,
      body: {
        station: 'dncltechzoneinc',
        startDate: '2024-12-01',
        endDate: '2024-12-01',
        location: 'Test Location'
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    console.log(`📤 ${testCase.method} ${testCase.url}`);
    
    try {
      const options = {
        method: testCase.method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (testCase.body) {
        options.body = JSON.stringify(testCase.body);
      }

      const response = await fetch(testCase.url, options);
      const responseText = await response.text();
      
      console.log(`📥 Status: ${response.status}`);
      
      try {
        const data = JSON.parse(responseText);
        console.log(`✅ Response:`, data);
        
        if (data.success) {
          console.log(`🎉 ${testCase.name} - SUCCESS`);
        } else {
          console.log(`⚠️ ${testCase.name} - API returned error: ${data.error}`);
        }
      } catch (parseError) {
        console.log(`❌ ${testCase.name} - Invalid JSON response: ${responseText.substring(0, 200)}`);
      }
    } catch (error) {
      console.log(`❌ ${testCase.name} - Network error: ${error.message}`);
    }
  }
}

async function testHealthCheck() {
  console.log('\n🏥 Testing health check...');
  
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    
    console.log(`📥 Status: ${response.status}`);
    console.log(`✅ Health check:`, data);
    
    return data.status === 'OK';
  } catch (error) {
    console.log(`❌ Health check failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting comprehensive Phonecheck API integration test...');
  
  // First check if the server is running
  const isHealthy = await testHealthCheck();
  
  if (!isHealthy) {
    console.log('\n💥 Server is not running or not healthy.');
    console.log('🔧 Please start the server with: npm start');
    return;
  }
  
  // Test the backend endpoints
  await testBackendEndpoints();
  
  console.log('\n🎉 Integration test completed!');
}

// Run if this file is executed directly
if (typeof window === 'undefined') {
  main();
}

module.exports = { testBackendEndpoints, testHealthCheck };
