const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function checkFailedItems() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, raw_data, error_message, created_at 
      FROM data_queue 
      WHERE status = 'failed' 
      ORDER BY created_at DESC 
      LIMIT 3
    `);
    
    console.log('Failed items:');
    result.rows.forEach((item, i) => {
      console.log(`\n${i+1}. ID: ${item.id}`);
      console.log(`   IMEI: ${item.raw_data.imei}`);
      console.log(`   Error: ${item.error_message}`);
      console.log(`   Created: ${item.created_at}`);
    });
  } finally {
    client.release();
    await pool.end();
  }
}

checkFailedItems();