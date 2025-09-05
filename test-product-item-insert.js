const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function testProductItemInsert() {
  const client = await pool.connect();
  try {
    console.log('🧪 Testing product and item insert sequence...');
    
    const testData = {
      imei: '999999999999999',
      brand: 'Test Brand',
      model: 'Test Model',
      model_number: 'TM-001',
      carrier: 'Test Carrier',
      storage: '256GB',
      color: 'Test Color',
      battery_health: '95%',
      battery_count: 150,
      working: 'YES',
      location: 'TEST'
    };
    
    // Step 1: Insert into product table
    console.log('📦 Step 1: Inserting into product table...');
    const productResult = await client.query(`
      INSERT INTO product (imei, brand, sku, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (imei) DO UPDATE SET
        brand = EXCLUDED.brand,
        sku = EXCLUDED.sku,
        updated_at = NOW()
      RETURNING imei, brand, sku
    `, [
      testData.imei,
      testData.brand,
      `${testData.brand}-${testData.model}-${testData.imei.slice(-4)}`
    ]);
    
    console.log('✅ Product created:', productResult.rows[0]);
    
    // Step 2: Insert into item table
    console.log('📦 Step 2: Inserting into item table...');
    const itemResult = await client.query(`
      INSERT INTO item (
        imei, model, model_number, carrier, capacity, color, 
        battery_health, battery_count, working, location, 
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (imei) DO UPDATE SET
        model = EXCLUDED.model,
        model_number = EXCLUDED.model_number,
        carrier = EXCLUDED.carrier,
        capacity = EXCLUDED.capacity,
        color = EXCLUDED.color,
        battery_health = EXCLUDED.battery_health,
        battery_count = EXCLUDED.battery_count,
        working = EXCLUDED.working,
        location = EXCLUDED.location,
        updated_at = NOW()
      RETURNING imei, model, model_number, carrier, capacity, color, battery_health, battery_count, working, location
    `, [
      testData.imei,
      testData.model,
      testData.model_number,
      testData.carrier,
      testData.storage,
      testData.color,
      testData.battery_health,
      testData.battery_count,
      testData.working,
      testData.location
    ]);
    
    console.log('✅ Item created:', itemResult.rows[0]);
    
    // Step 3: Insert into device_test table
    console.log('📦 Step 3: Inserting into device_test table...');
    const deviceTestResult = await client.query(`
      INSERT INTO device_test (imei, working, notes, tester, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (imei) DO UPDATE SET
        working = EXCLUDED.working,
        notes = EXCLUDED.notes,
        tester = EXCLUDED.tester,
        created_at = NOW()
      RETURNING imei, working, notes, tester
    `, [
      testData.imei,
      testData.working,
      'Test notes',
      'Test Tester'
    ]);
    
    console.log('✅ Device test created:', deviceTestResult.rows[0]);
    
    // Clean up test data
    console.log('🧹 Cleaning up test data...');
    await client.query(`DELETE FROM device_test WHERE imei = $1`, [testData.imei]);
    await client.query(`DELETE FROM item WHERE imei = $1`, [testData.imei]);
    await client.query(`DELETE FROM product WHERE imei = $1`, [testData.imei]);
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

testProductItemInsert();
