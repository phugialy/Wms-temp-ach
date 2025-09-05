const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function debugJsonbIssue() {
  const client = await pool.connect();
  try {
    console.log('🔍 Debugging JSONB issue...');
    
    // First, let's check the exact table definition
    const tableDef = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'data_queue' AND column_name = 'raw_data'
    `);
    
    console.log('📋 Table definition:', tableDef.rows[0]);
    
    // Test different ways of inserting JSONB data
    const testData = {
      imei: '999999999999999',
      brand: 'Test',
      model: 'TestModel'
    };
    
    console.log('\n🧪 Testing different insertion methods...');
    
    // Method 1: Direct object
    try {
      console.log('Method 1: Direct object');
      const result1 = await client.query(`
        INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [testData, 'pending', 'test', 5, 0, 3]);
      console.log('✅ Method 1 worked:', result1.rows[0].id);
      await client.query(`DELETE FROM data_queue WHERE id = $1`, [result1.rows[0].id]);
    } catch (error) {
      console.log('❌ Method 1 failed:', error.message);
    }
    
    // Method 2: JSON.stringify
    try {
      console.log('Method 2: JSON.stringify');
      const result2 = await client.query(`
        INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [JSON.stringify(testData), 'pending', 'test', 5, 0, 3]);
      console.log('✅ Method 2 worked:', result2.rows[0].id);
      await client.query(`DELETE FROM data_queue WHERE id = $1`, [result2.rows[0].id]);
    } catch (error) {
      console.log('❌ Method 2 failed:', error.message);
    }
    
    // Method 3: Cast to JSONB
    try {
      console.log('Method 3: Cast to JSONB');
      const result3 = await client.query(`
        INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
        VALUES ($1::jsonb, $2, $3, $4, $5, $6)
        RETURNING id
      `, [JSON.stringify(testData), 'pending', 'test', 5, 0, 3]);
      console.log('✅ Method 3 worked:', result3.rows[0].id);
      await client.query(`DELETE FROM data_queue WHERE id = $1`, [result3.rows[0].id]);
    } catch (error) {
      console.log('❌ Method 3 failed:', error.message);
    }
    
    // Check if the issue is in the trigger function
    console.log('\n🔍 Checking trigger function...');
    
    // Get the trigger function and check for any issues
    const triggerFunction = await client.query(`
      SELECT prosrc FROM pg_proc 
      WHERE proname = 'process_data_queue_automatically'
    `);
    
    if (triggerFunction.rows.length > 0) {
      const functionCode = triggerFunction.rows[0].prosrc;
      
      // Look for any problematic lines
      const lines = functionCode.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('NEW.raw_data->>') && line.includes('Model#')) {
          console.log(`⚠️  Potential issue at line ${index + 1}: ${line.trim()}`);
          console.log('   The Model# field might be causing issues due to the # character');
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

debugJsonbIssue();


