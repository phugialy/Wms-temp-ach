const { Pool } = require('pg');
require('dotenv').config();

async function checkSkuTags() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL,
    max: 1,
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 30000,
  });
  
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking SKU tags structure...');
    
    const result = await client.query('SELECT sku_code, sku_tags FROM sku_master WHERE sku_tags IS NOT NULL LIMIT 3');
    
    if (result.rows.length === 0) {
      console.log('❌ No SKUs with tags found');
    } else {
      console.log('📋 Sample SKU tags:');
      result.rows.forEach(row => {
        console.log(`SKU: ${row.sku_code}`);
        console.log(`Tags: ${JSON.stringify(row.sku_tags, null, 2)}`);
        console.log('---');
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSkuTags();
