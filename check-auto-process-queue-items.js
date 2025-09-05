const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function checkAutoProcessQueueItems() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking auto_process_queue_items function...');
    
    // Get the function code
    const functionCode = await client.query(`
      SELECT prosrc FROM pg_proc 
      WHERE proname = 'auto_process_queue_items'
    `);
    
    if (functionCode.rows.length > 0) {
      console.log('📋 auto_process_queue_items function code:');
      console.log(functionCode.rows[0].prosrc);
      
      // Check for Model# field access
      const code = functionCode.rows[0].prosrc;
      if (code.includes('Model#')) {
        console.log('\n⚠️  ISSUE FOUND: auto_process_queue_items contains Model# field access!');
        
        // Find the problematic line
        const lines = code.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('Model#')) {
            console.log(`   Line ${index + 1}: ${line.trim()}`);
          }
        });
      } else {
        console.log('\n✅ No Model# field access found in auto_process_queue_items');
      }
      
      // Check for any JSONB field access
      if (code.includes('raw_data->>')) {
        console.log('\n📋 JSONB field access found:');
        const lines = code.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('raw_data->>')) {
            console.log(`   Line ${index + 1}: ${line.trim()}`);
          }
        });
      }
    } else {
      console.log('❌ auto_process_queue_items function not found');
    }
    
    // Let's also check what triggers this function
    const triggerInfo = await client.query(`
      SELECT trigger_name, action_statement
      FROM information_schema.triggers 
      WHERE event_object_table = 'data_queue'
      AND action_statement LIKE '%auto_process_queue_items%'
    `);
    
    if (triggerInfo.rows.length > 0) {
      console.log('\n📋 Triggers that call auto_process_queue_items:');
      triggerInfo.rows.forEach(trigger => {
        console.log(`  ${trigger.trigger_name}: ${trigger.action_statement}`);
      });
    } else {
      console.log('\n📋 No triggers found that call auto_process_queue_items');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAutoProcessQueueItems();


