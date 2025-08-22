// Test alternative endpoints and parameters for date filtering
const PHONECHECK_CONFIG = {
  username: 'dncltechzoneinc',
  password: '@Ustvmos817',
  baseUrl: 'https://api.phonecheck.com',
  retryAttempts: 3,
  retryDelay: 1000,
  requestTimeout: 30000,
};

async function getAuthToken() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PHONECHECK_CONFIG.requestTimeout);

    const response = await fetch(`${PHONECHECK_CONFIG.baseUrl}/v2/auth/master/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: PHONECHECK_CONFIG.username,
        password: PHONECHECK_CONFIG.password
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Authentication failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (!data.token) {
      throw new Error('No authentication token received');
    }

    console.log('✅ Authentication successful');
    return data.token;
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    throw error;
  }
}

async function testEndpoint(endpoint, method, payload, description) {
  try {
    const token = await getAuthToken();
    
    console.log(`\n🔍 Testing: ${description}`);
    console.log(`📡 Endpoint: ${endpoint}`);
    console.log(`📤 Method: ${method}`);
    if (payload) {
      console.log(`📤 Payload:`, JSON.stringify(payload, null, 2));
    }

    const options = {
      method: method,
      headers: { 
        'Content-Type': 'application/json', 
        'token_master': token 
      }
    };

    if (payload && method === 'POST') {
      options.body = JSON.stringify(payload);
    }

    const response = await fetch(endpoint, options);
    console.log(`📥 Status: ${response.status}`);

    if (response.ok) {
      const responseText = await response.text();
      console.log(`📄 Response length: ${responseText.length} characters`);
      
      try {
        const data = JSON.parse(responseText);
        console.log(`✅ Response parsed successfully`);
        
        if (data && typeof data === 'object') {
          console.log(`📊 Response keys:`, Object.keys(data));
          
          if (data.numberOfDevices !== undefined) {
            console.log(`📊 Number of devices: ${data.numberOfDevices}`);
          }
          
          if (data.devices && Array.isArray(data.devices)) {
            console.log(`📊 Devices array length: ${data.devices.length}`);
            
            // Check if date filtering is working
            if (data.devices.length > 0 && payload && payload.startDate) {
              const requestedDate = payload.startDate;
              const deviceDates = data.devices.map(device => 
                device.createdAt ? new Date(device.createdAt).toISOString().split('T')[0] : 'Unknown'
              );
              
              const matchingDates = deviceDates.filter(date => date === requestedDate);
              console.log(`📅 Date filtering: ${matchingDates.length}/${data.devices.length} devices match requested date (${requestedDate})`);
            }
          }
        }
        
        return { success: true, data };
      } catch (parseError) {
        console.log(`❌ Failed to parse JSON: ${parseError.message}`);
        return { success: false, error: 'JSON parse error' };
      }
    } else {
      const errorText = await response.text();
      console.log(`❌ Request failed: ${errorText}`);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testAlternativeEndpoints() {
  console.log('🚀 Testing alternative endpoints and parameters...');
  
  const station = 'dncltz2';
  const testDate = '2025-08-15';
  
  const tests = [
    // Test different endpoints
    {
      endpoint: `${PHONECHECK_CONFIG.baseUrl}/v2/master/devices`,
      method: 'POST',
      payload: {
        startDate: testDate,
        endDate: testDate,
        station: station,
        limit: 500,
        offset: 0
      },
      description: 'Alternative devices endpoint'
    },
    {
      endpoint: `${PHONECHECK_CONFIG.baseUrl}/v2/master/station/${station}/devices`,
      method: 'GET',
      payload: null,
      description: 'Station-specific devices endpoint'
    },
    {
      endpoint: `${PHONECHECK_CONFIG.baseUrl}/v2/master/devices-by-date`,
      method: 'POST',
      payload: {
        startDate: testDate,
        endDate: testDate,
        station: station,
        limit: 500,
        offset: 0
      },
      description: 'Devices by date endpoint'
    },
    {
      endpoint: `${PHONECHECK_CONFIG.baseUrl}/v2/master/all-devices`,
      method: 'POST',
      payload: {
        startDate: testDate,
        endDate: testDate,
        station: station,
        limit: 500,
        offset: 0,
        dateFilter: true // Try additional parameter
      },
      description: 'All devices with dateFilter parameter'
    },
    {
      endpoint: `${PHONECHECK_CONFIG.baseUrl}/v2/master/all-devices`,
      method: 'POST',
      payload: {
        startDate: testDate,
        endDate: testDate,
        station: station,
        limit: 500,
        offset: 0,
        strictDateFilter: true // Try strict date filtering
      },
      description: 'All devices with strictDateFilter parameter'
    },
    {
      endpoint: `${PHONECHECK_CONFIG.baseUrl}/v2/master/all-devices`,
      method: 'POST',
      payload: {
        startDate: testDate,
        endDate: testDate,
        station: station,
        limit: 500,
        offset: 0,
        createdDate: testDate // Try different date parameter
      },
      description: 'All devices with createdDate parameter'
    }
  ];
  
  const results = [];
  
  for (const test of tests) {
    console.log(`\n${'='.repeat(60)}`);
    const result = await testEndpoint(test.endpoint, test.method, test.payload, test.description);
    results.push({ ...test, result });
    
    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY OF ALTERNATIVE ENDPOINT TESTS`);
  console.log(`${'='.repeat(60)}`);
  
  results.forEach((test, index) => {
    const status = test.result.success ? '✅' : '❌';
    console.log(`${status} Test ${index + 1}: ${test.description}`);
    if (test.result.success && test.result.data && test.result.data.devices) {
      console.log(`   - Devices: ${test.result.data.devices.length}`);
    }
  });
  
  return results;
}

// Run the test
async function main() {
  console.log('🚀 Starting alternative endpoint tests...');
  
  try {
    const results = await testAlternativeEndpoints();
    console.log('\n🎉 Alternative endpoint tests completed!');
  } catch (error) {
    console.log('\n💥 Test failed:', error.message);
  }
}

// Run if this file is executed directly
if (typeof window === 'undefined') {
  main();
}

module.exports = { testAlternativeEndpoints };
