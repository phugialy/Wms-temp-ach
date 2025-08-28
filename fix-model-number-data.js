const { Client } = require('pg');
require('dotenv').config();

async function fixModelNumberData() {
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
        
        // Extract model_number data
        const modelNumber = device['Model#'] || device.modelNumber || device.ModelNumber || null;
        
        console.log(`  Model Number: "${modelNumber}"`);
        
        if (modelNumber) {
          // Update the item table with model_number data
          const updateQuery = `
            UPDATE item 
            SET 
              model_number = $1,
              updated_at = NOW()
            WHERE imei = $2
          `;
          
          await client.query(updateQuery, [modelNumber, imei]);
          console.log(`  ✅ Updated model_number for IMEI ${imei}`);
        } else {
          console.log(`  ⚠️ No model_number found for IMEI ${imei}`);
        }
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error processing IMEI ${imei}:`, error.message);
      }
    }

    // Check the results
    console.log('\n📊 Model Number Data After Fix:');
    const checkQuery = `
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN model_number IS NOT NULL THEN 1 END) as items_with_model_number,
        COUNT(CASE WHEN model_number IS NULL THEN 1 END) as items_without_model_number
      FROM item
    `;
    const checkResult = await client.query(checkQuery);
    const stats = checkResult.rows[0];
    console.log(`  Total items: ${stats.total_items}`);
    console.log(`  Items with model_number: ${stats.items_with_model_number}`);
    console.log(`  Items without model_number: ${stats.items_without_model_number}`);

    // Show sample updated data
    console.log('\n📋 Sample Updated Model Number Data:');
    const sampleQuery = `
      SELECT imei, model, model_number
      FROM item 
      WHERE model_number IS NOT NULL
      ORDER BY updated_at DESC 
      LIMIT 5
    `;
    const sampleResult = await client.query(sampleQuery);
    sampleResult.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. IMEI: ${row.imei}`);
      console.log(`     Model: "${row.model}"`);
      console.log(`     Model Number: "${row.model_number}"`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

fixModelNumberData();
