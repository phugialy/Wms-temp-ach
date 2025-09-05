const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function checkFailedRecords() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking for failed records...');
    
    // Check failed records
    const failedRecords = await client.query(`
      SELECT id, status, error_message, created_at, raw_data->>'imei' as imei
      FROM data_queue 
      WHERE status = 'failed'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`📊 Found ${failedRecords.rows.length} failed records:`);
    failedRecords.rows.forEach((record, index) => {
      console.log(`${index + 1}. ID: ${record.id}, IMEI: ${record.imei}`);
      console.log(`   Status: ${record.status}`);
      console.log(`   Error: ${record.error_message}`);
      console.log(`   Created: ${record.created_at}`);
      console.log('');
    });
    
    // Check recent records
    const recentRecords = await client.query(`
      SELECT id, status, created_at, raw_data->>'imei' as imei, raw_data->>'working' as working
      FROM data_queue 
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log('📋 Recent records:');
    recentRecords.rows.forEach((record, index) => {
      console.log(`${index + 1}. ID: ${record.id}, IMEI: ${record.imei}, Working: ${record.working}`);
      console.log(`   Status: ${record.status}, Created: ${record.created_at}`);
    });
    
    // Test the trigger manually with a simple record
    console.log('\n🧪 Testing trigger with simple record...');
    
    const testData = {
      imei: '999999999999999',
      brand: 'Test',
      model: 'TestModel',
      working: 'YES',
      carrier: 'TestCarrier',
      storage: '256GB',
      color: 'Black'
    };
    
    try {
      const result = await client.query(`
        INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, status
      `, [
        JSON.stringify(testData),
        'pending',
        'test',
        5,
        0,
        3
      ]);
      
      console.log('✅ Test record inserted successfully:', result.rows[0]);
      
      // Check if it was processed
      setTimeout(async () => {
        const checkResult = await client.query(`
          SELECT id, status, processed_at FROM data_queue WHERE id = $1
        `, [result.rows[0].id]);
        
        console.log('📋 Test record status after processing:', checkResult.rows[0]);
        
        // Clean up test record
        await client.query(`DELETE FROM data_queue WHERE id = $1`, [result.rows[0].id]);
        console.log('🧹 Test record cleaned up');
      }, 1000);
      
    } catch (error) {
      console.log('❌ Test record insertion failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkFailedRecords();


