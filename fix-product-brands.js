const { Client } = require('pg');
require('dotenv').config();

async function fixProductBrands() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // First, let's see what we have before the fix
    console.log('\n📊 Before fix - Brand distribution:');
    const beforeQuery = `
      SELECT brand, COUNT(*) as count
      FROM product 
      GROUP BY brand 
      ORDER BY count DESC
    `;
    const beforeResult = await client.query(beforeQuery);
    beforeResult.rows.forEach(row => {
      console.log(`  "${row.brand}": ${row.count} devices`);
    });

    // Update brands based on model names in the item table
    console.log('\n🔄 Updating brands based on model names...');
    
    const updateQuery = `
      UPDATE product 
      SET brand = CASE 
        WHEN EXISTS (
          SELECT 1 FROM item 
          WHERE item.imei = product.imei 
          AND item.model ILIKE '%galaxy%'
        ) THEN 'Samsung'
        WHEN EXISTS (
          SELECT 1 FROM item 
          WHERE item.imei = product.imei 
          AND (item.model ILIKE '%iphone%' OR item.model ILIKE '%ipad%')
        ) THEN 'Apple'
        WHEN EXISTS (
          SELECT 1 FROM item 
          WHERE item.imei = product.imei 
          AND item.model ILIKE '%pixel%'
        ) THEN 'Google'
        ELSE 'Unknown'
      END,
      updated_at = NOW()
      WHERE brand = 'Unknown' OR brand = 'Unknown Brand'
    `;
    
    const updateResult = await client.query(updateQuery);
    console.log(`✅ Updated ${updateResult.rowCount} product records`);

    // Check the results after the fix
    console.log('\n📊 After fix - Brand distribution:');
    const afterQuery = `
      SELECT brand, COUNT(*) as count
      FROM product 
      GROUP BY brand 
      ORDER BY count DESC
    `;
    const afterResult = await client.query(afterQuery);
    afterResult.rows.forEach(row => {
      console.log(`  "${row.brand}": ${row.count} devices`);
    });

    // Show some sample updated records
    console.log('\n📋 Sample updated records:');
    const sampleQuery = `
      SELECT p.imei, p.brand, p.sku, i.model
      FROM product p
      JOIN item i ON p.imei = i.imei
      WHERE p.brand != 'Unknown'
      ORDER BY p.updated_at DESC
      LIMIT 5
    `;
    const sampleResult = await client.query(sampleQuery);
    sampleResult.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. IMEI: ${row.imei}`);
      console.log(`     Brand: ${row.brand}`);
      console.log(`     Model: ${row.model}`);
      console.log(`     SKU: ${row.sku}`);
      console.log('');
    });

    // Verify the fix worked
    console.log('\n🔍 Verification:');
    const verificationQuery = `
      SELECT 
        COUNT(*) as total_devices,
        COUNT(CASE WHEN brand = 'Samsung' THEN 1 END) as samsung_devices,
        COUNT(CASE WHEN brand = 'Apple' THEN 1 END) as apple_devices,
        COUNT(CASE WHEN brand = 'Google' THEN 1 END) as google_devices,
        COUNT(CASE WHEN brand = 'Unknown' THEN 1 END) as unknown_devices
      FROM product
    `;
    const verificationResult = await client.query(verificationQuery);
    const stats = verificationResult.rows[0];
    console.log(`  Total devices: ${stats.total_devices}`);
    console.log(`  Samsung devices: ${stats.samsung_devices}`);
    console.log(`  Apple devices: ${stats.apple_devices}`);
    console.log(`  Google devices: ${stats.google_devices}`);
    console.log(`  Unknown devices: ${stats.unknown_devices}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

fixProductBrands();
