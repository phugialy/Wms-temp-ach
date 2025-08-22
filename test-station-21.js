// Test to find station with exactly 21 devices
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
    
    const endpoint = `${PHONECHECK_CONFIG.baseUrl}/v2/master/all-devices`;
    
    const payload = {
      startDate: date,
      endDate: date,
      station: station,
      limit: 500,
      offset: 0
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'token_master': token 
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const responseText = await response.text();
      const data = JSON.parse(responseText);
      
      if (data && data.numberOfDevices !== undefined) {
        return {
          station,
          date,
          totalDevices: data.numberOfDevices,
          devicesWithImei: data.devices ? data.devices.filter(d => d.imei || d.IMEI).length : 0,
          devicesWithoutImei: data.devices ? data.devices.filter(d => !d.imei && !d.IMEI).length : 0
        };
      }
    }
    
    return { station, date, error: 'Failed to get data' };
  } catch (error) {
    return { station, date, error: error.message };
  }
}

async function findStationWith21Devices() {
  console.log('🔍 Searching for station with exactly 21 devices...');
  
  // Test various station names
  const stationNames = [
    'dncltechzoneinc',
    'DNCL',
    'dncl',
    'techzone',
    'main',
    'MAIN',
    'test',
    'TEST',
    'dncltz8',
    'dncltz9',
    'dncltz1',
    'dncltz2',
    'dncltz3',
    'dncltz4',
    'dncltz5',
    'dncltz6',
    'dncltz7',
    'dncltz10',
    'dncltz11',
    'dncltz12',
    'station1',
    'station2',
    'station3',
    'port1',
    'port2',
    'port3',
    'port4',
    'port5',
    'port6',
    'port7',
    'port8',
    'port9',
    'port10'
  ];
  
  const date = '2025-08-18'; // Today
  
  for (const station of stationNames) {
    console.log(`Testing station: ${station}`);
    const result = await testStation(station, date);
    
    if (result.totalDevices === 21) {
      console.log(`🎯 FOUND! Station "${station}" has exactly 21 devices!`);
      console.log('Result:', result);
      
      // Get detailed info for this station
      const detailedResult = await testStation(station, date);
      console.log('Detailed result:', detailedResult);
      
      return result;
    } else if (result.totalDevices) {
      console.log(`  - ${station}: ${result.totalDevices} devices`);
    }
    
    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('❌ No station found with exactly 21 devices');
  return null;
}

// Run the test
async function main() {
  console.log('🚀 Starting search for station with 21 devices...');
  
  try {
    const result = await findStationWith21Devices();
    if (result) {
      console.log('\n🎉 Found the station!');
    } else {
      console.log('\n💥 No station with exactly 21 devices found');
    }
  } catch (error) {
    console.log('\n💥 Test failed:', error.message);
  }
}

// Run if this file is executed directly
if (typeof window === 'undefined') {
  main();
}

module.exports = { findStationWith21Devices };
