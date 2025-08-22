// Test the exact scenario the user is experiencing
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

async function testExactScenario() {
  try {
    const token = await getAuthToken();
    console.log(`🔑 Token received: ${token.substring(0, 20)}...`);
    
    const endpoint = `${PHONECHECK_CONFIG.baseUrl}/v2/master/all-devices`;
    
    // Test with station dncltz2 (which has exactly 21 devices)
    const station = 'dncltz2';
    const date = '2025-08-18';
    
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
        
        if (data && data.numberOfDevices !== undefined) {
          console.log(`📊 Total devices reported: ${data.numberOfDevices}`);
          
          if (data.devices && Array.isArray(data.devices)) {
            console.log(`📊 Devices array length: ${data.devices.length}`);
            
            // Check IMEI filtering logic (same as in the service)
            const imeiFields = ['IMEI', 'imei', 'DeviceIMEI', 'deviceImei'];
            let devicesWithImei = 0;
            let devicesWithoutImei = 0;
            let devicesWithImeiDetails = [];
            let devicesWithoutImeiDetails = [];
            
            data.devices.forEach((device, index) => {
              const hasImei = imeiFields.some(field => device[field]);
              if (hasImei) {
                devicesWithImei++;
                if (devicesWithImeiDetails.length < 3) {
                  devicesWithImeiDetails.push({
                    index: index + 1,
                    imei: device.imei || device.IMEI || device.DeviceIMEI || device.deviceImei,
                    make: device.make || device.Make,
                    model: device.model || device.Model
                  });
                }
              } else {
                devicesWithoutImei++;
                if (devicesWithoutImeiDetails.length < 3) {
                  devicesWithoutImeiDetails.push({
                    index: index + 1,
                    make: device.make || device.Make,
                    model: device.model || device.Model,
                    availableFields: Object.keys(device).filter(key => 
                      key.toLowerCase().includes('imei') || 
                      key.toLowerCase().includes('serial') ||
                      key.toLowerCase().includes('id')
                    )
                  });
                }
              }
            });
            
            console.log(`\n🔍 === IMEI FILTERING ANALYSIS ===`);
            console.log(`- Total devices: ${data.devices.length}`);
            console.log(`- Devices with IMEI: ${devicesWithImei}`);
            console.log(`- Devices without IMEI: ${devicesWithoutImei}`);
            
            if (devicesWithImei > 0) {
              console.log(`\n✅ Sample devices WITH IMEI:`);
              devicesWithImeiDetails.forEach(device => {
                console.log(`  Device ${device.index}: ${device.imei} (${device.make} ${device.model})`);
              });
            }
            
            if (devicesWithoutImei > 0) {
              console.log(`\n❌ Sample devices WITHOUT IMEI:`);
              devicesWithoutImeiDetails.forEach(device => {
                console.log(`  Device ${device.index}: ${device.make} ${device.model}`);
                console.log(`    Available fields: ${device.availableFields.join(', ')}`);
              });
            }
            
                         // Simulate the service filtering
             const filteredDevices = data.devices.filter((device) => {
               return device.IMEI || device.imei || device.DeviceIMEI || device.deviceImei;
             });
            
            console.log(`\n🔧 === SERVICE FILTERING SIMULATION ===`);
            console.log(`- Original devices: ${data.devices.length}`);
            console.log(`- After IMEI filtering: ${filteredDevices.length}`);
            console.log(`- Filtered out: ${data.devices.length - filteredDevices.length}`);
            
            if (filteredDevices.length !== data.devices.length) {
              console.log(`⚠️  WARNING: Service filtering would remove ${data.devices.length - filteredDevices.length} devices!`);
            } else {
              console.log(`✅ All devices would pass the IMEI filter`);
            }
            
            return {
              station,
              date,
              totalDevices: data.numberOfDevices,
              devicesWithImei,
              devicesWithoutImei,
              filteredDevices: filteredDevices.length
            };
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

// Run the test
async function main() {
  console.log('🚀 Testing exact scenario with station dncltz2...');
  
  try {
    const result = await testExactScenario();
    console.log('\n📋 Final Result:', result);
  } catch (error) {
    console.log('\n💥 Test failed:', error.message);
  }
}

// Run if this file is executed directly
if (typeof window === 'undefined') {
  main();
}

module.exports = { testExactScenario };
