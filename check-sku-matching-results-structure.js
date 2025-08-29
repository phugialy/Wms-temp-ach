const { Client } = require('pg');
require('dotenv').config();

async function checkSkuMatchingResultsStructure() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log('\n🔍 CHECKING sku_matching_results TABLE STRUCTURE');
    console.log('===============================================');
    
    // Check if the table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'sku_matching_results'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ sku_matching_results table does not exist');
      return;
    }
    
    console.log('✅ sku_matching_results table exists');
    
    // Get the actual column structure
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'sku_matching_results'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Actual columns in sku_matching_results:');
    columns.rows.forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });
    
    // Check if there are any records
    const recordCount = await client.query(`
      SELECT COUNT(*) as count FROM sku_matching_results
    `);
    
    console.log(`\n📊 Record count: ${recordCount.rows[0].count}`);
    
    // Show a sample record if any exist
    if (recordCount.rows[0].count > 0) {
      const sampleRecord = await client.query(`
        SELECT * FROM sku_matching_results LIMIT 1
      `);
      
      console.log('\n📋 Sample record:');
      Object.entries(sampleRecord.rows[0]).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkSkuMatchingResultsStructure();
