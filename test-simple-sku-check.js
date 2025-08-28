const { Client } = require('pg');
require('dotenv').config();

async function checkDatabaseState() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    // Check what data we have
    console.log('\n📋 Checking database state...');

    // Check product table
    const productCount = await client.query('SELECT COUNT(*) as count FROM product');
    console.log(`📦 Product table: ${productCount.rows[0].count} records`);

    // Check item table
    const itemCount = await client.query('SELECT COUNT(*) as count FROM item');
    console.log(`📱 Item table: ${itemCount.rows[0].count} records`);

    // Check sku_master table
    const skuMasterCount = await client.query('SELECT COUNT(*) as count FROM sku_master');
    console.log(`🏷️ SKU Master table: ${skuMasterCount.rows[0].count} records`);

    // Sample some data
    console.log('\n📋 Sample data from product table:');
    const sampleProducts = await client.query(`
      SELECT imei, sku, brand, date_in 
      FROM product 
      LIMIT 5
    `);
    sampleProducts.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. IMEI: ${row.imei}, SKU: ${row.sku}, Brand: ${row.brand}`);
    });

    // Check for generated SKUs
    console.log('\n🔍 Looking for generated SKUs...');
    const generatedSkus = await client.query(`
      SELECT imei, sku 
      FROM product 
      WHERE sku LIKE '%-%-%-%'
      LIMIT 5
    `);
    console.log(`Found ${generatedSkus.rows.length} items with generated SKUs:`);
    generatedSkus.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. IMEI: ${row.imei}, SKU: ${row.sku}`);
    });

    // Check SKU master sample
    console.log('\n🏷️ Sample SKUs from master table:');
    const sampleMasterSkus = await client.query(`
      SELECT sku_code, brand, model, carrier 
      FROM sku_master 
      LIMIT 5
    `);
    sampleMasterSkus.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.sku_code} (${row.brand} ${row.model} ${row.carrier})`);
    });

  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await client.end();
    console.log('\n🔗 Database connection closed');
  }
}

console.log('🚀 Checking Database State...\n');
checkDatabaseState();
