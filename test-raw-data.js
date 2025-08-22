// Test to show raw data from Phonecheck API and check filtering
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

async function showRawData(station = 'dncltz8', date = '2025-08-15') {
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
            console.log(`📊 Total number of devices: ${data.numberOfDevices}`);
          }
          
          if (data.devices && Array.isArray(data.devices)) {
            console.log(`📊 Devices array length: ${data.devices.length}`);
            
            // Show first 3 devices in detail
            console.log('\n📱 === FIRST 3 DEVICES (RAW DATA) ===');
            for (let i = 0; i < Math.min(3, data.devices.length); i++) {
              const device = data.devices[i];
              console.log(`\n--- Device ${i + 1} ---`);
              console.log('All device keys:', Object.keys(device));
              
              // Check for IMEI fields
              const imeiFields = ['IMEI', 'imei', 'DeviceIMEI', 'deviceImei'];
              const foundImei = imeiFields.find(field => device[field]);
              
              if (foundImei) {
                console.log(`✅ Found IMEI in field "${foundImei}": ${device[foundImei]}`);
              } else {
                console.log(`❌ No IMEI found in any of these fields:`, imeiFields);
              }
              
              // Show key device info
              console.log('Key device info:');
              console.log('- Make:', device.make || device.Make || 'N/A');
              console.log('- Model:', device.model || device.Model || 'N/A');
              console.log('- Serial:', device.serial || device.Serial || 'N/A');
              console.log('- Created:', device.createdAt || device.DeviceCreatedDate || 'N/A');
              console.log('- Station ID:', device.stationId || device.StationID || 'N/A');
            }
            
            // Check IMEI filtering
            console.log('\n🔍 === IMEI FILTERING ANALYSIS ===');
            const imeiFields = ['IMEI', 'imei', 'DeviceIMEI', 'deviceImei'];
            let devicesWithImei = 0;
            let devicesWithoutImei = 0;
            
            data.devices.forEach((device, index) => {
              const foundImei = imeiFields.find(field => device[field]);
              if (foundImei) {
                devicesWithImei++;
              } else {
                devicesWithoutImei++;
                if (devicesWithoutImei <= 5) { // Show first 5 devices without IMEI
                  console.log(`❌ Device ${index + 1} has no IMEI:`, {
                    make: device.make || device.Make,
                    model: device.model || device.Model,
                    serial: device.serial || device.Serial,
                    availableFields: Object.keys(device).filter(key => 
                      key.toLowerCase().includes('imei') || 
                      key.toLowerCase().includes('serial') ||
                      key.toLowerCase().includes('id')
                    )
                  });
                }
              }
            });
            
            console.log(`\n📊 IMEI Summary:`);
            console.log(`- Devices with IMEI: ${devicesWithImei}`);
            console.log(`- Devices without IMEI: ${devicesWithoutImei}`);
            console.log(`- Total devices: ${data.devices.length}`);
            
            // Show sample of devices with IMEI
            if (devicesWithImei > 0) {
              console.log('\n✅ === SAMPLE DEVICES WITH IMEI ===');
              let shown = 0;
              data.devices.forEach((device, index) => {
                if (shown < 3) {
                  const foundImei = imeiFields.find(field => device[field]);
                  if (foundImei) {
                    console.log(`Device ${index + 1}: ${device[foundImei]} (${device.make || device.Make} ${device.model || device.Model})`);
                    shown++;
                  }
                }
              });
            }
            
            return { 
              station, 
              date, 
              success: true, 
              totalDevices: data.numberOfDevices,
              devicesWithImei,
              devicesWithoutImei,
              sampleDevices: data.devices.slice(0, 3)
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

// Test different scenarios
async function testMultipleScenarios() {
  console.log('🚀 Testing raw data with different scenarios...');
  
  const testCases = [
    { station: 'dncltz8', date: '2025-08-15' },
    { station: 'dncltz8', date: '2025-08-18' }, // Today
    { station: 'dncltz9', date: '2025-08-15' },
    { station: 'dncltz9', date: '2025-08-18' },
  ];
  
  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TESTING: ${testCase.station} - ${testCase.date}`);
    console.log(`${'='.repeat(60)}`);
    
    const result = await showRawData(testCase.station, testCase.date);
    
    if (result.success && result.devicesWithImei !== undefined) {
      console.log(`\n📋 RESULT SUMMARY:`);
      console.log(`- Station: ${result.station}`);
      console.log(`- Date: ${result.date}`);
      console.log(`- Total devices: ${result.totalDevices}`);
      console.log(`- With IMEI: ${result.devicesWithImei}`);
      console.log(`- Without IMEI: ${result.devicesWithoutImei}`);
    }
    
    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Run the test
async function main() {
  console.log('🚀 Starting raw data analysis...');
  
  try {
    await testMultipleScenarios();
    console.log('\n🎉 Raw data analysis completed!');
  } catch (error) {
    console.log('\n💥 Test failed:', error.message);
  }
}

// Run if this file is executed directly
if (typeof window === 'undefined') {
  main();
}

module.exports = { showRawData, testMultipleScenarios };
