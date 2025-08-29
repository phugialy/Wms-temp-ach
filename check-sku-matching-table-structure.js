const { Client } = require('pg');
require('dotenv').config();

async function checkTableStructure() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log('\n📋 SKU MATCHING RESULTS TABLE STRUCTURE:');
    console.log('==========================================');

    // Check table structure
    const structureResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'sku_matching_results'
      ORDER BY ordinal_position
    `);

    console.log('\n📊 Columns in sku_matching_results:');
    structureResult.rows.forEach(row => {
      console.log(`   ${row.column_name} (${row.data_type}) ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Check if table exists and has data
    const countResult = await client.query(`
      SELECT COUNT(*) as total_rows 
      FROM sku_matching_results
    `);

    console.log(`\n📈 Total rows in sku_matching_results: ${countResult.rows[0].total_rows}`);

    // Check sample data
    const sampleResult = await client.query(`
      SELECT * FROM sku_matching_results LIMIT 3
    `);

    if (sampleResult.rows.length > 0) {
      console.log('\n📋 Sample data:');
      console.log(JSON.stringify(sampleResult.rows[0], null, 2));
    }

    // Check sku_matching_view structure
    console.log('\n📋 SKU MATCHING VIEW STRUCTURE:');
    console.log('=================================');

    const viewStructureResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'sku_matching_view'
      ORDER BY ordinal_position
    `);

    console.log('\n📊 Columns in sku_matching_view:');
    viewStructureResult.rows.forEach(row => {
      console.log(`   ${row.column_name} (${row.data_type}) ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkTableStructure();
