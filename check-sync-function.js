const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function checkSyncFunction() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking sync_item_data function...');
    
    const result = await client.query(`
      SELECT pg_get_functiondef(oid) as function_definition
      FROM pg_proc 
      WHERE proname = 'sync_item_data'
    `);
    
    if (result.rows.length > 0) {
      console.log('sync_item_data function definition:');
      console.log(result.rows[0].function_definition);
    } else {
      console.log('Function not found');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkSyncFunction();


