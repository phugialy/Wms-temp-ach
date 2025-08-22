// Standalone test for Phonecheck API
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

async function testGetAllDevices(station, date) {
  try {
    const token = await getAuthToken();
    console.log(`🔑 Token received: ${token.substring(0, 20)}...`);
    
    // Test different endpoint variations
    const endpoints = [
      `${PHONECHECK_CONFIG.clientApiUrl}/cloud/CloudDB/v2/GetAllDevices`,
      `${PHONECHECK_CONFIG.clientApiUrl}/cloud/CloudDB/GetAllDevices`,
      `${PHONECHECK_CONFIG.clientApiUrl}/GetAllDevices`,
      `${PHONECHECK_CONFIG.baseUrl}/v2/master/devices/get-all`,
      `${PHONECHECK_CONFIG.baseUrl}/v2/master/station/devices`
    ];

    // Test different payload formats
    const testPayloads = [
      {
        name: 'Full JSON payload with all fields',
        headers: { 'Content-Type': 'application/json', 'Apikey': token },
        body: JSON.stringify({
          Username: station,
          UserName: station,
          Station: station,
          Date: date,
          Limit: 500,
          Page: 1,
          TimeFrom: '00:00:00',
          TimeTo: '23:59:59',
          IMEI: '',
          Serial: '',
          Make: '',
          Model: '',
          TesterName: '',
          Result: '',
          SortBy: '',
          Order: ''
        })
      },
      {
        name: 'Minimal required fields',
        headers: { 'Content-Type': 'application/json', 'Apikey': token },
        body: JSON.stringify({
          Username: station,
          Date: date
        })
      },
      {
        name: 'Form data with all fields',
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
        name: 'JSON with token_master header',
        headers: { 'Content-Type': 'application/json', 'token_master': token },
        body: JSON.stringify({
          Username: station,
          Date: date,
          Limit: 500,
          Page: 1
        })
      },
      {
        name: 'Raw form data string',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Apikey': token },
        body: `Username=${encodeURIComponent(station)}&Date=${encodeURIComponent(date)}&Limit=500&Page=1`
      }
    ];

    for (const endpoint of endpoints) {
      console.log(`\n🌐 Testing endpoint: ${endpoint}`);
      
      for (const payload of testPayloads) {
        console.log(`\n🧪 Testing: ${payload.name}`);
        console.log(`📤 Headers:`, Object.keys(payload.headers));
        console.log(`📦 Body type:`, typeof payload.body);
        
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: payload.headers,
            body: payload.body
          });

          console.log(`📥 Status: ${response.status}`);
          
          if (response.ok) {
            const data = await response.json();
            console.log(`✅ SUCCESS! Found ${Array.isArray(data) ? data.length : 'unknown'} devices`);
            console.log(`📊 Sample data:`, Array.isArray(data) && data.length > 0 ? data[0] : data);
            return { endpoint, payload: payload.name, data };
          } else {
            const errorText = await response.text();
            console.log(`❌ Failed: ${errorText}`);
          }
        } catch (error) {
          console.log(`❌ Error: ${error.message}`);
        }
      }
    }
    
    throw new Error('All endpoint and payload combinations failed');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

// Test with a real station name if available
async function testWithRealStation() {
  console.log('\n🔍 Testing with potential real station names...');
  
  const testStations = ['dncltechzoneinc', 'DNCL', 'TECHZONE', 'MAIN'];
  const testDate = '2024-01-15';
  
  for (const station of testStations) {
    console.log(`\n🏢 Testing station: ${station}`);
    try {
      const result = await testGetAllDevices(station, testDate);
      console.log(`🎉 Success with station: ${station}`);
      return result;
    } catch (error) {
      console.log(`❌ Failed with station: ${station}`);
    }
  }
}

// Run the test
async function main() {
  console.log('🚀 Starting comprehensive Phonecheck API test...');
  
  try {
    // First try with test data
    console.log('\n📅 Testing with station: "test" and date: "2024-01-15"');
    const result = await testGetAllDevices('test', '2024-01-15');
    console.log('\n🎉 Test completed successfully!');
    return result;
  } catch (error) {
    console.log('\n💥 Test failed, trying with real station names...');
    try {
      const result = await testWithRealStation();
      console.log('\n🎉 Test completed successfully with real station!');
      return result;
    } catch (finalError) {
      console.log('\n💥 All tests failed:', finalError.message);
    }
  }
}

// Run if this file is executed directly
if (typeof window === 'undefined') {
  main();
}

module.exports = { testGetAllDevices, getAuthToken };
