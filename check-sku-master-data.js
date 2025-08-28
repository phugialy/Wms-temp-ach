const { Client } = require('pg');
require('dotenv').config();

async function checkSkuMasterData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    // Check SKU master data by source tabs
    console.log('\n📋 Checking SKU master data by source tabs...');
    const tabStats = await client.query(`
      SELECT source_tab, COUNT(*) as count
      FROM sku_master 
      GROUP BY source_tab
      ORDER BY count DESC
    `);

    console.log('SKU Master by tabs:');
    tabStats.rows.forEach(row => {
      console.log(`   ${row.source_tab}: ${row.count} SKUs`);
    });

    // Check for Samsung/Fold related SKUs
    console.log('\n🔍 Looking for Samsung/Fold related SKUs...');
    const samsungSkus = await client.query(`
      SELECT sku_code, brand, model, carrier, source_tab
      FROM sku_master 
      WHERE (
        LOWER(sku_code) LIKE '%samsung%' OR
        LOWER(sku_code) LIKE '%fold%' OR
        LOWER(sku_code) LIKE '%zfold%' OR
        LOWER(brand) LIKE '%samsung%' OR
        LOWER(model) LIKE '%fold%'
      )
      AND is_active = true
      LIMIT 10
    `);

    console.log(`Found ${samsungSkus.rows.length} Samsung/Fold related SKUs:`);
    samsungSkus.rows.forEach((sku, index) => {
      console.log(`   ${index + 1}. ${sku.sku_code} (${sku.brand} ${sku.model} ${sku.carrier}) - ${sku.source_tab}`);
    });

    // Check for any SKUs with similar patterns
    console.log('\n🔍 Looking for SKUs with similar patterns...');
    const similarSkus = await client.query(`
      SELECT sku_code, brand, model, carrier, source_tab
      FROM sku_master 
      WHERE (
        LOWER(sku_code) LIKE '%fold%' OR
        LOWER(sku_code) LIKE '%z%' OR
        LOWER(sku_code) LIKE '%galaxy%'
      )
      AND is_active = true
      LIMIT 10
    `);

    console.log(`Found ${similarSkus.rows.length} similar SKUs:`);
    similarSkus.rows.forEach((sku, index) => {
      console.log(`   ${index + 1}. ${sku.sku_code} (${sku.brand} ${sku.model} ${sku.carrier}) - ${sku.source_tab}`);
    });

    // Check what brands we have
    console.log('\n🏷️ Checking available brands...');
    const brands = await client.query(`
      SELECT DISTINCT brand, COUNT(*) as count
      FROM sku_master 
      WHERE brand IS NOT NULL AND brand != ''
      GROUP BY brand
      ORDER BY count DESC
      LIMIT 10
    `);

    console.log('Top brands in SKU master:');
    brands.rows.forEach((brand, index) => {
      console.log(`   ${index + 1}. ${brand.brand}: ${brand.count} SKUs`);
    });

  } catch (error) {
    console.error('❌ Error checking SKU master data:', error);
  } finally {
    await client.end();
    console.log('\n🔗 Database connection closed');
  }
}

console.log('🚀 Checking SKU Master Data...\n');
checkSkuMasterData();
