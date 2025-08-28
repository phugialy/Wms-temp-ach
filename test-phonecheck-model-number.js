// Use global fetch (available in Node.js 18+)
require('dotenv').config();

async function testPhonecheckModelNumber() {
  try {
    console.log('🔍 Testing Phonecheck API Model Number Field Mapping');
    
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
    
    console.log('\n🔍 Model-related fields found:');
    console.log('  All device fields:');
    Object.keys(deviceData).forEach(key => {
      console.log(`    ${key}: "${deviceData[key]}"`);
    });
    
    console.log('\n📱 Model-related fields found:');
    const modelFields = Object.keys(deviceData).filter(key => 
      key.toLowerCase().includes('model') || 
      key.toLowerCase().includes('number') ||
      key.toLowerCase().includes('code') ||
      key.toLowerCase().includes('identifier')
    );
    
    if (modelFields.length === 0) {
      console.log('  No model-related fields found in API response');
    } else {
      modelFields.forEach(field => {
        console.log(`    ${field}: "${deviceData[field]}"`);
      });
    }
    
    console.log('\n🧪 Testing our current field mapping:');
    const mappedData = {
      model: deviceData.Model || deviceData.model || null,
      model_number: deviceData.ModelNumber || deviceData.modelNumber || deviceData['Model#'] || deviceData['model#'] || null,
    };
    
    console.log('  Current mapping results:');
    console.log(`    model: "${mappedData.model}"`);
    console.log(`    model_number: "${mappedData.model_number}"`);
    
    // Test alternative field names that might exist
    console.log('\n🔍 Testing alternative field names:');
    const alternativeFields = [
      'ModelNumber', 'modelNumber', 'Model_Number', 'model_number',
      'Model#', 'model#', 'ModelCode', 'modelCode', 'Model_Code', 'model_code',
      'DeviceNumber', 'deviceNumber', 'Device_Number', 'device_number',
      'ProductNumber', 'productNumber', 'Product_Number', 'product_number',
      'SerialNumber', 'serialNumber', 'Serial_Number', 'serial_number',
      'PartNumber', 'partNumber', 'Part_Number', 'part_number'
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

testPhonecheckModelNumber();
