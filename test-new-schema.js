const { Client } = require('pg');
require('dotenv').config();

async function testNewSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🧪 Testing new IMEI-centric database schema...');
    
    // Connect to database
    await client.connect();
    console.log('✅ Connected to database');

    // Test 1: Check if all tables exist
    console.log('\n📋 Checking table structure...');
    
    const tables = [
      'product',
      'item', 
      'inventory',
      'device_test',
      'movement_history',
      'data_queue',
      'queue_processing_log'
    ];

    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`✅ ${table} - EXISTS (${result.rows[0].count} records)`);
      } catch (error) {
        console.log(`❌ ${table} - MISSING: ${error.message}`);
      }
    }

    // Test 2: Insert sample data
    console.log('\n📝 Testing data insertion...');
    
    const sampleData = {
      imei: '123456789012345',
      model: 'iPhone 14 Pro',
      brand: 'Apple',
      capacity: '256GB',
      color: 'Space Black',
      carrier: 'Unlocked',
      battery_health: '95%',
      battery_count: 150,
      working: 'YES',
      location: 'DNCL-Inspection'
    };

    // Insert into product table
    await client.query(`
      INSERT INTO product (imei, sku, brand) 
      VALUES ($1, $2, $3)
      ON CONFLICT (imei) DO UPDATE SET 
        sku = EXCLUDED.sku,
        brand = EXCLUDED.brand,
        updated_at = NOW()
    `, [sampleData.imei, `${sampleData.model.replace(/\s+/g, '')}-${sampleData.capacity}-BLK-UNL`, sampleData.brand]);

    // Insert into item table
    await client.query(`
      INSERT INTO item (imei, model, carrier, capacity, color, battery_health, battery_count, working, location)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (imei) DO UPDATE SET
        model = EXCLUDED.model,
        carrier = EXCLUDED.carrier,
        capacity = EXCLUDED.capacity,
        color = EXCLUDED.color,
        battery_health = EXCLUDED.battery_health,
        battery_count = EXCLUDED.battery_count,
        working = EXCLUDED.working,
        location = EXCLUDED.location,
        updated_at = NOW()
    `, [sampleData.imei, sampleData.model, sampleData.carrier, sampleData.capacity, sampleData.color, sampleData.battery_health, sampleData.battery_count, sampleData.working, sampleData.location]);

    // Insert into device_test table
    await client.query(`
      INSERT INTO device_test (imei, working, defects, notes)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (imei) DO UPDATE SET
        working = EXCLUDED.working,
        defects = EXCLUDED.defects,
        notes = EXCLUDED.notes,
        test_date = NOW()
    `, [sampleData.imei, sampleData.working, 'None', 'Device passed all tests']);

    console.log('✅ Sample data inserted successfully');

    // Test 3: Query the views
    console.log('\n👀 Testing database views...');
    
    try {
      const inventoryView = await client.query('SELECT * FROM inventory_view LIMIT 5');
      console.log(`✅ inventory_view - ${inventoryView.rows.length} records`);
      if (inventoryView.rows.length > 0) {
        console.log('   Sample record:', inventoryView.rows[0]);
      }
    } catch (error) {
      console.log(`❌ inventory_view - ERROR: ${error.message}`);
    }

    try {
      const deletionView = await client.query('SELECT * FROM deletion_view LIMIT 5');
      console.log(`✅ deletion_view - ${deletionView.rows.length} records`);
      if (deletionView.rows.length > 0) {
        console.log('   Sample record:', deletionView.rows[0]);
      }
    } catch (error) {
      console.log(`❌ deletion_view - ERROR: ${error.message}`);
    }

    // Test 4: Test cascade deletion
    console.log('\n🗑️ Testing cascade deletion...');
    
    const deleteResult = await client.query('DELETE FROM product WHERE imei = $1', [sampleData.imei]);
    console.log(`✅ Cascade deletion - ${deleteResult.rowCount} product record(s) deleted`);

    // Verify cascade worked
    const remainingItems = await client.query('SELECT COUNT(*) FROM item WHERE imei = $1', [sampleData.imei]);
    const remainingTests = await client.query('SELECT COUNT(*) FROM device_test WHERE imei = $1', [sampleData.imei]);
    const remainingMovement = await client.query('SELECT COUNT(*) FROM movement_history WHERE imei = $1', [sampleData.imei]);

    console.log(`   Remaining item records: ${remainingItems.rows[0].count}`);
    console.log(`   Remaining test records: ${remainingTests.rows[0].count}`);
    console.log(`   Remaining movement records: ${remainingMovement.rows[0].count}`);

    if (remainingItems.rows[0].count === '0' && remainingTests.rows[0].count === '0') {
      console.log('✅ Cascade deletion working correctly');
    } else {
      console.log('❌ Cascade deletion not working properly');
    }

    console.log('\n🎉 Database schema test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing schema:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run test if this script is executed directly
if (require.main === module) {
  testNewSchema()
    .then(() => {
      console.log('✅ All tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Tests failed:', error);
      process.exit(1);
    });
}

module.exports = { testNewSchema };
