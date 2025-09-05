const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function applyTriggerFix() {
  const client = await pool.connect();
  try {
    console.log('🔧 Applying trigger function fix...');
    
    // Read and execute the SQL file
    const fs = require('fs');
    const sql = fs.readFileSync('fix-trigger-remove-model-sharp.sql', 'utf8');
    
    await client.query(sql);
    console.log('✅ Trigger function fixed successfully');
    
    console.log('\n📋 What was fixed:');
    console.log('- Removed Model# field access that was causing JSONB operator errors');
    console.log('- Preserved all other functionality (PENDING handling, field mappings, etc.)');
    console.log('- Model_number now uses serialNumber, serialnumber, or model as fallback');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

applyTriggerFix();


