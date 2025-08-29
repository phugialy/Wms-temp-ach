const { Client } = require('pg');
require('dotenv').config();

async function investigateFailedDevices() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Get all FAILED devices with detailed information
    console.log('\n🔍 Investigating FAILED Devices:');
    console.log('=================================');
    
    const failedDevices = await client.query(`
      SELECT 
        p.imei,
        p.sku as original_sku,
        p.brand,
        i.model,
        i.capacity,
        i.color,
        i.carrier,
        dt.notes as device_notes,
        p.date_in,
        mh.movement_date,
        GREATEST(p.date_in, COALESCE(mh.movement_date, p.date_in)) as last_activity
      FROM product p
      LEFT JOIN item i ON p.imei = i.imei
      LEFT JOIN device_test dt ON p.imei = dt.imei
      LEFT JOIN movement_history mh ON p.imei = mh.imei
      WHERE dt.notes IS NOT NULL 
      AND (dt.notes ILIKE '%FAIL%' OR dt.notes ILIKE '%FAILED%')
      ORDER BY p.imei, mh.movement_date DESC
    `);

    console.log(`📊 Found ${failedDevices.rows.length} FAILED device records total`);

    // Check for duplicates by IMEI
    const imeiCounts = {};
    failedDevices.rows.forEach(device => {
      imeiCounts[device.imei] = (imeiCounts[device.imei] || 0) + 1;
    });

    const uniqueImeis = Object.keys(imeiCounts);
    const duplicateImeis = Object.entries(imeiCounts).filter(([imei, count]) => count > 1);

    console.log(`\n📱 Unique IMEIs: ${uniqueImeis.length}`);
    console.log(`🔄 Duplicate IMEIs: ${duplicateImeis.length}`);

    if (duplicateImeis.length > 0) {
      console.log('\n🔄 Duplicate IMEIs found:');
      duplicateImeis.forEach(([imei, count]) => {
        console.log(`   ${imei}: ${count} records`);
      });
    }

    // Show all FAILED devices with their details
    console.log('\n🚫 All FAILED Devices:');
    console.log('======================');
    
    failedDevices.rows.forEach((device, index) => {
      console.log(`\n${index + 1}. IMEI: ${device.imei}`);
      console.log(`   Original SKU: "${device.original_sku}"`);
      console.log(`   Brand: ${device.brand || 'NULL'}`);
      console.log(`   Model: ${device.model || 'NULL'}`);
      console.log(`   Capacity: ${device.capacity || 'NULL'}`);
      console.log(`   Color: ${device.color || 'NULL'}`);
      console.log(`   Carrier: ${device.carrier || 'NULL'}`);
      console.log(`   Device Notes: "${device.device_notes}"`);
      console.log(`   Date In: ${device.date_in}`);
      console.log(`   Movement Date: ${device.movement_date || 'NULL'}`);
      console.log(`   Last Activity: ${device.last_activity}`);
    });

    // Check if the issue is with the movement_history join
    console.log('\n🔍 Checking movement_history join issue:');
    console.log('========================================');
    
    // Count devices with and without movement_history
    const withMovement = failedDevices.rows.filter(d => d.movement_date !== null).length;
    const withoutMovement = failedDevices.rows.filter(d => d.movement_date === null).length;
    
    console.log(`   With movement_history: ${withMovement}`);
    console.log(`   Without movement_history: ${withoutMovement}`);

    // Check the failed_devices_view directly
    console.log('\n🔍 Checking failed_devices_view directly:');
    console.log('=========================================');
    
    const failedViewCount = await client.query('SELECT COUNT(*) as count FROM failed_devices_view');
    console.log(`   failed_devices_view count: ${failedViewCount.rows[0].count}`);

    const failedViewDevices = await client.query(`
      SELECT imei, original_sku, device_notes, last_activity
      FROM failed_devices_view
      ORDER BY imei
    `);

    console.log('\n🚫 Devices in failed_devices_view:');
    failedViewDevices.rows.forEach((device, index) => {
      console.log(`   ${index + 1}. ${device.imei} - "${device.original_sku}" - "${device.device_notes}"`);
    });

    // Compare with the 9 previously unmatched devices
    console.log('\n🔍 Comparing with previously unmatched devices:');
    console.log('=================================================');
    
    const previouslyUnmatched = [
      '352707355496146', '352707355238498', '352707354703385', '351183570585223',
      '350468690555995', '350278506538212', '350278500795644', '350275820547424', '350237727593067'
    ];

    const foundInFailedView = [];
    const notFoundInFailedView = [];

    for (const imei of previouslyUnmatched) {
      const found = failedViewDevices.rows.some(d => d.imei === imei);
      if (found) {
        foundInFailedView.push(imei);
      } else {
        notFoundInFailedView.push(imei);
      }
    }

    console.log(`   Found in failed_devices_view: ${foundInFailedView.length} devices`);
    console.log(`   Not found in failed_devices_view: ${notFoundInFailedView.length} devices`);

    if (notFoundInFailedView.length > 0) {
      console.log(`   Missing IMEIs: ${notFoundInFailedView.join(', ')}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

investigateFailedDevices();
