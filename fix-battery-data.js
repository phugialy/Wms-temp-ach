const { Client } = require('pg');
require('dotenv').config();

async function fixBatteryData() {
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
        
        // Extract battery data
        const batteryHealth = device.BatteryHealthPercentage || device.batteryHealth || null;
        const batteryCount = device.BatteryCycle || device.batteryCycle || null;
        
        console.log(`  Battery Health: "${batteryHealth}"`);
        console.log(`  Battery Count: "${batteryCount}"`);
        
        if (batteryHealth || batteryCount) {
          // Update the item table with battery data
          const updateQuery = `
            UPDATE item 
            SET 
              battery_health = $1,
              battery_count = $2,
              updated_at = NOW()
            WHERE imei = $3
          `;
          
          // Clean battery count - convert to integer if it's a number
          let cleanBatteryCount = batteryCount;
          if (batteryCount && !isNaN(batteryCount)) {
            cleanBatteryCount = parseInt(batteryCount);
          }
          
          await client.query(updateQuery, [batteryHealth, cleanBatteryCount, imei]);
          console.log(`  ✅ Updated battery data for IMEI ${imei}`);
        } else {
          console.log(`  ⚠️ No battery data found for IMEI ${imei}`);
        }
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error processing IMEI ${imei}:`, error.message);
      }
    }

    // Check the results
    console.log('\n📊 Battery Data After Fix:');
    const checkQuery = `
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN battery_health IS NOT NULL THEN 1 END) as items_with_battery_health,
        COUNT(CASE WHEN battery_count IS NOT NULL THEN 1 END) as items_with_battery_count
      FROM item
    `;
    const checkResult = await client.query(checkQuery);
    const stats = checkResult.rows[0];
    console.log(`  Total items: ${stats.total_items}`);
    console.log(`  Items with battery health: ${stats.items_with_battery_health}`);
    console.log(`  Items with battery count: ${stats.items_with_battery_count}`);

    // Show sample updated data
    console.log('\n📋 Sample Updated Battery Data:');
    const sampleQuery = `
      SELECT imei, model, battery_health, battery_count
      FROM item 
      WHERE battery_health IS NOT NULL OR battery_count IS NOT NULL
      ORDER BY updated_at DESC 
      LIMIT 5
    `;
    const sampleResult = await client.query(sampleQuery);
    sampleResult.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. IMEI: ${row.imei}`);
      console.log(`     Model: ${row.model}`);
      console.log(`     Battery Health: "${row.battery_health}"`);
      console.log(`     Battery Count: "${row.battery_count}"`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

fixBatteryData();
