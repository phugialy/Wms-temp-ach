// Test to check what the bulk processing endpoint returns
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

async function testBulkProcessing() {
  try {
    const token = await getAuthToken();
    
    const endpoint = `${PHONECHECK_CONFIG.baseUrl}/v2/master/all-devices`;
    const station = 'dncltz8';
    const startDate = '2025-08-15';
    const endDate = '2025-08-15';
    
    console.log(`\n🏢 Testing bulk processing for station: ${station}`);
    console.log(`📅 Date: ${startDate}`);
    
    // Step 1: Pull devices
    const pullPayload = {
      date: startDate,
      station: station,
      limit: 500,
      offset: 0
    };
    
    console.log(`📤 Pulling devices with payload:`, JSON.stringify(pullPayload, null, 2));
    
    const pullResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'token_master': token 
      },
      body: JSON.stringify(pullPayload)
    });
    
    console.log(`📥 Pull response status: ${pullResponse.status}`);
    
    if (pullResponse.ok) {
      const pullData = await pullResponse.json();
      console.log(`📊 Pulled ${pullData.devices?.length || 0} devices`);
      
      if (pullData.devices && pullData.devices.length > 0) {
        // Step 2: Test device details for first few devices
        console.log(`\n🔍 Testing device details for first 3 devices:`);
        
        for (let i = 0; i < Math.min(3, pullData.devices.length); i++) {
          const device = pullData.devices[i];
          const imei = device.IMEI || device.imei;
          
          if (imei) {
            console.log(`\n📱 Testing IMEI: ${imei}`);
            
            try {
              const detailsResponse = await fetch(`${PHONECHECK_CONFIG.baseUrl}/v2/master/imei/device-info-legacy/${imei}?detailed=true`, {
                method: 'GET',
                headers: { 'token_master': token }
              });
              
              console.log(`📥 Details response status: ${detailsResponse.status}`);
              
              if (detailsResponse.ok) {
                const detailsData = await detailsResponse.json();
                console.log(`✅ Device details retrieved successfully`);
                console.log(`📊 Device info:`, {
                  model: detailsData.Model || 'N/A',
                  make: detailsData.Make || 'N/A',
                  memory: detailsData.Memory || 'N/A',
                  color: detailsData.Color || 'N/A',
                  grade: detailsData.Grade || 'N/A'
                });
              } else {
                const errorText = await detailsResponse.text();
                console.log(`❌ Device details failed: ${errorText}`);
              }
            } catch (error) {
              console.log(`❌ Device details error: ${error.message}`);
            }
            
            // Wait between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    } else {
      const errorText = await pullResponse.text();
      console.log(`❌ Pull failed: ${errorText}`);
    }
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
  }
}

// Run the test
async function main() {
  console.log('🚀 Testing bulk processing response...');
  
  try {
    await testBulkProcessing();
    console.log('\n🎉 Test completed!');
  } catch (error) {
    console.log('\n💥 Test failed:', error.message);
  }
}

// Run if this file is executed directly
if (typeof window === 'undefined') {
  main();
}

module.exports = { testBulkProcessing };
