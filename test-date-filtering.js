// Test to verify if date filtering is working properly
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

async function testDateFiltering(station, testDate) {
  try {
    const token = await getAuthToken();
    
    const endpoint = `${PHONECHECK_CONFIG.baseUrl}/v2/master/all-devices`;
    
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
        console.log(`📊 Total devices: ${data.numberOfDevices}`);
        console.log(`📊 Devices array length: ${data.devices.length}`);
        
        // Check the actual dates of the returned devices
        const deviceDates = [];
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        
        data.devices.forEach((device, index) => {
          const deviceDate = device.createdAt ? new Date(device.createdAt).toISOString().split('T')[0] : 'Unknown';
          deviceDates.push(deviceDate);
          
          if (index < 5) { // Show first 5 devices
            console.log(`  Device ${index + 1}: Created ${deviceDate} (Requested: ${testDate})`);
          }
        });
        
        // Count devices by date
        const dateCounts = {};
        deviceDates.forEach(date => {
          dateCounts[date] = (dateCounts[date] || 0) + 1;
        });
        
        console.log(`\n📅 Device creation dates:`);
        Object.entries(dateCounts).forEach(([date, count]) => {
          const isToday = date === today;
          const isRequested = date === testDate;
          let status = '';
          if (isToday && isRequested) status = '✅ (Today & Requested)';
          else if (isToday) status = '⚠️ (Today, not requested)';
          else if (isRequested) status = '✅ (Requested date)';
          else status = '❌ (Different date)';
          
          console.log(`  ${date}: ${count} devices ${status}`);
        });
        
        // Check if date filtering is working
        const requestedDateCount = dateCounts[testDate] || 0;
        const todayCount = dateCounts[today] || 0;
        const totalDevices = data.devices.length;
        
        console.log(`\n🔍 Date Filtering Analysis:`);
        console.log(`- Requested date (${testDate}): ${requestedDateCount} devices`);
        console.log(`- Today (${today}): ${todayCount} devices`);
        console.log(`- Total devices: ${totalDevices}`);
        
        if (requestedDateCount === totalDevices) {
          console.log(`✅ Date filtering is working correctly!`);
        } else if (todayCount === totalDevices) {
          console.log(`❌ Date filtering is NOT working - returning only today's devices`);
        } else {
          console.log(`⚠️ Date filtering is partially working - mixed dates returned`);
        }
        
        return {
          station,
          requestedDate: testDate,
          totalDevices,
          requestedDateCount,
          todayCount,
          dateCounts
        };
      }
    }
    
    return { station, requestedDate: testDate, error: 'Failed to get data' };
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { station, requestedDate: testDate, error: error.message };
  }
}

async function testMultipleDates() {
  console.log('🚀 Testing date filtering with different dates...');
  
  const station = 'dncltz2'; // Using the station with 21 devices
  const testDates = [
    '2025-08-15', // August 15, 2025
    '2025-08-16', // August 16, 2025
    '2025-08-17', // August 17, 2025
    '2025-08-18', // August 18, 2025 (today)
    '2025-08-10', // August 10, 2025 (older date)
    '2025-08-20', // August 20, 2025 (future date)
  ];
  
  const results = [];
  
  for (const testDate of testDates) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TESTING DATE: ${testDate}`);
    console.log(`${'='.repeat(60)}`);
    
    const result = await testDateFiltering(station, testDate);
    results.push(result);
    
    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY OF DATE FILTERING TESTS`);
  console.log(`${'='.repeat(60)}`);
  
  results.forEach(result => {
    if (result.error) {
      console.log(`❌ ${result.requestedDate}: ${result.error}`);
    } else {
      const status = result.requestedDateCount === result.totalDevices ? '✅' : '❌';
      console.log(`${status} ${result.requestedDate}: ${result.requestedDateCount}/${result.totalDevices} devices match requested date`);
    }
  });
  
  return results;
}

// Run the test
async function main() {
  console.log('🚀 Starting date filtering analysis...');
  
  try {
    const results = await testMultipleDates();
    console.log('\n🎉 Date filtering analysis completed!');
  } catch (error) {
    console.log('\n💥 Test failed:', error.message);
  }
}

// Run if this file is executed directly
if (typeof window === 'undefined') {
  main();
}

module.exports = { testDateFiltering, testMultipleDates };
