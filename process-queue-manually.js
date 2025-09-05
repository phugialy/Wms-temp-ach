
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
    
    console.log(`📊 Processed: ${stats.processed_count} items`);
    console.log(`📊 Errors: ${stats.error_count} items`);
    
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
