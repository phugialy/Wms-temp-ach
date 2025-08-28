const { Client } = require('pg');
require('dotenv').config();

async function checkBatteryData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check Item table battery data
    console.log('\n📱 Item Table Battery Data Analysis:');
    const batteryQuery = `
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN battery_health IS NOT NULL THEN 1 END) as items_with_battery_health,
        COUNT(CASE WHEN battery_count IS NOT NULL THEN 1 END) as items_with_battery_count,
        COUNT(CASE WHEN battery_health IS NULL THEN 1 END) as items_without_battery_health,
        COUNT(CASE WHEN battery_count IS NULL THEN 1 END) as items_without_battery_count
      FROM item
    `;
    const batteryResult = await client.query(batteryQuery);
    const batteryStats = batteryResult.rows[0];
    console.log(`  Total items: ${batteryStats.total_items}`);
    console.log(`  Items with battery health: ${batteryStats.items_with_battery_health}`);
    console.log(`  Items with battery count: ${batteryStats.items_with_battery_count}`);
    console.log(`  Items without battery health: ${batteryStats.items_without_battery_health}`);
    console.log(`  Items without battery count: ${batteryStats.items_without_battery_count}`);

    // Check sample battery data
    console.log('\n📋 Sample Battery Data (first 10 items):');
    const sampleQuery = `
      SELECT imei, model, battery_health, battery_count, working
      FROM item 
      ORDER BY created_at DESC 
      LIMIT 10
    `;
    const sampleResult = await client.query(sampleQuery);
    sampleResult.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. IMEI: ${row.imei}`);
      console.log(`     Model: ${row.model}`);
      console.log(`     Battery Health: "${row.battery_health}"`);
      console.log(`     Battery Count: "${row.battery_count}"`);
      console.log(`     Working: ${row.working}`);
      console.log('');
    });

    // Check device_test table for comparison
    console.log('\n🧪 Device Test Table Battery Data:');
    const deviceTestQuery = `
      SELECT 
        COUNT(*) as total_tests,
        COUNT(CASE WHEN notes IS NOT NULL AND notes != '' THEN 1 END) as tests_with_notes,
        COUNT(CASE WHEN custom1 IS NOT NULL AND custom1 != '' THEN 1 END) as tests_with_custom1
      FROM device_test
    `;
    const deviceTestResult = await client.query(deviceTestQuery);
    const deviceTestStats = deviceTestResult.rows[0];
    console.log(`  Total device tests: ${deviceTestStats.total_tests}`);
    console.log(`  Tests with notes: ${deviceTestStats.tests_with_notes}`);
    console.log(`  Tests with custom1: ${deviceTestStats.tests_with_custom1}`);

    // Check queue processing logs for any battery-related errors
    console.log('\n📊 Queue Processing Logs (battery-related):');
    const logQuery = `
      SELECT action, message, error, created_at
      FROM queue_processing_log 
      WHERE message ILIKE '%battery%' OR error ILIKE '%battery%'
      ORDER BY created_at DESC 
      LIMIT 5
    `;
    const logResult = await client.query(logQuery);
    if (logResult.rows.length === 0) {
      console.log('  No battery-related logs found');
    } else {
      logResult.rows.forEach((row, index) => {
        console.log(`  ${index + 1}. Action: ${row.action}`);
        console.log(`     Message: ${row.message}`);
        console.log(`     Error: ${row.error || 'None'}`);
        console.log(`     Date: ${row.created_at}`);
        console.log('');
      });
    }

    // Check for any items with "BCC" values that might indicate field mapping issues
    console.log('\n🔍 Checking for "BCC" values (potential field mapping issues):');
    const bccQuery = `
      SELECT imei, model, battery_health, battery_count
      FROM item 
      WHERE battery_health::text ILIKE '%BCC%' OR battery_count::text ILIKE '%BCC%'
      LIMIT 5
    `;
    const bccResult = await client.query(bccQuery);
    if (bccResult.rows.length === 0) {
      console.log('  No "BCC" values found in battery fields');
    } else {
      bccResult.rows.forEach((row, index) => {
        console.log(`  ${index + 1}. IMEI: ${row.imei}`);
        console.log(`     Model: ${row.model}`);
        console.log(`     Battery Health: "${row.battery_health}"`);
        console.log(`     Battery Count: "${row.battery_count}"`);
        console.log('');
      });
    }

    // Check for any non-null but potentially problematic battery values
    console.log('\n🔍 Non-null battery values analysis:');
    const nonNullQuery = `
      SELECT 
        battery_health,
        COUNT(*) as count
      FROM item 
      WHERE battery_health IS NOT NULL
      GROUP BY battery_health
      ORDER BY count DESC
      LIMIT 10
    `;
    const nonNullResult = await client.query(nonNullQuery);
    console.log('  Battery Health values:');
    nonNullResult.rows.forEach(row => {
      console.log(`    "${row.battery_health}": ${row.count} items`);
    });

    const nonNullCountQuery = `
      SELECT 
        battery_count,
        COUNT(*) as count
      FROM item 
      WHERE battery_count IS NOT NULL
      GROUP BY battery_count
      ORDER BY count DESC
      LIMIT 10
    `;
    const nonNullCountResult = await client.query(nonNullCountQuery);
    console.log('  Battery Count values:');
    nonNullCountResult.rows.forEach(row => {
      console.log(`    "${row.battery_count}": ${row.count} items`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkBatteryData();
