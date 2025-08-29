const { Client } = require('pg');
require('dotenv').config();

async function testFailedDeviceFiltering() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Check counts in different views
    console.log('\n📊 Device Counts After FAILED Device Filtering:');
    console.log('===============================================');

    // Count devices in sku_matching_view (should exclude FAILED)
    const skuMatchingCount = await client.query('SELECT COUNT(*) as count FROM sku_matching_view');
    console.log(`✅ SKU Matching View: ${skuMatchingCount.rows[0].count} devices (FAILED devices excluded)`);

    // Count devices in failed_devices_view (should only include FAILED)
    const failedDevicesCount = await client.query('SELECT COUNT(*) as count FROM failed_devices_view');
    console.log(`🚫 Failed Devices View: ${failedDevicesCount.rows[0].count} devices (FAILED devices only)`);

    // Count total devices in product table
    const totalDevicesCount = await client.query('SELECT COUNT(*) as count FROM product');
    console.log(`📱 Total Devices in Product: ${totalDevicesCount.rows[0].count} devices`);

    // Verify the math adds up
    const expectedTotal = skuMatchingCount.rows[0].count + failedDevicesCount.rows[0].count;
    const actualTotal = totalDevicesCount.rows[0].count;
    console.log(`\n🧮 Verification: ${skuMatchingCount.rows[0].count} + ${failedDevicesCount.rows[0].count} = ${expectedTotal} (should equal ${actualTotal})`);

    if (expectedTotal === actualTotal) {
      console.log('✅ Perfect! All devices are accounted for.');
    } else {
      console.log('⚠️  Some devices may not have device_test records or other issues.');
    }

    // Show some sample FAILED devices
    console.log('\n🚫 Sample FAILED Devices (excluded from SKU matching):');
    console.log('=====================================================');
    
    const sampleFailedDevices = await client.query(`
      SELECT imei, original_sku, brand, model, device_notes
      FROM failed_devices_view
      ORDER BY last_activity DESC
      LIMIT 5
    `);

    sampleFailedDevices.rows.forEach((device, index) => {
      console.log(`   ${index + 1}. ${device.imei} - ${device.original_sku} (${device.brand} ${device.model})`);
      console.log(`      Notes: "${device.device_notes}"`);
    });

    // Show some sample devices in SKU matching view
    console.log('\n✅ Sample Devices in SKU Matching View (FAILED devices excluded):');
    console.log('==================================================================');
    
    const sampleSkuMatchingDevices = await client.query(`
      SELECT imei, original_sku, brand, model, device_notes
      FROM sku_matching_view
      ORDER BY last_activity DESC
      LIMIT 5
    `);

    sampleSkuMatchingDevices.rows.forEach((device, index) => {
      console.log(`   ${index + 1}. ${device.imei} - ${device.original_sku} (${device.brand} ${device.model})`);
      console.log(`      Notes: "${device.device_notes || 'No notes'}"`);
    });

    // Check if the 9 previously unmatched devices are now in the failed_devices_view
    console.log('\n🔍 Checking Previously Unmatched Devices:');
    console.log('==========================================');
    
    const previouslyUnmatched = [
      '352707355496146', '352707355238498', '352707354703385', '351183570585223',
      '350468690555995', '350278506538212', '350278500795644', '350275820547424', '350237727593067'
    ];

    for (const imei of previouslyUnmatched) {
      const inSkuMatching = await client.query('SELECT COUNT(*) as count FROM sku_matching_view WHERE imei = $1', [imei]);
      const inFailedDevices = await client.query('SELECT COUNT(*) as count FROM failed_devices_view WHERE imei = $1', [imei]);
      
      if (inFailedDevices.rows[0].count > 0) {
        console.log(`   ✅ ${imei}: Now correctly in FAILED devices view`);
      } else if (inSkuMatching.rows[0].count > 0) {
        console.log(`   ⚠️  ${imei}: Still in SKU matching view (may not be FAILED)`);
      } else {
        console.log(`   ❓ ${imei}: Not found in either view (may not have device_test record)`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

testFailedDeviceFiltering();
