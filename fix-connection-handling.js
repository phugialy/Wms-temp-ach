const { Pool } = require('pg');
require('dotenv').config();

// Create a more robust connection pool
const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
  ssl: false, // Disable SSL for local connections
});

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

async function testBulkInsert() {
  const client = await pool.connect();
  try {
    console.log('🧪 Testing bulk insert with connection handling...');
    
    // Test inserting multiple items
    const testItems = [
      {
        imei: '999999999999001',
        raw_data: {
          imei: '999999999999001',
          brand: 'Test Brand',
          model: 'Test Model',
          carrier: 'Test Carrier',
          storage: '256GB',
          color: 'Test Color',
          working: 'YES',
          location: 'TEST'
        }
      },
      {
        imei: '999999999999002',
        raw_data: {
          imei: '999999999999002',
          brand: 'Test Brand',
          model: 'Test Model',
          carrier: 'Test Carrier',
          storage: '256GB',
          color: 'Test Color',
          working: 'YES',
          location: 'TEST'
        }
      }
    ];
    
    console.log('📦 Inserting test items...');
    
    for (const item of testItems) {
      await client.query(`
        INSERT INTO data_queue (raw_data, status, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT (imei) DO UPDATE SET
          raw_data = EXCLUDED.raw_data,
          status = EXCLUDED.status,
          updated_at = NOW()
      `, [JSON.stringify(item.raw_data), 'pending']);
      
      console.log(`  ✅ Inserted: ${item.imei}`);
    }
    
    console.log('✅ Bulk insert test successful');
    
    // Clean up test data
    await client.query(`DELETE FROM data_queue WHERE imei IN ('999999999999001', '999999999999002')`);
    console.log('🧹 Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await testBulkInsert();
  } finally {
    await pool.end();
  }
}

main().catch(console.error);


