// Test to verify our client-side date filtering fix
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

// Simulate the exact filtering logic from our updated service
function applyClientSideDateFiltering(devices, startDate, endDate) {
  // First filter out devices without IMEI
  const devicesWithIMEI = devices.filter((device) => {
    return device.IMEI || device.imei || device.DeviceIMEI || device.deviceImei;
  });

  // Then apply client-side date filtering
  const dateFilteredDevices = devicesWithIMEI.filter((device) => {
    if (!device.createdAt) return false;
    
    const deviceDate = new Date(device.createdAt).toISOString().split('T')[0];
    
    // Check if device date is within the requested range
    return deviceDate && deviceDate >= startDate && deviceDate <= endDate;
  });

  return {
    totalDevices: devices.length,
    devicesWithIMEI: devicesWithIMEI.length,
    dateFilteredDevices: dateFilteredDevices.length,
    filteredDevices: dateFilteredDevices
  };
}

async function testDateFilteringFix() {
  try {
    const token = await getAuthToken();
    
    const endpoint = `${PHONECHECK_CONFIG.baseUrl}/v2/master/all-devices`;
    const station = 'dncltz2';
    const testDate = '2025-08-15';
    
    console.log(`\n🏢 Testing station: "${station}" with date: "${testDate}"`);
    
    const payload = {
      startDate: testDate,
      endDate: testDate,
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
      const data = JSON.parse(responseText);
      
      if (data && data.numberOfDevices !== undefined && data.devices && Array.isArray(data.devices)) {
        console.log(`📊 API returned: ${data.devices.length} devices`);
        
        // Apply our client-side filtering
        const filteringResult = applyClientSideDateFiltering(data.devices, testDate, testDate);
        
        console.log(`\n🔧 === CLIENT-SIDE FILTERING RESULTS ===`);
        console.log(`- Total devices from API: ${filteringResult.totalDevices}`);
        console.log(`- Devices with IMEI: ${filteringResult.devicesWithIMEI}`);
        console.log(`- Devices matching date ${testDate}: ${filteringResult.dateFilteredDevices}`);
        
        if (filteringResult.dateFilteredDevices > 0) {
          console.log(`\n✅ === FILTERED DEVICES (${testDate}) ===`);
          filteringResult.filteredDevices.forEach((device, index) => {
            const imei = device.imei || device.IMEI || device.DeviceIMEI || device.deviceImei;
            const make = device.make || device.Make;
            const model = device.model || device.Model;
            const createdAt = device.createdAt ? new Date(device.createdAt).toISOString().split('T')[0] : 'Unknown';
            
            console.log(`  ${index + 1}. ${imei} (${make} ${model}) - Created: ${createdAt}`);
          });
        } else {
          console.log(`\n❌ No devices found for date ${testDate}`);
        }
        
        // Test with a different date
        const differentDate = '2025-08-18';
        const differentDateResult = applyClientSideDateFiltering(data.devices, differentDate, differentDate);
        
        console.log(`\n🔧 === COMPARISON WITH DIFFERENT DATE ===`);
        console.log(`- Devices matching date ${differentDate}: ${differentDateResult.dateFilteredDevices}`);
        
        if (differentDateResult.dateFilteredDevices > 0) {
          console.log(`\n✅ === FILTERED DEVICES (${differentDate}) ===`);
          differentDateResult.filteredDevices.slice(0, 3).forEach((device, index) => {
            const imei = device.imei || device.IMEI || device.DeviceIMEI || device.deviceImei;
            const make = device.make || device.Make;
            const model = device.model || device.Model;
            const createdAt = device.createdAt ? new Date(device.createdAt).toISOString().split('T')[0] : 'Unknown';
            
            console.log(`  ${index + 1}. ${imei} (${make} ${model}) - Created: ${createdAt}`);
          });
        }
        
        return filteringResult;
      }
    }
    
    return { error: 'Failed to get data' };
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { error: error.message };
  }
}

// Run the test
async function main() {
  console.log('🚀 Testing client-side date filtering fix...');
  
  try {
    const result = await testDateFilteringFix();
    console.log('\n📋 Final Result:', result);
  } catch (error) {
    console.log('\n💥 Test failed:', error.message);
  }
}

// Run if this file is executed directly
if (typeof window === 'undefined') {
  main();
}

module.exports = { testDateFilteringFix, applyClientSideDateFiltering };
