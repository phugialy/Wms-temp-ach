const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function fixRootCause() {
  const client = await pool.connect();
  try {
    console.log('🔍 Investigating root cause...');
    
    // Check how the data is actually being stored
    const recentRecord = await client.query(`
      SELECT id, raw_data, pg_typeof(raw_data) as data_type
      FROM data_queue 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (recentRecord.rows.length > 0) {
      console.log('📋 Recent record analysis:');
      console.log(`  ID: ${recentRecord.rows[0].id}`);
      console.log(`  Data type: ${recentRecord.rows[0].data_type}`);
      console.log(`  Raw data type: ${typeof recentRecord.rows[0].raw_data}`);
      
      if (typeof recentRecord.rows[0].raw_data === 'string') {
        console.log('⚠️  ISSUE FOUND: raw_data is stored as string, not JSONB!');
        console.log('   This means the data is being stringified somewhere');
      }
    }
    
    // Test different insertion methods to find the correct one
    console.log('\n🧪 Testing different insertion methods...');
    
    const testData = {
      imei: '777777777777777',
      brand: 'TestBrand',
      model: 'TestModel'
    };
    
    // Method 1: Direct object (what we're currently doing)
    try {
      console.log('Method 1: Direct object insertion');
      const result1 = await client.query(`
        INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, pg_typeof(raw_data) as data_type
      `, [testData, 'pending', 'test', 5, 0, 3]);
      
      console.log(`✅ Method 1: ID ${result1.rows[0].id}, Type: ${result1.rows[0].data_type}`);
      await client.query(`DELETE FROM data_queue WHERE id = $1`, [result1.rows[0].id]);
    } catch (error) {
      console.log(`❌ Method 1 failed: ${error.message}`);
    }
    
    // Method 2: Explicit JSONB cast
    try {
      console.log('Method 2: Explicit JSONB cast');
      const result2 = await client.query(`
        INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
        VALUES ($1::jsonb, $2, $3, $4, $5, $6)
        RETURNING id, pg_typeof(raw_data) as data_type
      `, [JSON.stringify(testData), 'pending', 'test', 5, 0, 3]);
      
      console.log(`✅ Method 2: ID ${result2.rows[0].id}, Type: ${result2.rows[0].data_type}`);
      await client.query(`DELETE FROM data_queue WHERE id = $1`, [result2.rows[0].id]);
    } catch (error) {
      console.log(`❌ Method 2 failed: ${error.message}`);
    }
    
    // Method 3: Using to_jsonb function
    try {
      console.log('Method 3: Using to_jsonb function');
      const result3 = await client.query(`
        INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
        VALUES (to_jsonb($1), $2, $3, $4, $5, $6)
        RETURNING id, pg_typeof(raw_data) as data_type
      `, [testData, 'pending', 'test', 5, 0, 3]);
      
      console.log(`✅ Method 3: ID ${result3.rows[0].id}, Type: ${result3.rows[0].data_type}`);
      await client.query(`DELETE FROM data_queue WHERE id = $1`, [result3.rows[0].id]);
    } catch (error) {
      console.log(`❌ Method 3 failed: ${error.message}`);
    }
    
    // The issue might be that we need to disable the trigger temporarily
    console.log('\n🔧 Testing without trigger...');
    
    try {
      // Disable the trigger
      await client.query(`ALTER TABLE data_queue DISABLE TRIGGER trigger_process_data_queue`);
      console.log('✅ Trigger disabled');
      
      // Test insertion without trigger
      const result4 = await client.query(`
        INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, pg_typeof(raw_data) as data_type
      `, [testData, 'pending', 'test', 5, 0, 3]);
      
      console.log(`✅ Insert without trigger: ID ${result4.rows[0].id}, Type: ${result4.rows[0].data_type}`);
      
      // Re-enable the trigger
      await client.query(`ALTER TABLE data_queue ENABLE TRIGGER trigger_process_data_queue`);
      console.log('✅ Trigger re-enabled');
      
      // Clean up
      await client.query(`DELETE FROM data_queue WHERE id = $1`, [result4.rows[0].id]);
      
    } catch (error) {
      console.log(`❌ Trigger disable test failed: ${error.message}`);
      // Make sure to re-enable trigger
      try {
        await client.query(`ALTER TABLE data_queue ENABLE TRIGGER trigger_process_data_queue`);
      } catch (e) {
        // Ignore
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixRootCause();


