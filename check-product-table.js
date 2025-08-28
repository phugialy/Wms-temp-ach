const { Client } = require('pg');
require('dotenv').config();

async function checkProductTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check Product table structure
    console.log('\n📋 Product Table Structure:');
    const structureQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'product' 
      ORDER BY ordinal_position
    `;
    const structureResult = await client.query(structureQuery);
    structureResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Check Product table data
    console.log('\n📊 Product Table Data (first 10 rows):');
    const dataQuery = `
      SELECT imei, sku, brand, date_in, created_at
      FROM product 
      ORDER BY created_at DESC 
      LIMIT 10
    `;
    const dataResult = await client.query(dataQuery);
    
    if (dataResult.rows.length === 0) {
      console.log('  No data found in Product table');
    } else {
      dataResult.rows.forEach((row, index) => {
        console.log(`  Row ${index + 1}:`);
        console.log(`    IMEI: ${row.imei}`);
        console.log(`    SKU: ${row.sku}`);
        console.log(`    Brand: "${row.brand}"`);
        console.log(`    Date In: ${row.date_in}`);
        console.log(`    Created: ${row.created_at}`);
        console.log('');
      });
    }

    // Check brand distribution
    console.log('\n📈 Brand Distribution:');
    const brandQuery = `
      SELECT brand, COUNT(*) as count
      FROM product 
      GROUP BY brand 
      ORDER BY count DESC
    `;
    const brandResult = await client.query(brandQuery);
    brandResult.rows.forEach(row => {
      console.log(`  "${row.brand}": ${row.count} devices`);
    });

    // Check for null/empty brands
    console.log('\n🔍 Null/Empty Brand Analysis:');
    const nullBrandQuery = `
      SELECT 
        COUNT(*) as total_devices,
        COUNT(CASE WHEN brand IS NULL THEN 1 END) as null_brands,
        COUNT(CASE WHEN brand = '' THEN 1 END) as empty_brands,
        COUNT(CASE WHEN brand = 'Unknown' THEN 1 END) as unknown_brands,
        COUNT(CASE WHEN brand IS NOT NULL AND brand != '' AND brand != 'Unknown' THEN 1 END) as valid_brands
      FROM product
    `;
    const nullBrandResult = await client.query(nullBrandQuery);
    const stats = nullBrandResult.rows[0];
    console.log(`  Total devices: ${stats.total_devices}`);
    console.log(`  Null brands: ${stats.null_brands}`);
    console.log(`  Empty brands: ${stats.empty_brands}`);
    console.log(`  Unknown brands: ${stats.unknown_brands}`);
    console.log(`  Valid brands: ${stats.valid_brands}`);

    // Check Item table for comparison
    console.log('\n📱 Item Table Brand Check:');
    const itemQuery = `
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN model LIKE '%Galaxy%' THEN 1 END) as galaxy_models,
        COUNT(CASE WHEN model LIKE '%iPhone%' THEN 1 END) as iphone_models,
        COUNT(CASE WHEN model LIKE '%Pixel%' THEN 1 END) as pixel_models
      FROM item
    `;
    const itemResult = await client.query(itemQuery);
    const itemStats = itemResult.rows[0];
    console.log(`  Total items: ${itemStats.total_items}`);
    console.log(`  Galaxy models: ${itemStats.galaxy_models}`);
    console.log(`  iPhone models: ${itemStats.iphone_models}`);
    console.log(`  Pixel models: ${itemStats.pixel_models}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkProductTable();
