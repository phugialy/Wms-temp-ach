const { Client } = require('pg');
require('dotenv').config();

async function simpleTest() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🧪 Simple database test...');
    
    await client.connect();
    console.log('✅ Connected to database');

    // Test basic insert
    const imei = '987654321098765';
    
    console.log('📝 Testing basic insert...');
    
    // Insert product
    await client.query('INSERT INTO product (imei, sku, brand) VALUES ($1, $2, $3)', 
      [imei, 'IPHONE14PRO-256GB-BLK-UNL', 'Apple']);
    
    // Insert item
    await client.query('INSERT INTO item (imei, model, working, location) VALUES ($1, $2, $3, $4)', 
      [imei, 'iPhone 14 Pro', 'YES', 'DNCL-Inspection']);
    
    console.log('✅ Basic inserts successful');

    // Test query
    const result = await client.query('SELECT p.imei, p.sku, i.model, i.working FROM product p JOIN item i ON p.imei = i.imei WHERE p.imei = $1', [imei]);
    console.log('📊 Query result:', result.rows[0]);

    // Clean up
    await client.query('DELETE FROM product WHERE imei = $1', [imei]);
    console.log('✅ Cleanup successful');

    console.log('🎉 Simple test passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await client.end();
  }
}

simpleTest();
