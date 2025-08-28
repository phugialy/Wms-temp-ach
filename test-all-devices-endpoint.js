// Use global fetch (available in Node.js 18+)
require('dotenv').config();

async function testAllDevicesEndpoint() {
  try {
    console.log('🔍 Testing Phonecheck API All-Devices Endpoint');
    
    // Get authentication token
    const authResponse = await fetch('https://api.phonecheck.com/v2/auth/master/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: process.env.PHONECHECK_USERNAME || 'dncltechzoneinc',
        password: process.env.PHONECHECK_PASSWORD || '@Ustvmos817'
      })
    });

    if (!authResponse.ok) {
      throw new Error(`Authentication failed: ${authResponse.status}`);
    }

    const authData = await authResponse.json();
    const token = authData.token;
    console.log('✅ Authentication successful');

    // Test the all-devices endpoint
    console.log('📞 Testing all-devices endpoint for 08/27/2025, station dncltz8');

    const response = await fetch('https://api.phonecheck.com/v2/master/all-devices', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'token_master': token 
      },
      body: JSON.stringify({
        date: '08/27/2025',
        station: 'dncltz8',
        limit: 3,
        offset: 0
      })
    });

    if (!response.ok) {
      throw new Error(`All-devices request failed: ${response.status}`);
    }

    const result = await response.json();
    
    console.log('\n📊 All-Devices Response Structure:');
    console.log('Response keys:', Object.keys(result));
    
    const devices = result.devices || result.data || [];
    console.log(`\n📱 Found ${devices.length} devices`);
    
    if (devices.length > 0) {
      console.log('\n🔍 First device structure:');
      const firstDevice = devices[0];
      console.log('Device keys:', Object.keys(firstDevice));
      
      console.log('\n🔋 Battery fields in first device:');
      const batteryFields = Object.keys(firstDevice).filter(key => 
        key.toLowerCase().includes('battery') || 
        key.toLowerCase().includes('cycle') || 
        key.toLowerCase().includes('health') ||
        key.toLowerCase().includes('percentage')
      );
      
      batteryFields.forEach(field => {
        console.log(`  ${field}: "${firstDevice[field]}"`);
      });
      
      console.log('\n🧪 Testing our current field mapping:');
      const mappedData = {
        battery_health: firstDevice.BatteryHealthPercentage || firstDevice.batteryHealth || null,
        battery_count: firstDevice.BatteryCycle || firstDevice.batteryCycle || null,
      };
      
      console.log('  Current mapping results:');
      console.log(`    battery_health: "${mappedData.battery_health}"`);
      console.log(`    battery_count: "${mappedData.battery_count}"`);
      
      console.log('\n📋 Sample device data:');
      console.log(`  IMEI: ${firstDevice.IMEI || firstDevice.imei}`);
      console.log(`  Model: ${firstDevice.Model || firstDevice.model}`);
      console.log(`  Make: ${firstDevice.Make || firstDevice.make}`);
      console.log(`  Working: ${firstDevice.Working || firstDevice.working}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testAllDevicesEndpoint();
