const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyInventoryViewUpdate() {
  console.log('🔄 Applying Inventory View Update...\n');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('📡 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '026_update_inventory_view.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Applying migration...');
    await client.query(migrationSQL);
    console.log('✅ Migration applied successfully');

    // Test the updated view
    console.log('\n🧪 Testing updated inventory view...');
    const testQuery = `
      SELECT 
        imei,
        device_name,
        model,
        storage,
        color,
        carrier,
        location,
        working_status,
        condition,
        defects,
        notes,
        repair_notes
      FROM inventory_view 
      LIMIT 3
    `;
    
    const result = await client.query(testQuery);
    console.log(`✅ View test successful: ${result.rows.length} items`);
    
    if (result.rows.length > 0) {
      console.log('\n📋 Sample data from updated view:');
      result.rows.forEach((row, index) => {
        console.log(`\nItem ${index + 1}:`);
        console.log(`  IMEI: ${row.imei}`);
        console.log(`  Device Name: ${row.device_name}`);
        console.log(`  Model: ${row.model}`);
        console.log(`  Storage: ${row.storage}`);
        console.log(`  Color: ${row.color}`);
        console.log(`  Carrier: ${row.carrier}`);
        console.log(`  Location: ${row.location}`);
        console.log(`  Working Status: ${row.working_status}`);
        console.log(`  Condition: ${row.condition}`);
        console.log(`  Defects: ${row.defects || 'None'}`);
        console.log(`  Notes: ${row.notes || 'None'}`);
        console.log(`  Repair Notes: ${row.repair_notes || 'None'}`);
      });
    }

    console.log('\n🎉 Inventory view update completed successfully!');
    
  } catch (error) {
    console.error('❌ Error applying inventory view update:', error.message);
    console.error('Full error:', error);
  } finally {
    await client.end();
  }
}

applyInventoryViewUpdate();
