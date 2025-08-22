// Test the updated Phonecheck service with correct API usage
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

// Simulate the updated service logic
async function testUpdatedServiceLogic() {
  try {
    const token = await getAuthToken();
    
    const endpoint = `${PHONECHECK_CONFIG.baseUrl}/v2/master/all-devices`;
    const station = 'dncltz2';
    const startDate = '2025-08-15';
    const endDate = '2025-08-15'; // Same as startDate = single date
    
    console.log(`\n🏢 Testing updated service logic`);
    console.log(`📡 Station: ${station}`);
    console.log(`📅 Start Date: ${startDate}`);
    console.log(`📅 End Date: ${endDate}`);
    
    // Determine filtering strategy
    const isSingleDate = !endDate || startDate === endDate;
    const isDateRange = endDate && startDate !== endDate;
    
    console.log(`🔍 Filtering Strategy:`);
    console.log(`- Single Date: ${isSingleDate}`);
    console.log(`- Date Range: ${isDateRange}`);
    
    let payload;
    
    if (isSingleDate) {
      // Use 'date' parameter for single date (works correctly)
      payload = {
        date: startDate,
        station: station,
        limit: 500,
        offset: 0
      };
      console.log(`📤 Using single date filter with 'date' parameter`);
    } else if (isDateRange) {
      // Use 'startDate/endDate' for date range (broken, but try anyway)
      payload = {
        startDate: startDate,
        endDate: endDate,
        station: station,
        limit: 500,
        offset: 0
      };
      console.log(`📤 Using date range filter with 'startDate/endDate' parameters`);
    } else {
      // No date specified - get today's data
      payload = {
        date: '',
        station: station,
        limit: 500,
        offset: 0
      };
      console.log(`📤 Using today's data (empty date parameter)`);
    }
    
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
        console.log(`📊 API Response:`);
        console.log(`- Total devices: ${data.numberOfDevices}`);
        console.log(`- Devices array length: ${data.devices.length}`);
        
        // Filter devices with IMEI
        const devicesWithIMEI = data.devices.filter((device) => {
          return device.IMEI || device.imei || device.DeviceIMEI || device.deviceImei;
        });
        
        console.log(`🔍 Filtering Results:`);
        console.log(`- Devices with IMEI: ${devicesWithIMEI.length}`);
        console.log(`- Devices without IMEI: ${data.devices.length - devicesWithIMEI.length}`);
        
        // Check device dates
        if (devicesWithIMEI.length > 0) {
          const deviceDates = devicesWithIMEI.map(device => 
            device.createdAt ? new Date(device.createdAt).toISOString().split('T')[0] : 'Unknown'
          );
          
          const dateCounts = {};
          deviceDates.forEach(date => {
            dateCounts[date] = (dateCounts[date] || 0) + 1;
          });
          
          console.log(`📅 Device creation dates:`);
          Object.entries(dateCounts).forEach(([date, count]) => {
            const isRequested = date === startDate;
            const status = isRequested ? '✅ (Requested)' : '❌ (Different)';
            console.log(`  ${date}: ${count} devices ${status}`);
          });
          
          // Check if date filtering worked
          const requestedDateCount = dateCounts[startDate] || 0;
          const totalDevices = devicesWithIMEI.length;
          
          console.log(`\n🎯 Date Filtering Analysis:`);
          console.log(`- Requested date (${startDate}): ${requestedDateCount} devices`);
          console.log(`- Total devices returned: ${totalDevices}`);
          
          if (requestedDateCount === totalDevices) {
            console.log(`✅ PERFECT! Date filtering is working correctly!`);
          } else if (requestedDateCount > 0) {
            console.log(`⚠️ PARTIAL: ${requestedDateCount}/${totalDevices} devices match requested date`);
          } else {
            console.log(`❌ FAILED: No devices match requested date`);
          }
        }
        
        return {
          success: true,
          totalDevices: data.devices.length,
          devicesWithIMEI: devicesWithIMEI.length,
          requestedDate: startDate,
          deviceDates: devicesWithIMEI.map(device => ({
            imei: device.imei || device.IMEI,
            createdAt: device.createdAt ? new Date(device.createdAt).toISOString().split('T')[0] : 'Unknown'
          }))
        };
      }
    }
    
    return { success: false, error: 'Failed to get data' };
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Run the test
async function main() {
  console.log('🚀 Testing updated Phonecheck service logic...');
  
  try {
    const result = await testUpdatedServiceLogic();
    console.log('\n📋 Final Result:', result);
    
    if (result.success) {
      console.log('\n🎉 Service logic test completed successfully!');
    } else {
      console.log('\n💥 Service logic test failed!');
    }
  } catch (error) {
    console.log('\n💥 Test failed:', error.message);
  }
}

// Run if this file is executed directly
if (typeof window === 'undefined') {
  main();
}

module.exports = { testUpdatedServiceLogic };
