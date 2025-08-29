const { Client } = require('pg');
require('dotenv').config();

async function debugSkuMatchingViewData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Check the specific IMEI in the SKU matching view
    const testImei = '352707355368444';
    console.log(`\n🔍 Debugging IMEI: ${testImei} in SKU Matching View`);

    const viewQuery = await client.query(`
      SELECT *
      FROM sku_matching_view
      WHERE imei = $1
    `, [testImei]);

    if (viewQuery.rows.length > 0) {
      console.log('\n📱 SKU Matching View Data:');
      const device = viewQuery.rows[0];
      Object.keys(device).forEach(key => {
        console.log(`   ${key}: "${device[key]}"`);
      });
    } else {
      console.log('❌ Device not found in SKU matching view');
    }

    // Check the SKU matching results table
    console.log('\n📊 SKU Matching Results:');
    const resultsQuery = await client.query(`
      SELECT *
      FROM sku_matching_results
      WHERE imei = $1
    `, [testImei]);

    if (resultsQuery.rows.length > 0) {
      console.log('SKU Matching Results Data:');
      const result = resultsQuery.rows[0];
      Object.keys(result).forEach(key => {
        console.log(`   ${key}: "${result[key]}"`);
      });
    } else {
      console.log('   No SKU matching results found');
    }

    // Check how the view is constructed
    console.log('\n🔍 SKU Matching View Definition:');
    const viewDefinition = await client.query(`
      SELECT view_definition
      FROM information_schema.views
      WHERE table_name = 'sku_matching_view'
    `);

    if (viewDefinition.rows.length > 0) {
      console.log('View Definition:');
      console.log(viewDefinition.rows[0].view_definition);
    }

    // Check if there are any other tables with device characteristics
    console.log('\n🔍 Checking for device characteristics in other tables:');
    
    const tablesQuery = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE '%item%'
      OR table_name LIKE '%device%'
      OR table_name LIKE '%product%'
      ORDER BY table_name
    `);

    console.log('Potential tables with device data:');
    tablesQuery.rows.forEach(row => {
      console.log(`   ${row.table_name}`);
    });

    // Check the item table structure
    console.log('\n🔍 Item Table Structure:');
    const itemStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'item'
      ORDER BY ordinal_position
    `);

    console.log('Item Table Columns:');
    itemStructure.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check if the IMEI exists in the item table
    console.log('\n🔍 Checking Item Table for IMEI:');
    const itemData = await client.query(`
      SELECT *
      FROM item
      WHERE imei = $1
    `, [testImei]);

    if (itemData.rows.length > 0) {
      console.log('Item Table Data:');
      const item = itemData.rows[0];
      Object.keys(item).forEach(key => {
        console.log(`   ${key}: "${item[key]}"`);
      });
    } else {
      console.log('   IMEI not found in item table');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

debugSkuMatchingViewData();
