// Test to verify correct API usage according to Phonecheck API docs
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

async function testApiUsage(method, payload, description) {
  try {
    const token = await getAuthToken();
    
    const endpoint = `${PHONECHECK_CONFIG.baseUrl}/v2/master/all-devices`;
    
    console.log(`\n🔍 Testing: ${description}`);
    console.log(`📡 Method: ${method}`);
    console.log(`📤 Payload:`, JSON.stringify(payload, null, 2));

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
      const data = JSON.parse(responseText);
      
      console.log(`✅ Response parsed successfully`);
      console.log(`📊 Response keys:`, Object.keys(data));
      
      if (data.numberOfDevices !== undefined) {
        console.log(`📊 Number of devices: ${data.numberOfDevices}`);
      }
      
      if (data.devices && Array.isArray(data.devices)) {
        console.log(`📊 Devices array length: ${data.devices.length}`);
        
        // Check device dates if we have devices
        if (data.devices.length > 0) {
          const deviceDates = data.devices.map(device => 
            device.createdAt ? new Date(device.createdAt).toISOString().split('T')[0] : 'Unknown'
          );
          
          const dateCounts = {};
          deviceDates.forEach(date => {
            dateCounts[date] = (dateCounts[date] || 0) + 1;
          });
          
          console.log(`📅 Device creation dates:`);
          Object.entries(dateCounts).forEach(([date, count]) => {
            console.log(`  ${date}: ${count} devices`);
          });
        }
      }
      
      return { success: true, data };
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

async function testCorrectApiUsage() {
  console.log('🚀 Testing correct API usage according to Phonecheck docs...');
  
  const station = 'dncltz2';
  const testDate = '2025-08-15';
  
  const tests = [
    // Test 1: Single date filter (date parameter)
    {
      method: 'POST',
      payload: {
        date: testDate,  // Single date filter
        station: station,
        limit: 500,
        offset: 0
      },
      description: 'Single date filter using "date" parameter'
    },
    
    // Test 2: Date range filter (startDate/endDate parameters)
    {
      method: 'POST',
      payload: {
        startDate: testDate,  // Start date
        endDate: testDate,    // End date (same as start for single day)
        station: station,
        limit: 500,
        offset: 0
      },
      description: 'Date range filter using "startDate/endDate" parameters'
    },
    
    // Test 3: Today's data (empty date parameter)
    {
      method: 'POST',
      payload: {
        date: '',  // Empty date = today's data
        station: station,
        limit: 500,
        offset: 0
      },
      description: 'Today\'s data using empty "date" parameter'
    },
    
    // Test 4: Date range for multiple days
    {
      method: 'POST',
      payload: {
        startDate: '2025-08-15',  // Start date
        endDate: '2025-08-18',    // End date (4 days)
        station: station,
        limit: 500,
        offset: 0
      },
      description: 'Date range filter for multiple days'
    },
    
    // Test 5: No date filter (should return all devices)
    {
      method: 'POST',
      payload: {
        station: station,
        limit: 500,
        offset: 0
      },
      description: 'No date filter (all devices)'
    }
  ];
  
  const results = [];
  
  for (const test of tests) {
    console.log(`\n${'='.repeat(60)}`);
    const result = await testApiUsage(test.method, test.payload, test.description);
    results.push({ ...test, result });
    
    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY OF API USAGE TESTS`);
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
  console.log('🚀 Starting correct API usage tests...');
  
  try {
    const results = await testCorrectApiUsage();
    console.log('\n🎉 API usage tests completed!');
  } catch (error) {
    console.log('\n💥 Test failed:', error.message);
  }
}

// Run if this file is executed directly
if (typeof window === 'undefined') {
  main();
}

module.exports = { testCorrectApiUsage };
