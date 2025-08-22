// Test the fixed Phonecheck service
const PHONECHECK_CONFIG = {
  username: 'dncltechzoneinc',
  password: '@Ustvmos817',
  baseUrl: 'https://api.phonecheck.com',
  clientApiUrl: 'https://clientapiv2.phonecheck.com',
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

async function testFixedEndpoints(station, date) {
  try {
    const token = await getAuthToken();
    console.log(`🔑 Token received: ${token.substring(0, 20)}...`);
    
    // Test the fixed endpoints from the updated service
    const endpoints = [
      {
        name: 'Client API v2 with form data',
        url: `${PHONECHECK_CONFIG.clientApiUrl}/cloud/CloudDB/v2/GetAllDevices`,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Apikey': token },
        body: new URLSearchParams({
          Username: station,
          Date: date,
          Limit: '500',
          Page: '1',
          TimeFrom: '00:00:00',
          TimeTo: '23:59:59'
        })
      },
      {
        name: 'Client API v1 with form data',
        url: `${PHONECHECK_CONFIG.clientApiUrl}/cloud/CloudDB/GetAllDevices`,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Apikey': token },
        body: new URLSearchParams({
          Username: station,
          Date: date,
          Limit: '500',
          Page: '1'
        })
      },
      {
        name: 'Master API with JSON',
        url: `${PHONECHECK_CONFIG.baseUrl}/v2/master/all-devices`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token_master': token },
        body: JSON.stringify({
          startDate: date,
          endDate: date,
          station: station,
          limit: 500,
          offset: 0
        })
      }
    ];

    for (const endpoint of endpoints) {
      console.log(`\n🌐 Testing: ${endpoint.name}`);
      console.log(`📤 URL: ${endpoint.url}`);
      
      try {
        const response = await fetch(endpoint.url, {
          method: endpoint.method,
          headers: endpoint.headers,
          body: endpoint.body
        });

        console.log(`📥 Status: ${response.status}`);
        
        if (response.ok) {
          const responseText = await response.text();
          
          // Try to parse as JSON
          let data;
          try {
            data = JSON.parse(responseText);
            console.log(`✅ SUCCESS! Response type: ${typeof data}`);
            
            if (Array.isArray(data)) {
              console.log(`📊 Found ${data.length} devices (array response)`);
              if (data.length > 0) {
                console.log(`📱 Sample device:`, data[0]);
              }
            } else if (data.devices && Array.isArray(data.devices)) {
              console.log(`📊 Found ${data.devices.length} devices (devices property)`);
              if (data.devices.length > 0) {
                console.log(`📱 Sample device:`, data.devices[0]);
              }
            } else if (data.data && Array.isArray(data.data)) {
              console.log(`📊 Found ${data.data.length} devices (data property)`);
              if (data.data.length > 0) {
                console.log(`📱 Sample device:`, data.data[0]);
              }
            } else {
              console.log(`📊 Response structure:`, Object.keys(data));
            }
            
            return { endpoint: endpoint.name, data };
          } catch (parseError) {
            console.log(`⚠️ Response is not JSON: ${responseText.substring(0, 200)}`);
          }
        } else {
          const errorText = await response.text();
          console.log(`❌ Failed: ${errorText}`);
        }
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }
    }
    
    throw new Error('All endpoints failed');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

// Test with different station names and dates
async function testMultipleScenarios() {
  console.log('\n🔍 Testing multiple scenarios...');
  
  const testScenarios = [
    { station: 'dncltechzoneinc', date: '2024-01-15' },
    { station: 'DNCL', date: '2024-01-15' },
    { station: 'test', date: '2024-01-15' },
    { station: 'dncltechzoneinc', date: '2024-12-01' }, // Recent date
    { station: 'dncltechzoneinc', date: '2024-11-01' }  // Another recent date
  ];
  
  for (const scenario of testScenarios) {
    console.log(`\n🏢 Testing station: "${scenario.station}" with date: "${scenario.date}"`);
    try {
      const result = await testFixedEndpoints(scenario.station, scenario.date);
      console.log(`🎉 Success with scenario: ${scenario.station} - ${scenario.date}`);
      return result;
    } catch (error) {
      console.log(`❌ Failed with scenario: ${scenario.station} - ${scenario.date}`);
    }
  }
  
  throw new Error('All scenarios failed');
}

// Run the test
async function main() {
  console.log('🚀 Starting fixed Phonecheck API test...');
  
  try {
    const result = await testMultipleScenarios();
    console.log('\n🎉 Test completed successfully!');
    console.log('📋 Summary:', result);
    return result;
  } catch (error) {
    console.log('\n💥 All tests failed:', error.message);
    console.log('\n💡 This is expected if the API endpoints are not working.');
    console.log('🔧 The service will fall back to mock data for development.');
  }
}

// Run if this file is executed directly
if (typeof window === 'undefined') {
  main();
}

module.exports = { testFixedEndpoints, getAuthToken };
