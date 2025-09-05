const { Pool } = require('pg');
require('dotenv').config();

async function checkTables() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL,
    max: 1,
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 30000,
  });
  
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking required tables...');
    
    const tables = ['sku_sync_log', 'sku_master', 'sku_mapping_rules'];
    
    for (const table of tables) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = '${table}'
        )
      `);
      console.log(`📋 ${table}: ${result.rows[0].exists ? '✅ EXISTS' : '❌ MISSING'}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkTables();
