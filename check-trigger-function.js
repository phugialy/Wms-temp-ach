const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function checkTriggerFunction() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking trigger function...');
    
    // Get the trigger function code
    const triggerFunction = await client.query(`
      SELECT prosrc FROM pg_proc 
      WHERE proname = 'process_data_queue_automatically'
    `);
    
    if (triggerFunction.rows.length > 0) {
      console.log('📋 Current trigger function:');
      console.log(triggerFunction.rows[0].prosrc);
      
      // Check if there are any syntax issues
      const functionCode = triggerFunction.rows[0].prosrc;
      
      if (functionCode.includes('NEW.raw_data->>')) {
        console.log('\n✅ Function uses JSON field access');
      }
      
      if (functionCode.includes('NEW.raw_data->>\'imei\'')) {
        console.log('✅ Function accesses imei field');
      }
      
      if (functionCode.includes('NEW.raw_data->>\'working\'')) {
        console.log('✅ Function accesses working field');
      }
      
      // Check for potential issues
      if (functionCode.includes('NEW.raw_data->>')) {
        console.log('\n🔍 Checking for potential JSON access issues...');
        
        // Look for any malformed JSON access
        const lines = functionCode.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('NEW.raw_data->>') && !line.includes("'")) {
            console.log(`⚠️  Potential issue at line ${index + 1}: ${line.trim()}`);
          }
        });
      }
    } else {
      console.log('❌ Trigger function not found');
    }
    
    // Test the trigger function syntax
    console.log('\n🧪 Testing trigger function syntax...');
    try {
      await client.query(`
        SELECT process_data_queue_automatically()
      `);
      console.log('✅ Trigger function syntax is valid');
    } catch (error) {
      console.log('❌ Trigger function syntax error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkTriggerFunction();


