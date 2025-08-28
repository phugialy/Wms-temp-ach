const { Client } = require('pg');
require('dotenv').config();

async function fixDeviceTestFields() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Get all IMEIs from the product table
    console.log('\n📱 Fetching all IMEIs from database...');
    const imeiQuery = `
      SELECT imei FROM product 
      ORDER BY created_at DESC 
      LIMIT 77
    `;
    const imeiResult = await client.query(imeiQuery);
    const imeis = imeiResult.rows.map(row => row.imei);
    
    console.log(`📋 Found ${imeis.length} IMEIs to process`);

    // Process each IMEI
    for (const imei of imeis) {
      try {
        console.log(`\n🔄 Processing IMEI: ${imei}`);
        
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

        // Get device details
        const deviceResponse = await fetch(`https://api.phonecheck.com/v2/master/imei/device-info-legacy/${imei}?detailed=true`, {
          method: 'GET',
          headers: { 'token_master': token }
        });

        if (!deviceResponse.ok) {
          console.log(`⚠️ Device lookup failed for IMEI ${imei}: ${deviceResponse.status}`);
          continue;
        }

        const deviceData = await deviceResponse.json();
        
        // Handle array response from Phonecheck API
        const device = Array.isArray(deviceData) ? deviceData[0] : deviceData;
        
        // Extract defects and custom1 data
        const defects = device.Failed || device.failed || null;
        const custom1 = device.Custom1 || device.custom1 || null;
        
        console.log(`  Failed: "${defects}"`);
        console.log(`  Custom1: "${custom1}"`);
        
        // Update the device_test table with defects and custom1 data
        const updateQuery = `
          UPDATE device_test 
          SET 
            defects = $1,
            custom1 = $2
          WHERE imei = $3
        `;
        
        await client.query(updateQuery, [defects, custom1, imei]);
        console.log(`  ✅ Updated device_test fields for IMEI ${imei}`);
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error processing IMEI ${imei}:`, error.message);
      }
    }

    // Check the results
    console.log('\n📊 Device Test Fields After Fix:');
    const checkQuery = `
      SELECT 
        COUNT(*) as total_tests,
        COUNT(CASE WHEN defects IS NOT NULL THEN 1 END) as tests_with_defects,
        COUNT(CASE WHEN defects IS NULL THEN 1 END) as tests_without_defects,
        COUNT(CASE WHEN custom1 IS NOT NULL THEN 1 END) as tests_with_custom1,
        COUNT(CASE WHEN custom1 IS NULL THEN 1 END) as tests_without_custom1
      FROM device_test
    `;
    const checkResult = await client.query(checkQuery);
    const stats = checkResult.rows[0];
    console.log(`  Total tests: ${stats.total_tests}`);
    console.log(`  Tests with defects: ${stats.tests_with_defects}`);
    console.log(`  Tests without defects: ${stats.tests_without_defects}`);
    console.log(`  Tests with custom1: ${stats.tests_with_custom1}`);
    console.log(`  Tests without custom1: ${stats.tests_without_custom1}`);

    // Show sample updated data
    console.log('\n📋 Sample Updated Device Test Data:');
    const sampleQuery = `
      SELECT imei, working, defects, notes, custom1
      FROM device_test 
      ORDER BY created_at DESC 
      LIMIT 5
    `;
    const sampleResult = await client.query(sampleQuery);
    sampleResult.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. IMEI: ${row.imei}`);
      console.log(`     Working: "${row.working}"`);
      console.log(`     Defects: "${row.defects}"`);
      console.log(`     Notes: "${row.notes}"`);
      console.log(`     Custom1: "${row.custom1}"`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

fixDeviceTestFields();
