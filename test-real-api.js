// Test different station names and parameters to find real devices
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

async function testStation(station, date) {
  try {
    const token = await getAuthToken();
    console.log(`🔑 Token received: ${token.substring(0, 20)}...`);
    
    const endpoint = `${PHONECHECK_CONFIG.baseUrl}/v2/master/all-devices`;
    
    console.log(`\n🏢 Testing station: "${station}" with date: "${date}"`);
    
    const payload = {
      startDate: date,
      endDate: date,
      station: station,
      limit: 500,
      offset: 0
    };

    console.log(`📤 Payload:`, JSON.stringify(payload, null, 2));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'token_master': token 
      },
      body: JSON.stringify(payload)
    });

    console.log(`📥 Status: ${response.status}`);
    
    if (response.ok) {
      const responseText = await response.text();
      console.log(`📄 Response length: ${responseText.length} characters`);
      
      try {
        const data = JSON.parse(responseText);
        console.log(`✅ Response parsed successfully`);
        console.log(`📊 Response type: ${typeof data}`);
        console.log(`📊 Is array: ${Array.isArray(data)}`);
        
        if (data && typeof data === 'object') {
          console.log(`📊 Object keys:`, Object.keys(data));
          
          if (data.numberOfDevices !== undefined) {
            console.log(`📊 Number of devices: ${data.numberOfDevices}`);
          }
          
          if (data.devices && Array.isArray(data.devices)) {
            console.log(`📊 Devices array length: ${data.devices.length}`);
            if (data.devices.length > 0) {
              console.log(`📱 Sample device:`, data.devices[0]);
            }
          }
        }
        
        return { station, date, success: true, data };
      } catch (parseError) {
        console.log(`❌ Failed to parse JSON: ${parseError.message}`);
        console.log(`📄 Raw response: ${responseText.substring(0, 500)}`);
        return { station, date, success: false, error: 'JSON parse error' };
      }
    } else {
      const errorText = await response.text();
      console.log(`❌ Request failed: ${errorText}`);
      return { station, date, success: false, error: errorText };
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { station, date, success: false, error: error.message };
  }
}

async function testMultipleStations() {
  console.log('🚀 Testing multiple station names and dates...');
  
  const testCases = [
    // Try different station names
    { station: 'dncltechzoneinc', date: '2024-12-01' },
    { station: 'DNCL', date: '2024-12-01' },
    { station: 'dncl', date: '2024-12-01' },
    { station: 'techzone', date: '2024-12-01' },
    { station: 'main', date: '2024-12-01' },
    { station: 'MAIN', date: '2024-12-01' },
    { station: 'test', date: '2024-12-01' },
    { station: 'TEST', date: '2024-12-01' },
    
    // Try with different dates
    { station: 'dncltechzoneinc', date: '2024-01-01' },
    { station: 'dncltechzoneinc', date: '2024-06-01' },
    { station: 'dncltechzoneinc', date: '2024-11-01' },
    { station: 'dncltechzoneinc', date: '2023-12-01' },
    
    // Try with username as station
    { station: PHONECHECK_CONFIG.username, date: '2024-12-01' },
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    const result = await testStation(testCase.station, testCase.date);
    results.push(result);
    
    // If we found devices, stop testing
    if (result.success && result.data && 
        ((Array.isArray(result.data) && result.data.length > 0) || 
         (result.data.devices && result.data.devices.length > 0) ||
         (result.data.numberOfDevices && result.data.numberOfDevices > 0))) {
      console.log(`🎉 Found devices with station: ${testCase.station}, date: ${testCase.date}`);
      break;
    }
    
    // Wait a bit between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📋 Summary of results:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const deviceCount = result.success && result.data ? 
      (result.data.numberOfDevices || (result.data.devices ? result.data.devices.length : 0)) : 0;
    console.log(`${status} ${result.station} (${result.date}): ${deviceCount} devices`);
  });
  
  return results;
}

// Run the test
async function main() {
  console.log('🚀 Starting real Phonecheck API test...');
  
  try {
    const results = await testMultipleStations();
    console.log('\n🎉 Test completed!');
    return results;
  } catch (error) {
    console.log('\n💥 Test failed:', error.message);
  }
}

// Run if this file is executed directly
if (typeof window === 'undefined') {
  main();
}

module.exports = { testStation, testMultipleStations };
