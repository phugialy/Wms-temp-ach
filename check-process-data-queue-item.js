const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function checkProcessDataQueueItem() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking process_data_queue_item function...');
    
    // Get the function code
    const functionCode = await client.query(`
      SELECT prosrc FROM pg_proc 
      WHERE proname = 'process_data_queue_item'
    `);
    
    if (functionCode.rows.length > 0) {
      console.log('📋 process_data_queue_item function code:');
      console.log(functionCode.rows[0].prosrc);
      
      // Check for Model# field access
      const code = functionCode.rows[0].prosrc;
      if (code.includes('Model#')) {
        console.log('\n⚠️  ISSUE FOUND: process_data_queue_item contains Model# field access!');
        console.log('   This is likely causing the JSONB operator error');
        
        // Find the problematic line
        const lines = code.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('Model#')) {
            console.log(`   Line ${index + 1}: ${line.trim()}`);
          }
        });
      } else {
        console.log('\n✅ No Model# field access found in process_data_queue_item');
      }
    } else {
      console.log('❌ process_data_queue_item function not found');
    }
    
    // Let's also check what triggers this function
    const triggerInfo = await client.query(`
      SELECT trigger_name, action_statement
      FROM information_schema.triggers 
      WHERE event_object_table = 'data_queue'
      AND action_statement LIKE '%process_data_queue_item%'
    `);
    
    if (triggerInfo.rows.length > 0) {
      console.log('\n📋 Triggers that call process_data_queue_item:');
      triggerInfo.rows.forEach(trigger => {
        console.log(`  ${trigger.trigger_name}: ${trigger.action_statement}`);
      });
    } else {
      console.log('\n📋 No triggers found that call process_data_queue_item');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkProcessDataQueueItem();


