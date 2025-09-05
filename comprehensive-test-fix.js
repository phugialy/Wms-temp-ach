const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function comprehensiveTestFix() {
  const client = await pool.connect();
  try {
    console.log('🧪 Comprehensive testing of the fix...');
    
    // Test 1: Basic functionality with different working statuses
    console.log('\n📋 Test 1: Different working statuses');
    
    const testCases = [
      {
        name: 'Working YES',
        data: {
          imei: '111111111111111',
          brand: 'Samsung',
          model: 'Galaxy S21',
          working: 'YES',
          carrier: 'Verizon',
          storage: '256GB',
          color: 'Black',
          serialNumber: 'SN123456',
          batteryHealth: '95',
          batteryCycle: '100',
          notes: 'CARRIER UNLOCKED',
          TesterName: 'TestTester'
        }
      },
      {
        name: 'Working NO',
        data: {
          imei: '222222222222222',
          brand: 'Samsung',
          model: 'Galaxy S21',
          working: 'NO',
          carrier: 'AT&T',
          storage: '128GB',
          color: 'White',
          serialNumber: 'SN789012',
          batteryHealth: '80',
          batteryCycle: '500',
          notes: 'CARRIER LOCKED',
          TesterName: 'TestTester2'
        }
      },
      {
        name: 'Working PENDING',
        data: {
          imei: '333333333333333',
          brand: 'Samsung',
          model: 'Galaxy S21',
          working: 'PENDING',
          carrier: 'T-Mobile',
          storage: '512GB',
          color: 'Blue',
          serialNumber: 'SN345678',
          batteryHealth: '90',
          batteryCycle: '200',
          notes: 'N/A',
          TesterName: 'TestTester3'
        }
      }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
      console.log(`\n  Testing: ${testCase.name}`);
      
      try {
        // Insert into queue
        const insertResult = await client.query(`
          INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, status
        `, [
          testCase.data,
          'pending',
          'test',
          5, 0, 3
        ]);
        
        console.log(`    ✅ Queue insert successful: ID ${insertResult.rows[0].id}`);
        
        // Wait for trigger processing
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check queue status
        const queueStatus = await client.query(`
          SELECT status, processed_at FROM data_queue WHERE id = $1
        `, [insertResult.rows[0].id]);
        
        console.log(`    📊 Queue status: ${queueStatus.rows[0].status}`);
        
        // Check data insertion
        const productCheck = await client.query(`
          SELECT imei, brand, sku FROM product WHERE imei = $1
        `, [testCase.data.imei]);
        
        const itemCheck = await client.query(`
          SELECT imei, model, model_number, working FROM item WHERE imei = $1
        `, [testCase.data.imei]);
        
        const deviceTestCheck = await client.query(`
          SELECT imei, working, tester FROM device_test WHERE imei = $1
        `, [testCase.data.imei]);
        
        console.log(`    📊 Product table: ${productCheck.rows.length > 0 ? '✅' : '❌'}`);
        console.log(`    📊 Item table: ${itemCheck.rows.length > 0 ? '✅' : '❌'}`);
        console.log(`    📊 Device test table: ${deviceTestCheck.rows.length > 0 ? '✅' : '❌'}`);
        
        // Verify PENDING handling
        if (testCase.data.working === 'PENDING') {
          if (deviceTestCheck.rows.length === 0) {
            console.log(`    ✅ PENDING correctly excluded from device_test`);
          } else {
            console.log(`    ❌ PENDING incorrectly included in device_test`);
          }
        } else {
          if (deviceTestCheck.rows.length > 0) {
            console.log(`    ✅ ${testCase.data.working} correctly included in device_test`);
          } else {
            console.log(`    ❌ ${testCase.data.working} incorrectly excluded from device_test`);
          }
        }
        
        // Store results for cleanup
        results.push({
          id: insertResult.rows[0].id,
          imei: testCase.data.imei
        });
        
      } catch (error) {
        console.log(`    ❌ Test failed: ${error.message}`);
      }
    }
    
    // Test 2: Field mapping verification
    console.log('\n📋 Test 2: Field mapping verification');
    
    const mappingTest = {
      imei: '444444444444444',
      brand: 'Apple',
      model: 'iPhone 13',
      working: 'YES',
      carrier: 'Unlocked',
      storage: '256GB',
      color: 'Blue',
      serialNumber: 'SN-MAPPING-TEST',
      batteryHealth: '98',
      batteryCycle: '50',
      notes: 'CARRIER UNLOCKED',
      TesterName: 'MappingTester',
      location: 'TEST-LOCATION'
    };
    
    try {
      const insertResult = await client.query(`
        INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [mappingTest, 'pending', 'test', 5, 0, 3]);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify all field mappings
      const itemData = await client.query(`
        SELECT * FROM item WHERE imei = $1
      `, [mappingTest.imei]);
      
      if (itemData.rows.length > 0) {
        const item = itemData.rows[0];
        console.log('    📊 Field mapping verification:');
        console.log(`      Model: ${item.model} (expected: ${mappingTest.model})`);
        console.log(`      Model Number: ${item.model_number} (expected: ${mappingTest.serialNumber})`);
        console.log(`      Carrier: ${item.carrier} (expected: ${mappingTest.carrier})`);
        console.log(`      Capacity: ${item.capacity} (expected: ${mappingTest.storage})`);
        console.log(`      Color: ${item.color} (expected: ${mappingTest.color})`);
        console.log(`      Battery Health: ${item.battery_health} (expected: ${mappingTest.batteryHealth})`);
        console.log(`      Battery Count: ${item.battery_count} (expected: ${mappingTest.batteryCycle})`);
        console.log(`      Working: ${item.working} (expected: ${mappingTest.working})`);
        console.log(`      Location: ${item.location} (expected: ${mappingTest.location})`);
      }
      
      results.push({
        id: insertResult.rows[0].id,
        imei: mappingTest.imei
      });
      
    } catch (error) {
      console.log(`    ❌ Mapping test failed: ${error.message}`);
    }
    
    // Test 3: Bulk processing simulation
    console.log('\n📋 Test 3: Bulk processing simulation');
    
    const bulkTestData = [];
    for (let i = 0; i < 5; i++) {
      bulkTestData.push({
        imei: `55555555555555${i}`,
        brand: 'Samsung',
        model: 'Galaxy S22',
        working: i % 2 === 0 ? 'YES' : 'NO',
        carrier: 'Verizon',
        storage: '256GB',
        color: 'Black',
        serialNumber: `SN-BULK-${i}`,
        batteryHealth: '90',
        batteryCycle: '100',
        notes: 'CARRIER UNLOCKED',
        TesterName: 'BulkTester'
      });
    }
    
    try {
      let bulkSuccess = 0;
      for (const data of bulkTestData) {
        const insertResult = await client.query(`
          INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `, [data, 'pending', 'test', 5, 0, 3]);
        
        results.push({
          id: insertResult.rows[0].id,
          imei: data.imei
        });
        bulkSuccess++;
      }
      
      console.log(`    ✅ Bulk insert successful: ${bulkSuccess}/5 items`);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check processing results
      const processedCount = await client.query(`
        SELECT COUNT(*) as count FROM data_queue 
        WHERE id IN (${results.slice(-5).map(r => r.id).join(',')}) 
        AND status = 'completed'
      `);
      
      console.log(`    📊 Bulk processing: ${processedCount.rows[0].count}/5 completed`);
      
    } catch (error) {
      console.log(`    ❌ Bulk test failed: ${error.message}`);
    }
    
    // Cleanup all test data
    console.log('\n🧹 Cleaning up test data...');
    
    for (const result of results) {
      try {
        await client.query(`DELETE FROM device_test WHERE imei = $1`, [result.imei]);
        await client.query(`DELETE FROM item WHERE imei = $1`, [result.imei]);
        await client.query(`DELETE FROM product WHERE imei = $1`, [result.imei]);
        await client.query(`DELETE FROM data_queue WHERE id = $1`, [result.id]);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    console.log('✅ Test data cleaned up');
    console.log('\n🎉 Comprehensive testing completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

comprehensiveTestFix();


