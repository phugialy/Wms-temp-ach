const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function checkDataQueueStructure() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking data_queue table structure...');
    
    // Check the raw_data column type
    const columnInfo = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'data_queue' AND column_name = 'raw_data'
    `);
    
    if (columnInfo.rows.length > 0) {
      const column = columnInfo.rows[0];
      console.log('📋 raw_data column info:');
      console.log(`  Type: ${column.data_type}`);
      console.log(`  Nullable: ${column.is_nullable}`);
      
      if (column.data_type === 'text') {
        console.log('⚠️  ISSUE FOUND: raw_data is TEXT, not JSONB!');
        console.log('   This causes the ->> operator to fail');
        console.log('   Need to change it to JSONB type');
      } else if (column.data_type === 'jsonb') {
        console.log('✅ raw_data is correctly JSONB type');
      } else {
        console.log(`⚠️  Unexpected type: ${column.data_type}`);
      }
    } else {
      console.log('❌ raw_data column not found');
    }
    
    // Check if there are any existing records
    const recordCount = await client.query(`
      SELECT COUNT(*) as count FROM data_queue
    `);
    
    console.log(`\n📊 Current records in data_queue: ${recordCount.rows[0].count}`);
    
    // Check a sample record if any exist
    if (recordCount.rows[0].count > 0) {
      const sampleRecord = await client.query(`
        SELECT id, raw_data, status, created_at
        FROM data_queue 
        ORDER BY created_at DESC 
        LIMIT 1
      `);
      
      console.log('\n📋 Sample record:');
      console.log(`  ID: ${sampleRecord.rows[0].id}`);
      console.log(`  Status: ${sampleRecord.rows[0].status}`);
      console.log(`  Created: ${sampleRecord.rows[0].created_at}`);
      console.log(`  Raw data type: ${typeof sampleRecord.rows[0].raw_data}`);
      
      if (typeof sampleRecord.rows[0].raw_data === 'string') {
        console.log('⚠️  Raw data is stored as string, not JSON object');
        try {
          const parsed = JSON.parse(sampleRecord.rows[0].raw_data);
          console.log('✅ Raw data can be parsed as JSON');
        } catch (e) {
          console.log('❌ Raw data cannot be parsed as JSON');
        }
      } else {
        console.log('✅ Raw data is stored as JSON object');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkDataQueueStructure();


