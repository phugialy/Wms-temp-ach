const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function testItemInsert() {
  const client = await pool.connect();
  try {
    console.log('🧪 Testing item insert with all fields...');
    
    const testData = {
      imei: '999999999999999',
      model: 'Test Model',
      model_number: 'TM-001',
      carrier: 'Test Carrier',
      storage: '256GB',
      color: 'Test Color',
      battery_health: '95%',
      battery_count: 1,
      working: 'YES',
      location: 'TEST'
    };
    
    // Test insert into item table
    const result = await client.query(`
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
    
    console.log('✅ Item insert successful:');
    console.log('   IMEI:', result.rows[0].imei);
    console.log('   Model:', result.rows[0].model);
    console.log('   Model Number:', result.rows[0].model_number);
    console.log('   Carrier:', result.rows[0].carrier);
    console.log('   Capacity:', result.rows[0].capacity);
    console.log('   Color:', result.rows[0].color);
    console.log('   Battery Health:', result.rows[0].battery_health);
    console.log('   Battery Count:', result.rows[0].battery_count);
    console.log('   Working:', result.rows[0].working);
    console.log('   Location:', result.rows[0].location);
    
    // Clean up test data
    await client.query(`DELETE FROM item WHERE imei = $1`, [testData.imei]);
    console.log('🧹 Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

testItemInsert();


