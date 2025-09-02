const { Client } = require('pg');
require('dotenv').config();

async function checkItemTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    const testImei = '352707355368444';
    console.log(`\n🔍 Checking item table for IMEI: ${testImei}`);

    const result = await client.query(`
      SELECT * FROM item WHERE imei = $1
    `, [testImei]);

    if (result.rows.length > 0) {
      console.log('\n📱 Item Table Data:');
      const item = result.rows[0];
      Object.keys(item).forEach(key => {
        console.log(`   ${key}: "${item[key]}"`);
      });
    } else {
      console.log('❌ No item data found');
    }

    // Also check the product table
    console.log('\n🔍 Checking product table for IMEI:');
    const productResult = await client.query(`
      SELECT * FROM product WHERE imei = $1
    `, [testImei]);

    if (productResult.rows.length > 0) {
      console.log('\n📱 Product Table Data:');
      const product = productResult.rows[0];
      Object.keys(product).forEach(key => {
        console.log(`   ${key}: "${product[key]}"`);
      });
    } else {
      console.log('❌ No product data found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkItemTable();

