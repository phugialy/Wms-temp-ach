const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function testQueueFix() {
  const client = await pool.connect();
  try {
    console.log('🧪 Testing queue fix...');
    
    const testData = {
      imei: '999999999999999',
      brand: 'Test',
      model: 'TestModel',
      working: 'YES',
      carrier: 'TestCarrier',
      storage: '256GB',
      color: 'Black'
    };
    
    console.log('📋 Test data:', testData);
    
    // Test the fixed insertion
    const result = await client.query(`
      INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, status, created_at
    `, [
      testData, // Pass as JSONB object directly
      'pending',
      'test',
      5,
      0,
      3
    ]);
    
    console.log('✅ Test record inserted successfully:', result.rows[0]);
    
    // Wait a moment for trigger to process
    console.log('⏳ Waiting for trigger to process...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if it was processed
    const checkResult = await client.query(`
      SELECT id, status, processed_at FROM data_queue WHERE id = $1
    `, [result.rows[0].id]);
    
    console.log('📋 Test record status after processing:', checkResult.rows[0]);
    
    // Check if data was inserted into other tables
    const productCheck = await client.query(`
      SELECT imei, brand, sku FROM product WHERE imei = $1
    `, [testData.imei]);
    
    const itemCheck = await client.query(`
      SELECT imei, model, working FROM item WHERE imei = $1
    `, [testData.imei]);
    
    const deviceTestCheck = await client.query(`
      SELECT imei, working FROM device_test WHERE imei = $1
    `, [testData.imei]);
    
    console.log('\n📊 Data insertion results:');
    console.log(`  Product table: ${productCheck.rows.length > 0 ? '✅' : '❌'}`);
    console.log(`  Item table: ${itemCheck.rows.length > 0 ? '✅' : '❌'}`);
    console.log(`  Device test table: ${deviceTestCheck.rows.length > 0 ? '✅' : '❌'}`);
    
    if (productCheck.rows.length > 0) {
      console.log('  Product data:', productCheck.rows[0]);
    }
    if (itemCheck.rows.length > 0) {
      console.log('  Item data:', itemCheck.rows[0]);
    }
    if (deviceTestCheck.rows.length > 0) {
      console.log('  Device test data:', deviceTestCheck.rows[0]);
    }
    
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await client.query(`DELETE FROM device_test WHERE imei = $1`, [testData.imei]);
    await client.query(`DELETE FROM item WHERE imei = $1`, [testData.imei]);
    await client.query(`DELETE FROM product WHERE imei = $1`, [testData.imei]);
    await client.query(`DELETE FROM data_queue WHERE id = $1`, [result.rows[0].id]);
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

testQueueFix();


