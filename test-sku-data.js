const { Client } = require('pg');
require('dotenv').config();

async function testSkuData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Check if sku_matching_view exists
    const viewCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.views 
        WHERE table_name = 'sku_matching_view'
      );
    `);

    if (!viewCheck.rows[0].exists) {
      console.log('❌ sku_matching_view does not exist');
      return;
    }

    console.log('✅ sku_matching_view exists');

    // Get sample data
    const sampleData = await client.query(`
      SELECT imei, brand, model, capacity, color, carrier 
      FROM sku_matching_view 
      LIMIT 3
    `);

    if (sampleData.rows.length === 0) {
      console.log('❌ No data found in sku_matching_view');
      return;
    }

    console.log('\n📱 Available test IMEIs:');
    sampleData.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.imei} (${row.brand} ${row.model} ${row.capacity}GB ${row.color} ${row.carrier})`);
    });

    // Check SKU master data
    const skuCount = await client.query('SELECT COUNT(*) as count FROM sku_master');
    console.log(`\n📦 SKU Master entries: ${skuCount.rows[0].count}`);

    console.log('\n🎯 You can now test the SKU tool with any of these IMEIs!');

  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await client.end();
  }
}

testSkuData();
