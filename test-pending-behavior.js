const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function testPendingBehavior() {
  const client = await pool.connect();
  try {
    console.log('🔍 Testing PENDING status behavior...');
    
    // Check what working statuses are valid in device_test table
    const deviceTestStatuses = await client.query(`
      SELECT DISTINCT working, COUNT(*) as count
      FROM device_test 
      GROUP BY working
      ORDER BY working
    `);
    
    console.log('📋 Current working statuses in device_test table:');
    deviceTestStatuses.rows.forEach(row => {
      console.log(`  ${row.working}: ${row.count} records`);
    });
    
    // Check what working statuses are in the item table
    const itemStatuses = await client.query(`
      SELECT DISTINCT working, COUNT(*) as count
      FROM item 
      GROUP BY working
      ORDER BY working
    `);
    
    console.log('\n📋 Current working statuses in item table:');
    itemStatuses.rows.forEach(row => {
      console.log(`  ${row.working}: ${row.count} records`);
    });
    
    // Test with different working statuses
    const testCases = [
      { working: 'YES', description: 'Working YES' },
      { working: 'NO', description: 'Working NO' },
      { working: 'PENDING', description: 'Working PENDING' },
      { working: 'UNKNOWN', description: 'Working UNKNOWN' }
    ];
    
    console.log('\n🧪 Testing different working statuses...');
    
    for (const testCase of testCases) {
      console.log(`\n  Testing: ${testCase.description}`);
      
      const testData = {
        imei: `99999999999999${testCases.indexOf(testCase)}`,
        brand: 'Samsung',
        model: 'Galaxy S21',
        working: testCase.working,
        carrier: 'Verizon',
        storage: '256GB',
        color: 'Black',
        serialNumber: `SN-TEST-${testCases.indexOf(testCase)}`,
        batteryHealth: '95',
        batteryCycle: '100',
        notes: 'Test notes',
        TesterName: 'TestTester'
      };
      
      try {
        // Insert into queue
        const insertResult = await client.query(`
          INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `, [testData, 'pending', 'test', 5, 0, 3]);
        
        console.log(`    ✅ Queue insert: ID ${insertResult.rows[0].id}`);
        
        // Process manually (simulating the current logic)
        const data = testData;
        
        // Insert into product table
        await client.query(`
          INSERT INTO product (imei, brand, sku, created_at, updated_at)
          VALUES ($1, $2, $3, NOW(), NOW())
          ON CONFLICT (imei) DO UPDATE SET
            brand = EXCLUDED.brand,
            sku = EXCLUDED.sku,
            updated_at = NOW()
        `, [
          data.imei,
          data.brand,
          data.brand + '-' + data.model + '-' + data.imei.slice(-4)
        ]);
        
        // Insert into item table
        await client.query(`
          INSERT INTO item (
            imei, model, model_number, carrier, capacity, color, 
            battery_health, battery_count, working, location, 
            created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
          ON CONFLICT (imei) DO UPDATE SET
            model = EXCLUDED.model,
            model_number = EXCLUDED.model_number,
            carrier = EXCLUDED.carrier,
            capacity = EXCLUDED.capacity,
            color = EXCLUDED.color,
            battery_health = EXCLUDED.battery_health,
            battery_count = EXCLUDED.battery_count,
            working = EXCLUDED.working,
            location = EXCLUDED.location,
            updated_at = NOW()
        `, [
          data.imei,
          data.model,
          data.serialNumber || data.serialnumber || data.model,
          data.carrier,
          data.storage,
          data.color,
          data.batteryHealth || data.batteryhealth || data.BatteryHealthPercentage,
          data.batteryCycleCount || data.BatteryCycle || data.bcc,
          data.working,
          data.location || 'INCOMING'
        ]);
        
        // Test CURRENT logic (excluding PENDING from device_test)
        console.log(`    📊 Current logic: ${testCase.working === 'PENDING' ? 'EXCLUDED' : 'INCLUDED'} from device_test`);
        
        if (data.working && data.working !== 'PENDING' && data.working !== '') {
          await client.query(`
            INSERT INTO device_test (imei, working, notes, tester, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (imei) DO UPDATE SET
              working = EXCLUDED.working,
              notes = EXCLUDED.notes,
              tester = EXCLUDED.tester,
              created_at = NOW()
          `, [
            data.imei,
            data.working,
            data.notes,
            data.TesterName || data.testerName
          ]);
          console.log(`    ✅ device_test: INSERTED`);
        } else {
          console.log(`    ⚠️  device_test: SKIPPED (current logic excludes PENDING)`);
        }
        
        // Test CORRECT logic (include all working statuses)
        console.log(`    📊 Correct logic: ALL working statuses should be INCLUDED in device_test`);
        
        // Check if device_test record exists
        const deviceTestCheck = await client.query(`
          SELECT imei, working FROM device_test WHERE imei = $1
        `, [data.imei]);
        
        if (deviceTestCheck.rows.length > 0) {
          console.log(`    ✅ device_test exists: ${deviceTestCheck.rows[0].working}`);
        } else {
          console.log(`    ❌ device_test missing for ${testCase.working}`);
        }
        
        // Clean up
        await client.query(`DELETE FROM device_test WHERE imei = $1`, [data.imei]);
        await client.query(`DELETE FROM item WHERE imei = $1`, [data.imei]);
        await client.query(`DELETE FROM product WHERE imei = $1`, [data.imei]);
        await client.query(`DELETE FROM data_queue WHERE id = $1`, [insertResult.rows[0].id]);
        
      } catch (error) {
        console.log(`    ❌ Test failed: ${error.message}`);
      }
    }
    
    console.log('\n📋 Summary:');
    console.log('The current logic EXCLUDES PENDING from device_test table');
    console.log('This is likely INCORRECT - PENDING should be treated normally');
    console.log('PENDING is a valid working status that should be stored in device_test');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

testPendingBehavior();


