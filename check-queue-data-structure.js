const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function checkQueueDataStructure() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking actual data structure in queue...');
    
    // Get a few sample items from the queue to see what fields are available
    const result = await client.query(`
      SELECT id, raw_data, created_at 
      FROM data_queue 
      WHERE status = 'completed' 
      ORDER BY created_at DESC 
      LIMIT 3
    `);
    
    console.log(`📦 Found ${result.rows.length} completed items to analyze:`);
    
    result.rows.forEach((item, i) => {
      console.log(`\n${i+1}. Queue Item ID: ${item.id}`);
      console.log(`   Created: ${item.created_at}`);
      console.log(`   Raw Data Fields:`);
      
      const rawData = item.raw_data;
      Object.keys(rawData).forEach(key => {
        console.log(`     ${key}: ${rawData[key]}`);
      });
    });
    
    // Also check what fields we might be missing
    console.log('\n🔍 Checking for common field variations...');
    const allFields = new Set();
    result.rows.forEach(item => {
      Object.keys(item.raw_data).forEach(key => allFields.add(key.toLowerCase()));
    });
    
    console.log('All unique field names found:');
    Array.from(allFields).sort().forEach(field => {
      console.log(`  - ${field}`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkQueueDataStructure();


