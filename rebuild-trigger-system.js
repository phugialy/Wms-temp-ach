const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function rebuildTriggerSystem() {
  const client = await pool.connect();
  try {
    console.log('🔧 Rebuilding trigger system...');
    
    // Step 1: Disable all triggers temporarily
    console.log('\n📋 Step 1: Disabling all triggers...');
    await client.query(`ALTER TABLE data_queue DISABLE TRIGGER ALL`);
    console.log('✅ All triggers disabled');
    
    // Step 2: Drop existing trigger functions
    console.log('\n📋 Step 2: Dropping existing trigger functions...');
    
    const functionsToDrop = [
      'process_data_queue_automatically',
      'process_data_queue_item', 
      'auto_process_queue_items'
    ];
    
    for (const funcName of functionsToDrop) {
      try {
        await client.query(`DROP FUNCTION IF EXISTS ${funcName}()`);
        console.log(`✅ Dropped function: ${funcName}`);
      } catch (error) {
        console.log(`⚠️  Could not drop ${funcName}: ${error.message}`);
      }
    }
    
    // Step 3: Create a clean, simple trigger function
    console.log('\n📋 Step 3: Creating clean trigger function...');
    
    const cleanTriggerFunction = `
      CREATE OR REPLACE FUNCTION process_data_queue_clean()
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
          
          -- Insert into sku_matching_queue for SKU matching
          INSERT INTO sku_matching_queue (imei, status, created_at, updated_at)
          VALUES (NEW.raw_data->>'imei', 'pending', NOW(), NOW())
          ON CONFLICT (imei) DO UPDATE SET
            status = 'pending',
            updated_at = NOW();
          
          -- Mark as completed
          UPDATE data_queue 
          SET status = 'completed', processed_at = NOW(), updated_at = NOW()
          WHERE id = NEW.id;
          
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    await client.query(cleanTriggerFunction);
    console.log('✅ Clean trigger function created');
    
    // Step 4: Drop old triggers
    console.log('\n📋 Step 4: Dropping old triggers...');
    
    const triggersToDrop = [
      'trigger_process_data_queue',
      'trigger_auto_process_data_queue',
      'trigger_update_data_queue_updated_at'
    ];
    
    for (const triggerName of triggersToDrop) {
      try {
        await client.query(`DROP TRIGGER IF EXISTS ${triggerName} ON data_queue`);
        console.log(`✅ Dropped trigger: ${triggerName}`);
      } catch (error) {
        console.log(`⚠️  Could not drop ${triggerName}: ${error.message}`);
      }
    }
    
    // Step 5: Create new, clean triggers
    console.log('\n📋 Step 5: Creating new triggers...');
    
    // Main processing trigger
    await client.query(`
      CREATE TRIGGER trigger_process_data_queue_clean
      AFTER INSERT OR UPDATE ON data_queue
      FOR EACH ROW
      EXECUTE FUNCTION process_data_queue_clean();
    `);
    console.log('✅ Main processing trigger created');
    
    // Updated timestamp trigger
    await client.query(`
      CREATE TRIGGER trigger_update_data_queue_updated_at
      BEFORE UPDATE ON data_queue
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✅ Updated timestamp trigger created');
    
    // Step 6: Test the new system
    console.log('\n📋 Step 6: Testing new trigger system...');
    
    const testData = {
      imei: '111111111111111',
      brand: 'Samsung',
      model: 'Galaxy S21',
      working: 'YES',
      carrier: 'Verizon',
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
      
      const skuQueueCheck = await client.query(`
        SELECT imei, status FROM sku_matching_queue WHERE imei = $1
      `, [testData.imei]);
      
      console.log(`📊 Product table: ${productCheck.rows.length > 0 ? '✅' : '❌'}`);
      console.log(`📊 Item table: ${itemCheck.rows.length > 0 ? '✅' : '❌'}`);
      console.log(`📊 SKU matching queue: ${skuQueueCheck.rows.length > 0 ? '✅' : '❌'}`);
      
      if (itemCheck.rows.length > 0) {
        console.log(`📊 Model number: ${itemCheck.rows[0].model_number} (expected: ${testData.serialNumber})`);
      }
      
      // Clean up
      await client.query(`DELETE FROM device_test WHERE imei = $1`, [testData.imei]);
      await client.query(`DELETE FROM item WHERE imei = $1`, [testData.imei]);
      await client.query(`DELETE FROM product WHERE imei = $1`, [testData.imei]);
      await client.query(`DELETE FROM sku_matching_queue WHERE imei = $1`, [testData.imei]);
      await client.query(`DELETE FROM data_queue WHERE id = $1`, [result.rows[0].id]);
      
      console.log('✅ Test data cleaned up');
      console.log('\n🎉 Trigger system rebuild completed successfully!');
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
      console.log('\n⚠️  Trigger system rebuild failed - will need manual processing');
    }
    
  } catch (error) {
    console.error('❌ Error during rebuild:', error.message);
    
    // Try to re-enable triggers as fallback
    try {
      await client.query(`ALTER TABLE data_queue ENABLE TRIGGER ALL`);
      console.log('✅ Re-enabled all triggers as fallback');
    } catch (e) {
      console.log('⚠️  Could not re-enable triggers');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

rebuildTriggerSystem();


