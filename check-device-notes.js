const { Client } = require('pg');
require('dotenv').config();

async function checkDeviceNotes() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    const testImei = '350237727628665';
    
    console.log(`\n🔍 Checking device notes for IMEI: ${testImei}`);
    
    // Check device_test table directly
    console.log('\n📋 Checking device_test table:');
    const deviceTestResult = await client.query(`
      SELECT imei, notes, defects, custom1
      FROM device_test 
      WHERE imei = $1
    `, [testImei]);
    
    if (deviceTestResult.rows.length > 0) {
      console.log('✅ Found in device_test table:');
      deviceTestResult.rows.forEach(row => {
        console.log(`   Notes: "${row.notes || 'NULL'}"`);
        console.log(`   Defects: "${row.defects || 'NULL'}"`);
        console.log(`   Custom1: "${row.custom1 || 'NULL'}"`);
      });
    } else {
      console.log('❌ Not found in device_test table');
    }
    
    // Check sku_matching_view
    console.log('\n📋 Checking sku_matching_view:');
    const viewResult = await client.query(`
      SELECT imei, brand, model, carrier, device_notes
      FROM sku_matching_view 
      WHERE imei = $1
    `, [testImei]);
    
    if (viewResult.rows.length > 0) {
      console.log('✅ Found in sku_matching_view:');
      viewResult.rows.forEach(row => {
        console.log(`   Brand: ${row.brand}`);
        console.log(`   Model: ${row.model}`);
        console.log(`   Carrier: ${row.carrier}`);
        console.log(`   Device Notes: "${row.device_notes || 'NULL'}"`);
      });
    } else {
      console.log('❌ Not found in sku_matching_view');
    }
    
    // Check a few other devices with notes
    console.log('\n📋 Checking other devices with notes:');
    const otherDevicesResult = await client.query(`
      SELECT imei, brand, model, carrier, device_notes
      FROM sku_matching_view 
      WHERE device_notes IS NOT NULL 
      AND device_notes LIKE '%CARRIER%'
      LIMIT 5
    `);
    
    console.log(`📊 Found ${otherDevicesResult.rows.length} devices with carrier notes:`);
    otherDevicesResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. IMEI: ${row.imei}, Notes: "${row.device_notes}"`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkDeviceNotes();
