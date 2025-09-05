const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function checkTriggers() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking triggers on item table...');
    
    const result = await client.query(`
      SELECT 
        trigger_name,
        event_manipulation,
        action_statement
      FROM information_schema.triggers 
      WHERE event_object_table = 'item'
    `);
    
    console.log('Triggers on item table:');
    result.rows.forEach(row => {
      console.log(`  ${row.trigger_name}: ${row.event_manipulation}`);
      console.log(`    Action: ${row.action_statement}`);
    });
    
    if (result.rows.length === 0) {
      console.log('  No triggers found');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkTriggers();


