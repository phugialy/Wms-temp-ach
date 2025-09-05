const { Pool } = require('pg');
require('dotenv').config();

async function checkSkuMaster() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL,
    max: 1,
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 30000,
  });
  
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking sku_master table...');
    
    // Check if table exists and has data
    const countResult = await client.query('SELECT COUNT(*) FROM sku_master');
    console.log('📊 Total SKUs in sku_master:', countResult.rows[0].count);
    
    // Check table structure
    const structureResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sku_master' 
      ORDER BY ordinal_position
    `);
    console.log('🏗️ Table structure:');
    structureResult.rows.forEach(row => {
      console.log('  -', row.column_name, ':', row.data_type);
    });
    
    // Check if there are any SKUs with tags
    const tagsResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM sku_master 
      WHERE sku_tags IS NOT NULL AND array_length(sku_tags, 1) > 0
    `);
    console.log('🏷️ SKUs with tags:', tagsResult.rows[0].count);
    
    // Show sample data if any exists
    const sampleResult = await client.query(`
      SELECT sku_code, sku_tags, brand, model, capacity, color, carrier 
      FROM sku_master 
      LIMIT 5
    `);
    
    if (sampleResult.rows.length > 0) {
      console.log('📋 Sample SKUs:');
      sampleResult.rows.forEach((row, i) => {
        console.log(`  ${i+1}. ${row.sku_code}`);
        console.log(`     Tags: ${JSON.stringify(row.sku_tags)}`);
        console.log(`     Brand: ${row.brand}, Model: ${row.model}`);
      });
    } else {
      console.log('❌ No SKUs found in sku_master table');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSkuMaster();
