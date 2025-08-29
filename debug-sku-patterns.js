const { Client } = require('pg');
require('dotenv').config();

async function debugSkuPatterns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log('\n🔍 Analyzing SKU Patterns in Database');
    console.log('=====================================');

    // Get all SKUs to analyze patterns
    const result = await client.query(`
      SELECT sku_code, is_active
      FROM sku_master 
      WHERE is_active = true
      ORDER BY sku_code
      LIMIT 50
    `);

    console.log(`\n📊 Found ${result.rows.length} active SKUs:`);
    
    result.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.sku_code}`);
    });

    // Analyze brand patterns
    console.log('\n🎯 Brand Pattern Analysis:');
    console.log('==========================');
    
    const brandPatterns = await client.query(`
      SELECT 
        CASE 
          WHEN sku_code LIKE 'A%' THEN 'Apple (A-prefix)'
          WHEN sku_code LIKE 'FOLD%' THEN 'Samsung Fold'
          WHEN sku_code LIKE 'ZFLIP%' THEN 'Samsung ZFlip'
          WHEN sku_code LIKE 'S%' THEN 'Samsung (S-prefix)'
          WHEN sku_code LIKE 'PIXEL%' THEN 'Google Pixel'
          ELSE 'Other'
        END as brand_pattern,
        COUNT(*) as count
      FROM sku_master 
      WHERE is_active = true
      GROUP BY brand_pattern
      ORDER BY count DESC
    `);

    brandPatterns.rows.forEach(row => {
      console.log(`   ${row.brand_pattern}: ${row.count} SKUs`);
    });

    // Test specific patterns for our device
    console.log('\n🎯 Testing Specific Patterns for Fold3:');
    console.log('=======================================');
    
    const foldPatterns = await client.query(`
      SELECT sku_code
      FROM sku_master 
      WHERE is_active = true
      AND (
        sku_code LIKE '%FOLD%' OR
        sku_code LIKE '%FOLD3%' OR
        sku_code LIKE 'FOLD3%' OR
        sku_code LIKE '%512%' OR
        sku_code LIKE '%BLK%'
      )
      ORDER BY sku_code
    `);

    console.log(`\n📱 Found ${foldPatterns.rows.length} potential Fold3 SKUs:`);
    foldPatterns.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.sku_code}`);
    });

    // Test carrier patterns
    console.log('\n🎯 Carrier Pattern Analysis:');
    console.log('============================');
    
    const carrierPatterns = await client.query(`
      SELECT 
        CASE 
          WHEN sku_code LIKE '%-%-%-%-%' THEN 'Has Carrier Field'
          WHEN sku_code LIKE '%-%-%-' THEN 'No Carrier Field'
          ELSE 'Other Format'
        END as carrier_pattern,
        COUNT(*) as count
      FROM sku_master 
      WHERE is_active = true
      GROUP BY carrier_pattern
      ORDER BY count DESC
    `);

    carrierPatterns.rows.forEach(row => {
      console.log(`   ${row.carrier_pattern}: ${row.count} SKUs`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

debugSkuPatterns();
