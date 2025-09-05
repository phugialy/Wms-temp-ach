const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function verifyTriggerFix() {
  const client = await pool.connect();
  try {
    console.log('🔍 Verifying trigger fix...');
    
    // Get the current function code
    const functionCode = await client.query(`
      SELECT prosrc FROM pg_proc 
      WHERE proname = 'process_data_queue_automatically'
    `);
    
    if (functionCode.rows.length > 0) {
      const code = functionCode.rows[0].prosrc;
      console.log('📋 Current function code:');
      console.log(code);
      
      // Check if Model# is still there
      if (code.includes('Model#')) {
        console.log('\n❌ ISSUE: Model# field access is still present!');
        console.log('   The fix was not applied correctly');
        
        // Find the problematic line
        const lines = code.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('Model#')) {
            console.log(`   Line ${index + 1}: ${line.trim()}`);
          }
        });
      } else {
        console.log('\n✅ Model# field access has been removed');
      }
      
      // Check if the fix is properly applied
      if (code.includes('COALESCE(NEW.raw_data->>\'serialNumber\', NEW.raw_data->>\'serialnumber\', NEW.raw_data->>\'model\')')) {
        console.log('✅ Fix properly applied - using serialNumber/serialnumber/model fallback');
      } else {
        console.log('⚠️  Fix may not be properly applied');
      }
    } else {
      console.log('❌ Function not found');
    }
    
    // Let's try to apply the fix again
    console.log('\n🔧 Re-applying the fix...');
    
    const fixSQL = `
      CREATE OR REPLACE FUNCTION process_data_queue_automatically()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Only process when status changes to 'pending'
        IF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status != 'pending') THEN
          
          -- Insert into product table
          INSERT INTO product (imei, brand, sku, created_at, updated_at)
          VALUES (
            NEW.raw_data->>'imei',
            NEW.raw_data->>'brand',
            NEW.raw_data->>'brand' || '-' || NEW.raw_data->>'model' || '-' || RIGHT(NEW.raw_data->>'imei', 4),
            NOW(),
            NOW()
          )
          ON CONFLICT (imei) DO UPDATE SET
            brand = EXCLUDED.brand,
            sku = EXCLUDED.sku,
            updated_at = NOW();
          
          -- Insert into item table
          INSERT INTO item (
            imei, model, model_number, carrier, capacity, color, 
            battery_health, battery_count, working, location, 
            created_at, updated_at
          )
          VALUES (
            NEW.raw_data->>'imei',
            NEW.raw_data->>'model',
            -- Temporarily removed Model# field access - use serialNumber or model instead
            COALESCE(NEW.raw_data->>'serialNumber', NEW.raw_data->>'serialnumber', NEW.raw_data->>'model'),
            NEW.raw_data->>'carrier',
            NEW.raw_data->>'storage',
            NEW.raw_data->>'color',
            COALESCE(NEW.raw_data->>'batteryHealth', NEW.raw_data->>'batteryhealth', NEW.raw_data->>'BatteryHealthPercentage'),
            COALESCE((NEW.raw_data->>'batteryCycleCount')::integer, (NEW.raw_data->>'BatteryCycle')::integer, (NEW.raw_data->>'bcc')::integer),
            NEW.raw_data->>'working',
            COALESCE(NEW.raw_data->>'location', 'INCOMING'),
            NOW(),
            NOW()
          )
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
            updated_at = NOW();
          
          -- Insert into device_test table ONLY if working status is valid (not PENDING)
          IF NEW.raw_data->>'working' IS NOT NULL 
             AND NEW.raw_data->>'working' != 'PENDING' 
             AND NEW.raw_data->>'working' != '' THEN
            
            INSERT INTO device_test (imei, working, notes, tester, created_at)
            VALUES (
              NEW.raw_data->>'imei',
              NEW.raw_data->>'working',
              NEW.raw_data->>'notes',
              COALESCE(NEW.raw_data->>'TesterName', NEW.raw_data->>'testerName'),
              NOW()
            )
            ON CONFLICT (imei) DO UPDATE SET
              working = EXCLUDED.working,
              notes = EXCLUDED.notes,
              tester = EXCLUDED.tester,
              created_at = NOW();
          END IF;
          
          -- Mark as completed
          UPDATE data_queue 
          SET status = 'completed', processed_at = NOW(), updated_at = NOW()
          WHERE id = NEW.id;
          
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    await client.query(fixSQL);
    console.log('✅ Fix re-applied successfully');
    
    // Test the fix
    console.log('\n🧪 Testing the fix...');
    
    const testData = {
      imei: '222222222222222',
      brand: 'TestBrand',
      model: 'TestModel',
      working: 'YES',
      carrier: 'TestCarrier',
      storage: '256GB',
      color: 'Black',
      serialNumber: 'SN-TEST-123',
      batteryHealth: '95',
      batteryCycle: '100',
      notes: 'CARRIER UNLOCKED',
      TesterName: 'TestTester'
    };
    
    try {
      const result = await client.query(`
        INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [testData, 'pending', 'test', 5, 0, 3]);
      
      console.log(`✅ Test insert successful: ID ${result.rows[0].id}`);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check processing result
      const checkResult = await client.query(`
        SELECT status, processed_at FROM data_queue WHERE id = $1
      `, [result.rows[0].id]);
      
      console.log(`📊 Processing result: ${checkResult.rows[0].status}`);
      
      // Check data insertion
      const productCheck = await client.query(`
        SELECT imei, brand FROM product WHERE imei = $1
      `, [testData.imei]);
      
      const itemCheck = await client.query(`
        SELECT imei, model_number FROM item WHERE imei = $1
      `, [testData.imei]);
      
      console.log(`📊 Product table: ${productCheck.rows.length > 0 ? '✅' : '❌'}`);
      console.log(`📊 Item table: ${itemCheck.rows.length > 0 ? '✅' : '❌'}`);
      
      if (itemCheck.rows.length > 0) {
        console.log(`📊 Model number: ${itemCheck.rows[0].model_number} (expected: ${testData.serialNumber})`);
      }
      
      // Clean up
      await client.query(`DELETE FROM device_test WHERE imei = $1`, [testData.imei]);
      await client.query(`DELETE FROM item WHERE imei = $1`, [testData.imei]);
      await client.query(`DELETE FROM product WHERE imei = $1`, [testData.imei]);
      await client.query(`DELETE FROM data_queue WHERE id = $1`, [result.rows[0].id]);
      
      console.log('✅ Test data cleaned up');
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyTriggerFix();


