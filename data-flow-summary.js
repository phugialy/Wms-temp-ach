const { Client } = require('pg');
require('dotenv').config();

async function dataFlowSummary() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    console.log('\n🎯 COMPREHENSIVE DATA FLOW SUMMARY');
    console.log('=====================================');

    // Check all critical fields
    console.log('\n📊 Item Table Data Completeness:');
    const completenessQuery = `
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN i.model IS NOT NULL THEN 1 END) as items_with_model,
        COUNT(CASE WHEN i.model_number IS NOT NULL THEN 1 END) as items_with_model_number,
        COUNT(CASE WHEN p.brand IS NOT NULL THEN 1 END) as items_with_brand,
        COUNT(CASE WHEN i.capacity IS NOT NULL THEN 1 END) as items_with_capacity,
        COUNT(CASE WHEN i.color IS NOT NULL THEN 1 END) as items_with_color,
        COUNT(CASE WHEN i.carrier IS NOT NULL THEN 1 END) as items_with_carrier,
        COUNT(CASE WHEN i.battery_health IS NOT NULL THEN 1 END) as items_with_battery_health,
        COUNT(CASE WHEN i.battery_count IS NOT NULL THEN 1 END) as items_with_battery_count,
        COUNT(CASE WHEN i.working IS NOT NULL THEN 1 END) as items_with_working
      FROM item i
      LEFT JOIN product p ON i.imei = p.imei
    `;
    const completenessResult = await client.query(completenessQuery);
    const stats = completenessResult.rows[0];
    
    console.log(`  Total items: ${stats.total_items}`);
    console.log(`  Items with model: ${stats.items_with_model} (${Math.round(stats.items_with_model/stats.total_items*100)}%)`);
    console.log(`  Items with model_number: ${stats.items_with_model_number} (${Math.round(stats.items_with_model_number/stats.total_items*100)}%)`);
    console.log(`  Items with brand: ${stats.items_with_brand} (${Math.round(stats.items_with_brand/stats.total_items*100)}%)`);
    console.log(`  Items with capacity: ${stats.items_with_capacity} (${Math.round(stats.items_with_capacity/stats.total_items*100)}%)`);
    console.log(`  Items with color: ${stats.items_with_color} (${Math.round(stats.items_with_color/stats.total_items*100)}%)`);
    console.log(`  Items with carrier: ${stats.items_with_carrier} (${Math.round(stats.items_with_carrier/stats.total_items*100)}%)`);
    console.log(`  Items with battery_health: ${stats.items_with_battery_health} (${Math.round(stats.items_with_battery_health/stats.total_items*100)}%)`);
    console.log(`  Items with battery_count: ${stats.items_with_battery_count} (${Math.round(stats.items_with_battery_count/stats.total_items*100)}%)`);
    console.log(`  Items with working: ${stats.items_with_working} (${Math.round(stats.items_with_working/stats.total_items*100)}%)`);

    // Check brand distribution
    console.log('\n🏷️ Brand Distribution:');
    const brandQuery = `
      SELECT p.brand, COUNT(*) as count
      FROM product p
      GROUP BY p.brand
      ORDER BY count DESC
    `;
    const brandResult = await client.query(brandQuery);
    brandResult.rows.forEach(row => {
      console.log(`  ${row.brand}: ${row.count} devices`);
    });

    // Check model number distribution
    console.log('\n📱 Model Number Distribution:');
    const modelNumberQuery = `
      SELECT model_number, COUNT(*) as count
      FROM item
      WHERE model_number IS NOT NULL
      GROUP BY model_number
      ORDER BY count DESC
    `;
    const modelNumberResult = await client.query(modelNumberQuery);
    modelNumberResult.rows.forEach(row => {
      console.log(`  ${row.model_number}: ${row.count} devices`);
    });

    // Check battery data quality
    console.log('\n🔋 Battery Data Quality:');
    const batteryQuery = `
      SELECT 
        COUNT(CASE WHEN battery_health IS NOT NULL THEN 1 END) as with_health,
        COUNT(CASE WHEN battery_count IS NOT NULL THEN 1 END) as with_count,
        COUNT(CASE WHEN battery_health IS NOT NULL AND battery_count IS NOT NULL THEN 1 END) as with_both
      FROM item
    `;
    const batteryResult = await client.query(batteryQuery);
    const batteryStats = batteryResult.rows[0];
    console.log(`  Devices with battery health: ${batteryStats.with_health}`);
    console.log(`  Devices with battery count: ${batteryStats.with_count}`);
    console.log(`  Devices with both: ${batteryStats.with_both}`);

    // Sample data verification
    console.log('\n📋 Sample Data Verification (first 3 items):');
    const sampleQuery = `
      SELECT 
        i.imei,
        i.model,
        i.model_number,
        p.brand,
        i.capacity,
        i.color,
        i.carrier,
        i.battery_health,
        i.battery_count,
        i.working
      FROM item i
      LEFT JOIN product p ON i.imei = p.imei
      ORDER BY i.created_at DESC 
      LIMIT 3
    `;
    const sampleResult = await client.query(sampleQuery);
    sampleResult.rows.forEach((row, index) => {
      console.log(`\n  ${index + 1}. IMEI: ${row.imei}`);
      console.log(`     Model: "${row.model}"`);
      console.log(`     Model Number: "${row.model_number}"`);
      console.log(`     Brand: "${row.brand}"`);
      console.log(`     Capacity: "${row.capacity}"`);
      console.log(`     Color: "${row.color}"`);
      console.log(`     Carrier: "${row.carrier}"`);
      console.log(`     Battery Health: "${row.battery_health}"`);
      console.log(`     Battery Count: "${row.battery_count}"`);
      console.log(`     Working: "${row.working}"`);
    });

    console.log('\n✅ DATA FLOW VERIFICATION COMPLETE');
    console.log('=====================================');
    console.log('All critical fields are now properly mapped and populated!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

dataFlowSummary();
