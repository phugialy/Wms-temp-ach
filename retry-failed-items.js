const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function retryFailedItems() {
  const client = await pool.connect();
  try {
    // Reset failed items to pending
    const result = await client.query(`
      UPDATE data_queue 
      SET status = 'pending', error_message = NULL 
      WHERE status = 'failed'
    `);
    
    console.log(`✅ Reset ${result.rowCount} failed items to pending`);
    
    // Get count
    const countResult = await client.query(`
      SELECT COUNT(*) as count FROM data_queue WHERE status = 'pending'
    `);
    console.log(`📦 ${countResult.rows[0].count} items ready for processing`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

retryFailedItems();


