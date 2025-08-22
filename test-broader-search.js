// Test broader search for devices
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

async function testBroaderSearch() {
  try {
    const token = await getAuthToken();
    console.log(`🔑 Token received: ${token.substring(0, 20)}...`);
    
    const endpoint = `${PHONECHECK_CONFIG.baseUrl}/v2/master/all-devices`;
    
    // Try very broad date ranges to find any devices
    const broadSearches = [
      {
        name: 'All of 2024',
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          station: 'dncltechzoneinc',
          limit: 500,
          offset: 0
        }
      },
      {
        name: 'Last 2 years',
        payload: {
          startDate: '2023-01-01',
          endDate: '2024-12-31',
          station: 'dncltechzoneinc',
          limit: 500,
          offset: 0
        }
      },
      {
        name: 'Last 5 years',
        payload: {
          startDate: '2020-01-01',
          endDate: '2024-12-31',
          station: 'dncltechzoneinc',
          limit: 500,
          offset: 0
        }
      },
      {
        name: 'All time (very broad)',
        payload: {
          startDate: '2010-01-01',
          endDate: '2024-12-31',
          station: 'dncltechzoneinc',
          limit: 500,
          offset: 0
        }
      },
      {
        name: 'Without station filter',
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          limit: 500,
          offset: 0
        }
      }
    ];
    
    for (const search of broadSearches) {
      console.log(`\n🔍 Testing: ${search.name}`);
      console.log(`📤 Payload:`, JSON.stringify(search.payload, null, 2));

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'token_master': token 
        },
        body: JSON.stringify(search.payload)
      });

      console.log(`📥 Status: ${response.status}`);
      
      if (response.ok) {
        const responseText = await response.text();
        console.log(`📄 Response length: ${responseText.length} characters`);
        
        try {
          const data = JSON.parse(responseText);
          console.log(`✅ Response parsed successfully`);
          console.log(`📊 Response type: ${typeof data}`);
          
          if (data && typeof data === 'object') {
            console.log(`📊 Object keys:`, Object.keys(data));
            
            if (data.numberOfDevices !== undefined) {
              console.log(`📊 Number of devices: ${data.numberOfDevices}`);
            }
            
            if (data.devices && Array.isArray(data.devices)) {
              console.log(`📊 Devices array length: ${data.devices.length}`);
              if (data.devices.length > 0) {
                console.log(`🎉 FOUND DEVICES!`);
                console.log(`📱 Sample device:`, data.devices[0]);
                console.log(`📱 Device keys:`, Object.keys(data.devices[0]));
                return { search: search.name, data };
              }
            }
          }
        } catch (parseError) {
          console.log(`❌ Failed to parse JSON: ${parseError.message}`);
          console.log(`📄 Raw response: ${responseText.substring(0, 500)}`);
        }
      } else {
        const errorText = await response.text();
        console.log(`❌ Request failed: ${errorText}`);
      }
      
      // Wait between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n❌ No devices found in any broad search');
    return null;
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return null;
  }
}

// Run the test
async function main() {
  console.log('🚀 Starting broader search for devices...');
  
  try {
    const result = await testBroaderSearch();
    if (result) {
      console.log('\n🎉 Found devices!');
      console.log('📋 Summary:', result);
    } else {
      console.log('\n💥 No devices found in any search');
    }
    return result;
  } catch (error) {
    console.log('\n💥 Test failed:', error.message);
  }
}

// Run if this file is executed directly
if (typeof window === 'undefined') {
  main();
}

module.exports = { testBroaderSearch };
