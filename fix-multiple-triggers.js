const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function fixMultipleTriggers() {
  const client = await pool.connect();
  try {
    console.log('🔧 Fixing multiple triggers issue...');
    
    // First, let's see what these triggers do
    const triggerDetails = await client.query(`
      SELECT 
        t.trigger_name,
        t.event_manipulation,
        t.action_timing,
        p.prosrc as function_code
      FROM information_schema.triggers t
      JOIN pg_proc p ON p.proname = t.action_statement
      WHERE t.event_object_table = 'data_queue'
      ORDER BY t.trigger_name
    `);
    
    console.log('📋 Trigger details:');
    triggerDetails.rows.forEach(trigger => {
      console.log(`\n${trigger.trigger_name}:`);
      console.log(`  Event: ${trigger.action_timing} ${trigger.event_manipulation}`);
      console.log(`  Function: ${trigger.function_code.substring(0, 100)}...`);
    });
    
    // The issue might be that we have conflicting triggers
    // Let's disable all triggers and test
    console.log('\n🔧 Testing with all triggers disabled...');
    
    try {
      // Disable all triggers
      await client.query(`ALTER TABLE data_queue DISABLE TRIGGER ALL`);
      console.log('✅ All triggers disabled');
      
      // Test simple insert
      const result = await client.query(`
        INSERT INTO data_queue (raw_data, status, source)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [
        '{"imei": "444444444444444", "brand": "Test"}',
        'pending',
        'test'
      ]);
      
      console.log(`✅ Insert without triggers worked: ID ${result.rows[0].id}`);
      
      // Clean up
      await client.query(`DELETE FROM data_queue WHERE id = $1`, [result.rows[0].id]);
      
      // Re-enable only the main trigger
      await client.query(`ALTER TABLE data_queue ENABLE TRIGGER trigger_process_data_queue`);
      console.log('✅ Main trigger re-enabled');
      
      // Test with just the main trigger
      const result2 = await client.query(`
        INSERT INTO data_queue (raw_data, status, source)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [
        '{"imei": "333333333333333", "brand": "Test"}',
        'pending',
        'test'
      ]);
      
      console.log(`✅ Insert with main trigger worked: ID ${result2.rows[0].id}`);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if it was processed
      const checkResult = await client.query(`
        SELECT status, processed_at FROM data_queue WHERE id = $1
      `, [result2.rows[0].id]);
      
      console.log(`📊 Processing result: ${checkResult.rows[0].status}`);
      
      // Clean up
      await client.query(`DELETE FROM device_test WHERE imei = $1`, ['333333333333333']);
      await client.query(`DELETE FROM item WHERE imei = $1`, ['333333333333333']);
      await client.query(`DELETE FROM product WHERE imei = $1`, ['333333333333333']);
      await client.query(`DELETE FROM data_queue WHERE id = $1`, [result2.rows[0].id]);
      
      // Re-enable all triggers
      await client.query(`ALTER TABLE data_queue ENABLE TRIGGER ALL`);
      console.log('✅ All triggers re-enabled');
      
    } catch (error) {
      console.log(`❌ Trigger test failed: ${error.message}`);
      // Make sure to re-enable triggers
      try {
        await client.query(`ALTER TABLE data_queue ENABLE TRIGGER ALL`);
      } catch (e) {
        // Ignore
      }
    }
    
    // Let's check if there are any problematic functions
    console.log('\n🔍 Checking for problematic functions...');
    
    const functions = await client.query(`
      SELECT proname, prosrc 
      FROM pg_proc 
      WHERE proname IN ('process_data_queue_item', 'auto_process_queue_items', 'process_data_queue_automatically')
    `);
    
    functions.rows.forEach(func => {
      console.log(`\nFunction: ${func.proname}`);
      if (func.prosrc.includes('raw_data->>')) {
        console.log('  ✅ Uses raw_data->> operator');
      }
      if (func.prosrc.includes('Model#')) {
        console.log('  ⚠️  Contains Model# field access');
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixMultipleTriggers();


