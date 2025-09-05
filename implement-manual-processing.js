const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function implementManualProcessing() {
  const client = await pool.connect();
  try {
    console.log('🔧 Implementing manual processing solution...');
    
    // Step 1: Disable the problematic trigger
    console.log('\n📋 Step 1: Disabling problematic trigger...');
    
    try {
      await client.query(`DROP TRIGGER IF EXISTS trigger_process_data_queue_simple ON data_queue`);
      console.log('✅ Problematic trigger disabled');
    } catch (error) {
      console.log(`⚠️  Could not disable trigger: ${error.message}`);
    }
    
    // Step 2: Create a manual processing function
    console.log('\n📋 Step 2: Creating manual processing function...');
    
    const manualProcessingFunction = `
      CREATE OR REPLACE FUNCTION process_queue_manually()
      RETURNS TABLE(processed_count INTEGER, error_count INTEGER) AS $$
      DECLARE
        queue_item RECORD;
        processed INTEGER := 0;
        errors INTEGER := 0;
      BEGIN
        -- Process all pending items
        FOR queue_item IN
          SELECT * FROM data_queue
          WHERE status = 'pending'
          ORDER BY created_at ASC
          LIMIT 100
        LOOP
          BEGIN
            -- Insert into product table
            INSERT INTO product (imei, brand, sku, created_at, updated_at)
            VALUES (
              queue_item.raw_data->>'imei',
              queue_item.raw_data->>'brand',
              queue_item.raw_data->>'brand' || '-' || queue_item.raw_data->>'model' || '-' || RIGHT(queue_item.raw_data->>'imei', 4),
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
              queue_item.raw_data->>'imei',
              queue_item.raw_data->>'model',
              COALESCE(queue_item.raw_data->>'serialNumber', queue_item.raw_data->>'serialnumber', queue_item.raw_data->>'model'),
              queue_item.raw_data->>'carrier',
              queue_item.raw_data->>'storage',
              queue_item.raw_data->>'color',
              COALESCE(queue_item.raw_data->>'batteryHealth', queue_item.raw_data->>'batteryhealth', queue_item.raw_data->>'BatteryHealthPercentage'),
              COALESCE((queue_item.raw_data->>'batteryCycleCount')::integer, (queue_item.raw_data->>'BatteryCycle')::integer, (queue_item.raw_data->>'bcc')::integer),
              queue_item.raw_data->>'working',
              COALESCE(queue_item.raw_data->>'location', 'INCOMING'),
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
            IF queue_item.raw_data->>'working' IS NOT NULL 
               AND queue_item.raw_data->>'working' != 'PENDING' 
               AND queue_item.raw_data->>'working' != '' THEN
              
              INSERT INTO device_test (imei, working, notes, tester, created_at)
              VALUES (
                queue_item.raw_data->>'imei',
                queue_item.raw_data->>'working',
                queue_item.raw_data->>'notes',
                COALESCE(queue_item.raw_data->>'TesterName', queue_item.raw_data->>'testerName'),
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
            VALUES (queue_item.raw_data->>'imei', 'pending', NOW(), NOW())
            ON CONFLICT (imei) DO UPDATE SET
              status = 'pending',
              updated_at = NOW();
            
            -- Mark as completed
            UPDATE data_queue 
            SET status = 'completed', processed_at = NOW(), updated_at = NOW()
            WHERE id = queue_item.id;
            
            processed := processed + 1;
            
          EXCEPTION WHEN OTHERS THEN
            -- Mark as failed
            UPDATE data_queue 
            SET status = 'failed', error_message = SQLERRM, updated_at = NOW()
            WHERE id = queue_item.id;
            
            errors := errors + 1;
          END;
        END LOOP;
        
        RETURN QUERY SELECT processed, errors;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    await client.query(manualProcessingFunction);
    console.log('✅ Manual processing function created');
    
    // Step 3: Test manual processing
    console.log('\n📋 Step 3: Testing manual processing...');
    
    // First, add a test item to the queue
    const testData = {
      imei: '444444444444444',
      brand: 'Samsung',
      model: 'Galaxy S21',
      working: 'YES',
      carrier: 'Verizon',
      storage: '256GB',
      color: 'Black',
      serialNumber: 'SN-MANUAL-123',
      batteryHealth: '95',
      batteryCycle: '100',
      notes: 'CARRIER UNLOCKED',
      TesterName: 'ManualTester'
    };
    
    // Insert without trigger (should work now)
    const insertResult = await client.query(`
      INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [testData, 'pending', 'test', 5, 0, 3]);
    
    console.log(`✅ Test item inserted: ID ${insertResult.rows[0].id}`);
    
    // Process manually
    const processResult = await client.query(`SELECT * FROM process_queue_manually()`);
    const result = processResult.rows[0];
    
    console.log(`📊 Manual processing result: ${result.processed_count} processed, ${result.error_count} errors`);
    
    // Check if the item was processed
    const checkResult = await client.query(`
      SELECT status, processed_at FROM data_queue WHERE id = $1
    `, [insertResult.rows[0].id]);
    
    console.log(`📊 Item status: ${checkResult.rows[0].status}`);
    
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
    await client.query(`DELETE FROM data_queue WHERE id = $1`, [insertResult.rows[0].id]);
    
    console.log('✅ Test data cleaned up');
    
    // Step 4: Create a simple script to run manual processing
    console.log('\n📋 Step 4: Creating manual processing script...');
    
    const manualScript = `
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function processQueueManually() {
  const client = await pool.connect();
  try {
    console.log('🔄 Processing queue manually...');
    
    const result = await client.query('SELECT * FROM process_queue_manually()');
    const stats = result.rows[0];
    
    console.log(\`📊 Processed: \${stats.processed_count} items\`);
    console.log(\`📊 Errors: \${stats.error_count} items\`);
    
    if (stats.processed_count > 0) {
      console.log('✅ Manual processing completed successfully!');
    } else {
      console.log('ℹ️  No items to process');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

processQueueManually();
`;
    
    require('fs').writeFileSync('process-queue-manually.js', manualScript);
    console.log('✅ Manual processing script created: process-queue-manually.js');
    
    console.log('\n🎉 Manual processing solution implemented successfully!');
    console.log('\n📋 How to use:');
    console.log('1. Add items to data_queue with status = "pending"');
    console.log('2. Run: node process-queue-manually.js');
    console.log('3. Items will be processed into product, item, device_test, and sku_matching_queue tables');
    console.log('4. PENDING working status items will skip device_test table');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

implementManualProcessing();


