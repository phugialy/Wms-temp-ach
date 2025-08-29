const { Client } = require('pg');
require('dotenv').config();

async function checkProductTableStructure() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Check the structure of product table
    console.log('\n🔍 Product Table Structure:');
    console.log('============================');
    
    const productStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'product'
      ORDER BY ordinal_position
    `);

    console.log('Product Table Columns:');
    productStructure.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check the structure of device_test table
    console.log('\n🔍 Device Test Table Structure:');
    console.log('================================');
    
    const deviceTestStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'device_test'
      ORDER BY ordinal_position
    `);

    console.log('Device Test Table Columns:');
    deviceTestStructure.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check the specific IMEI data
    console.log('\n🔍 Checking IMEI 352707355368444:');
    console.log('==================================');
    
    const imeiData = await client.query(`
      SELECT *
      FROM product p
      LEFT JOIN device_test dt ON p.imei = dt.imei
      WHERE p.imei = '352707355368444'
    `);

    if (imeiData.rows.length > 0) {
      console.log('Device Data:');
      const device = imeiData.rows[0];
      Object.keys(device).forEach(key => {
        console.log(`   ${key}: "${device[key]}"`);
      });
    } else {
      console.log('❌ Device not found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkProductTableStructure();
