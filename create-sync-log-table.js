const { Pool } = require('pg');
require('dotenv').config();

async function createSyncLogTable() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL,
    max: 1,
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 30000,
  });
  
  const client = await pool.connect();
  
  try {
    console.log('🏗️ Creating sku_sync_log table...');
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS sku_sync_log (
        id SERIAL PRIMARY KEY,
        sync_type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        total_skus INTEGER DEFAULT 0,
        new_skus INTEGER DEFAULT 0,
        updated_skus INTEGER DEFAULT 0,
        failed_skus INTEGER DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    
    await client.query(createTableQuery);
    console.log('✅ sku_sync_log table created successfully');
    
  } catch (error) {
    console.error('❌ Error creating table:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createSyncLogTable();
