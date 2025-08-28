// Use global fetch (available in Node.js 18+)
require('dotenv').config();

async function testPhonecheckBattery() {
  try {
    console.log('🔍 Testing Phonecheck API Battery Field Mapping');
    
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

    // Test with a known IMEI from our database
    const testImei = '356254950619158';
    console.log(`📞 Testing IMEI: ${testImei}`);

    // Get device details
    const deviceResponse = await fetch(`https://api.phonecheck.com/v2/master/imei/device-info-legacy/${testImei}?detailed=true`, {
      method: 'GET',
      headers: { 'token_master': token }
    });

    if (!deviceResponse.ok) {
      throw new Error(`Device lookup failed: ${deviceResponse.status}`);
    }

    const deviceData = await deviceResponse.json();
    
    console.log('\n📊 Raw Phonecheck API Response:');
    console.log(JSON.stringify(deviceData, null, 2));
    
    console.log('\n🔍 Battery Field Analysis:');
    console.log('  All device fields:');
    Object.keys(deviceData).forEach(key => {
      console.log(`    ${key}: "${deviceData[key]}"`);
    });
    
    console.log('\n🔋 Battery-related fields found:');
    const batteryFields = Object.keys(deviceData).filter(key => 
      key.toLowerCase().includes('battery') || 
      key.toLowerCase().includes('cycle') || 
      key.toLowerCase().includes('health') ||
      key.toLowerCase().includes('percentage')
    );
    
    if (batteryFields.length === 0) {
      console.log('  No battery-related fields found in API response');
    } else {
      batteryFields.forEach(field => {
        console.log(`    ${field}: "${deviceData[field]}"`);
      });
    }
    
    console.log('\n🧪 Testing our current field mapping:');
    const mappedData = {
      battery_health: deviceData.BatteryHealthPercentage || deviceData.batteryHealth || null,
      battery_count: deviceData.BatteryCycle || deviceData.batteryCycle || null,
    };
    
    console.log('  Current mapping results:');
    console.log(`    battery_health: "${mappedData.battery_health}"`);
    console.log(`    battery_count: "${mappedData.battery_count}"`);
    
    // Test alternative field names that might exist
    console.log('\n🔍 Testing alternative field names:');
    const alternativeFields = [
      'BatteryHealth', 'batteryHealth', 'Battery_Health', 'battery_health',
      'BatteryCycle', 'batteryCycle', 'Battery_Cycle', 'battery_cycle',
      'BatteryCount', 'batteryCount', 'Battery_Count', 'battery_count',
      'CycleCount', 'cycleCount', 'Cycle_Count', 'cycle_count',
      'HealthPercentage', 'healthPercentage', 'Health_Percentage', 'health_percentage'
    ];
    
    alternativeFields.forEach(field => {
      if (deviceData[field] !== undefined) {
        console.log(`    ${field}: "${deviceData[field]}"`);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testPhonecheckBattery();
