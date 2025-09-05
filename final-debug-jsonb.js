const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function finalDebugJsonb() {
  const client = await pool.connect();
  try {
    console.log('🔍 Final JSONB debugging...');
    
    // Let's check the exact data type and content
    const sampleRecord = await client.query(`
      SELECT 
        id,
        raw_data,
        pg_typeof(raw_data) as data_type,
        raw_data::text as raw_data_text
      FROM data_queue 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (sampleRecord.rows.length > 0) {
      const record = sampleRecord.rows[0];
      console.log('📋 Sample record analysis:');
      console.log(`  ID: ${record.id}`);
      console.log(`  Data type: ${record.data_type}`);
      console.log(`  Raw data type: ${typeof record.raw_data}`);
      console.log(`  Raw data text: ${record.raw_data_text.substring(0, 200)}...`);
      
      // Check if it's actually JSONB
      if (record.data_type === 'jsonb') {
        console.log('✅ Data is correctly stored as JSONB');
        
        // Test direct JSONB access
        try {
          const testAccess = await client.query(`
            SELECT raw_data->>'imei' as imei, raw_data->>'brand' as brand
            FROM data_queue 
            WHERE id = $1
          `, [record.id]);
          
          console.log('✅ Direct JSONB access works:', testAccess.rows[0]);
        } catch (error) {
          console.log('❌ Direct JSONB access failed:', error.message);
        }
      } else {
        console.log(`❌ Data is stored as ${record.data_type}, not JSONB!`);
      }
    }
    
    // The issue might be that the trigger is being called with a different data type
    // Let's check if there's a type conversion issue
    console.log('\n🧪 Testing type conversion...');
    
    const testData = {
      imei: '111111111111111',
      brand: 'TestBrand',
      model: 'TestModel'
    };
    
    // Test 1: Insert as object
    try {
      console.log('Test 1: Insert as object');
      const result1 = await client.query(`
        INSERT INTO data_queue (raw_data, status, source)
        VALUES ($1, $2, $3)
        RETURNING id, pg_typeof(raw_data) as data_type
      `, [testData, 'pending', 'test']);
      
      console.log(`✅ Object insert: ID ${result1.rows[0].id}, Type: ${result1.rows[0].data_type}`);
      
      // Test JSONB access on this record
      const accessTest = await client.query(`
        SELECT raw_data->>'imei' as imei FROM data_queue WHERE id = $1
      `, [result1.rows[0].id]);
      
      console.log(`✅ JSONB access: ${accessTest.rows[0].imei}`);
      
      await client.query(`DELETE FROM data_queue WHERE id = $1`, [result1.rows[0].id]);
      
    } catch (error) {
      console.log(`❌ Object insert failed: ${error.message}`);
    }
    
    // Test 2: Insert as string
    try {
      console.log('Test 2: Insert as string');
      const result2 = await client.query(`
        INSERT INTO data_queue (raw_data, status, source)
        VALUES ($1, $2, $3)
        RETURNING id, pg_typeof(raw_data) as data_type
      `, [JSON.stringify(testData), 'pending', 'test']);
      
      console.log(`✅ String insert: ID ${result2.rows[0].id}, Type: ${result2.rows[0].data_type}`);
      
      // Test JSONB access on this record
      const accessTest = await client.query(`
        SELECT raw_data->>'imei' as imei FROM data_queue WHERE id = $1
      `, [result2.rows[0].id]);
      
      console.log(`✅ JSONB access: ${accessTest.rows[0].imei}`);
      
      await client.query(`DELETE FROM data_queue WHERE id = $1`, [result2.rows[0].id]);
      
    } catch (error) {
      console.log(`❌ String insert failed: ${error.message}`);
    }
    
    // The issue might be in the trigger function itself
    // Let's check if there's a syntax error in the trigger
    console.log('\n🔍 Checking trigger function syntax...');
    
    try {
      // Try to create a simple test trigger
      await client.query(`
        CREATE OR REPLACE FUNCTION test_simple_trigger()
        RETURNS TRIGGER AS $$
        BEGIN
          -- Just test basic access
          PERFORM NEW.raw_data->>'imei';
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);
      
      console.log('✅ Simple test trigger created');
      
      // Test it
      const result3 = await client.query(`
        INSERT INTO data_queue (raw_data, status, source)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [testData, 'pending', 'test']);
      
      console.log(`✅ Simple trigger test: ID ${result3.rows[0].id}`);
      
      // Clean up
      await client.query(`DELETE FROM data_queue WHERE id = $1`, [result3.rows[0].id]);
      await client.query(`DROP FUNCTION test_simple_trigger()`);
      
    } catch (error) {
      console.log(`❌ Simple trigger test failed: ${error.message}`);
    }
    
    // Let's check if the issue is with the specific fields we're accessing
    console.log('\n🔍 Testing specific field access...');
    
    const testDataWithAllFields = {
      imei: '999999999999999',
      brand: 'TestBrand',
      model: 'TestModel',
      working: 'YES',
      carrier: 'TestCarrier',
      storage: '256GB',
      color: 'Black',
      serialNumber: 'SN123',
      serialnumber: 'SN456',
      batteryHealth: '95',
      batteryhealth: '90',
      BatteryHealthPercentage: '85',
      batteryCycleCount: '100',
      BatteryCycle: '150',
      bcc: '200',
      location: 'TEST',
      notes: 'Test notes',
      TesterName: 'TestTester',
      testerName: 'TestTester2'
    };
    
    try {
      const result4 = await client.query(`
        INSERT INTO data_queue (raw_data, status, source)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [testDataWithAllFields, 'pending', 'test']);
      
      console.log(`✅ All fields insert: ID ${result4.rows[0].id}`);
      
      // Test each field access individually
      const fieldTests = [
        'imei', 'brand', 'model', 'working', 'carrier', 'storage', 'color',
        'serialNumber', 'serialnumber', 'batteryHealth', 'batteryhealth',
        'BatteryHealthPercentage', 'batteryCycleCount', 'BatteryCycle', 'bcc',
        'location', 'notes', 'TesterName', 'testerName'
      ];
      
      for (const field of fieldTests) {
        try {
          const fieldTest = await client.query(`
            SELECT raw_data->>$1 as value FROM data_queue WHERE id = $2
          `, [field, result4.rows[0].id]);
          
          console.log(`✅ Field ${field}: ${fieldTest.rows[0].value}`);
        } catch (error) {
          console.log(`❌ Field ${field} failed: ${error.message}`);
        }
      }
      
      // Clean up
      await client.query(`DELETE FROM data_queue WHERE id = $1`, [result4.rows[0].id]);
      
    } catch (error) {
      console.log(`❌ All fields insert failed: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

finalDebugJsonb();


