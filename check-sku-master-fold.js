const { Client } = require('pg');
require('dotenv').config();

async function checkFoldSkus() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    // Search for Fold-related SKUs in master table
    console.log('\n🔍 Searching for Fold-related SKUs in master table...');
    
    const foldSkus = await client.query(`
      SELECT sku_code, brand, model, carrier, source_tab
      FROM sku_master 
      WHERE (
        LOWER(sku_code) LIKE '%fold%' OR
        LOWER(brand) LIKE '%samsung%' OR
        LOWER(model) LIKE '%fold%'
      )
      AND is_active = true
      ORDER BY sku_code
      LIMIT 20
    `);

    console.log(`Found ${foldSkus.rows.length} Fold-related SKUs:`);
    foldSkus.rows.forEach((sku, index) => {
      console.log(`   ${index + 1}. ${sku.sku_code} (${sku.brand} ${sku.model} ${sku.carrier}) [${sku.source_tab}]`);
    });

    // Also check for any Samsung SKUs
    console.log('\n🔍 Searching for Samsung SKUs...');
    const samsungSkus = await client.query(`
      SELECT sku_code, brand, model, carrier, source_tab
      FROM sku_master 
      WHERE LOWER(brand) LIKE '%samsung%'
      AND is_active = true
      ORDER BY sku_code
      LIMIT 10
    `);

    console.log(`Found ${samsungSkus.rows.length} Samsung SKUs:`);
    samsungSkus.rows.forEach((sku, index) => {
      console.log(`   ${index + 1}. ${sku.sku_code} (${sku.brand} ${sku.model} ${sku.carrier}) [${sku.source_tab}]`);
    });

    // Check for unlocked devices
    console.log('\n🔍 Searching for unlocked devices...');
    const unlockedSkus = await client.query(`
      SELECT sku_code, brand, model, carrier, source_tab
      FROM sku_master 
      WHERE (
        LOWER(carrier) LIKE '%unlock%' OR
        LOWER(sku_code) LIKE '%unlock%' OR
        is_unlocked = true
      )
      AND is_active = true
      ORDER BY sku_code
      LIMIT 10
    `);

    console.log(`Found ${unlockedSkus.rows.length} unlocked SKUs:`);
    unlockedSkus.rows.forEach((sku, index) => {
      console.log(`   ${index + 1}. ${sku.sku_code} (${sku.brand} ${sku.model} ${sku.carrier}) [${sku.source_tab}]`);
    });

  } catch (error) {
    console.error('❌ Error checking Fold SKUs:', error);
  } finally {
    await client.end();
    console.log('\n🔗 Database connection closed');
  }
}

console.log('🚀 Checking Fold SKUs in Master Table...\n');
checkFoldSkus();
