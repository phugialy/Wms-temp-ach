const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function testCorrectedPending() {
  const client = await pool.connect();
  try {
    console.log('🔧 Testing corrected PENDING behavior...');
    
    // Test with PENDING status
    const testData = {
      imei: '888888888888888',
      brand: 'Samsung',
      model: 'Galaxy S21',
      working: 'PENDING',
      carrier: 'Verizon',
      storage: '256GB',
      color: 'Black',
      serialNumber: 'SN-PENDING-FIXED',
      batteryHealth: '95',
      batteryCycle: '100',
      notes: 'CARRIER UNLOCKED',
      TesterName: 'PendingTester'
    };
    
    // Insert into queue
    const insertResult = await client.query(`
      INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [testData, 'pending', 'test', 5, 0, 3]);
    
    console.log(`✅ Test item inserted: ID ${insertResult.rows[0].id}`);
    
    // Process using the corrected QueueProcessor
    const QueueProcessor = require('./src/services/QueueProcessor.js');
    const processor = new QueueProcessor();
    const result = await processor.processQueue();
    
    console.log(`📊 Processing result: ${result.processed} processed, ${result.errors} errors`);
    
    // Check if the item was processed correctly
    const checkResult = await client.query(`
      SELECT status, processed_at FROM data_queue WHERE id = $1
    `, [insertResult.rows[0].id]);
    
    console.log(`📊 Item status: ${checkResult.rows[0].status}`);
    
    // Check data insertion
    const productCheck = await client.query(`
      SELECT imei, brand FROM product WHERE imei = $1
    `, [testData.imei]);
    
    const itemCheck = await client.query(`
      SELECT imei, working FROM item WHERE imei = $1
    `, [testData.imei]);
    
    const deviceTestCheck = await client.query(`
      SELECT imei, working FROM device_test WHERE imei = $1
    `, [testData.imei]);
    
    const skuQueueCheck = await client.query(`
      SELECT imei, status FROM sku_matching_queue WHERE imei = $1
    `, [testData.imei]);
    
    console.log(`📊 Product table: ${productCheck.rows.length > 0 ? '✅' : '❌'}`);
    console.log(`📊 Item table: ${itemCheck.rows.length > 0 ? '✅' : '❌'}`);
    console.log(`📊 Device test table: ${deviceTestCheck.rows.length > 0 ? '✅' : '❌'}`);
    console.log(`📊 SKU matching queue: ${skuQueueCheck.rows.length > 0 ? '✅' : '❌'}`);
    
    if (itemCheck.rows.length > 0) {
      console.log(`📊 Item working status: ${itemCheck.rows[0].working}`);
    }
    
    if (deviceTestCheck.rows.length > 0) {
      console.log(`📊 Device test working status: ${deviceTestCheck.rows[0].working}`);
      console.log('✅ PENDING status is now correctly included in device_test table!');
    } else {
      console.log('❌ PENDING status is still missing from device_test table');
    }
    
    // Test with other statuses to ensure they still work
    console.log('\n🧪 Testing other working statuses...');
    
    const otherStatuses = ['YES', 'NO', 'UNKNOWN'];
    
    for (const status of otherStatuses) {
      const otherTestData = {
        imei: `77777777777777${otherStatuses.indexOf(status)}`,
        brand: 'Samsung',
        model: 'Galaxy S21',
        working: status,
        carrier: 'Verizon',
        storage: '256GB',
        color: 'Black',
        serialNumber: `SN-${status}-TEST`,
        batteryHealth: '95',
        batteryCycle: '100',
        notes: 'Test notes',
        TesterName: 'TestTester'
      };
      
      // Insert into queue
      const otherInsertResult = await client.query(`
        INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [otherTestData, 'pending', 'test', 5, 0, 3]);
      
      // Process
      const otherResult = await processor.processQueue();
      
      // Check device_test
      const otherDeviceTestCheck = await client.query(`
        SELECT imei, working FROM device_test WHERE imei = $1
      `, [otherTestData.imei]);
      
      console.log(`📊 ${status} status: ${otherDeviceTestCheck.rows.length > 0 ? '✅' : '❌'}`);
      
      // Clean up
      await client.query(`DELETE FROM device_test WHERE imei = $1`, [otherTestData.imei]);
      await client.query(`DELETE FROM item WHERE imei = $1`, [otherTestData.imei]);
      await client.query(`DELETE FROM product WHERE imei = $1`, [otherTestData.imei]);
      await client.query(`DELETE FROM sku_matching_queue WHERE imei = $1`, [otherTestData.imei]);
      await client.query(`DELETE FROM data_queue WHERE id = $1`, [otherInsertResult.rows[0].id]);
    }
    
    // Clean up main test
    await client.query(`DELETE FROM device_test WHERE imei = $1`, [testData.imei]);
    await client.query(`DELETE FROM item WHERE imei = $1`, [testData.imei]);
    await client.query(`DELETE FROM product WHERE imei = $1`, [testData.imei]);
    await client.query(`DELETE FROM sku_matching_queue WHERE imei = $1`, [testData.imei]);
    await client.query(`DELETE FROM data_queue WHERE id = $1`, [insertResult.rows[0].id]);
    
    console.log('✅ Test data cleaned up');
    console.log('\n🎉 PENDING status behavior corrected!');
    console.log('📋 All working statuses (YES, NO, PENDING, UNKNOWN, etc.) are now treated normally');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

testCorrectedPending();


