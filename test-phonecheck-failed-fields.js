// Use global fetch (available in Node.js 18+)
require('dotenv').config();

async function testPhonecheckFailedFields() {
  try {
    console.log('🔍 Testing Phonecheck API Failed/Custom1 Field Mapping');
    
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
    
    console.log('\n📊 Raw Phonecheck API Response (Failed/Custom1 related fields):');
    
    // Handle array response from Phonecheck API
    const device = Array.isArray(deviceData) ? deviceData[0] : deviceData;
    
    console.log('\n🔍 Failed/Custom1 related fields found:');
    console.log('  All device fields:');
    Object.keys(device).forEach(key => {
      if (key.toLowerCase().includes('fail') || 
          key.toLowerCase().includes('custom') || 
          key.toLowerCase().includes('defect') ||
          key.toLowerCase().includes('note')) {
        console.log(`    ${key}: "${device[key]}"`);
      }
    });
    
    console.log('\n📱 Specific Failed/Custom1 fields:');
    const failedFields = Object.keys(device).filter(key => 
      key.toLowerCase().includes('fail') || 
      key.toLowerCase().includes('custom') || 
      key.toLowerCase().includes('defect') ||
      key.toLowerCase().includes('note')
    );
    
    if (failedFields.length === 0) {
      console.log('  No failed/custom1 related fields found in API response');
    } else {
      failedFields.forEach(field => {
        console.log(`    ${field}: "${device[field]}"`);
      });
    }
    
    console.log('\n🧪 Testing our current field mapping:');
    const mappedData = {
      defects: device.Failed || device.failed || device.defects || null,
      custom1: device.Custom1 || device.custom1 || null,
      notes: device.Notes || device.notes || null,
    };
    
    console.log('  Current mapping results:');
    console.log(`    defects: "${mappedData.defects}"`);
    console.log(`    custom1: "${mappedData.custom1}"`);
    console.log(`    notes: "${mappedData.notes}"`);
    
    // Test alternative field names that might exist
    console.log('\n🔍 Testing alternative field names:');
    const alternativeFields = [
      'Failed', 'failed', 'Fail', 'fail', 'Failure', 'failure',
      'Custom1', 'custom1', 'Custom', 'custom', 'CustomField', 'customField',
      'Defects', 'defects', 'Defect', 'defect', 'Issues', 'issues',
      'Notes', 'notes', 'Note', 'note', 'Comments', 'comments'
    ];
    
    alternativeFields.forEach(field => {
      if (device[field] !== undefined) {
        console.log(`    ${field}: "${device[field]}"`);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testPhonecheckFailedFields();
