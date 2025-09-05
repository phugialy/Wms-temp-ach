const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function cleanupDuplicateTables() {
  const client = await pool.connect();
  try {
    console.log('🧹 Cleaning up duplicate tables...');
    
    // First, let's check if there are any important data differences
    const itemData = await client.query(`
      SELECT imei, model, carrier, capacity, color, working, location 
      FROM item 
      ORDER BY created_at DESC 
      LIMIT 3
    `);
    
    const ItemData = await client.query(`
      SELECT imei, model, carrier, "storage" as capacity, color, working, location 
      FROM "Item" 
      ORDER BY "createdAt" DESC 
      LIMIT 3
    `);
    
    console.log('\n📊 Sample data from item (lowercase):');
    itemData.rows.forEach((row, i) => {
      console.log(`  ${i+1}. IMEI: ${row.imei}, Model: ${row.model}, Working: ${row.working}`);
    });
    
    console.log('\n📊 Sample data from Item (capitalized):');
    ItemData.rows.forEach((row, i) => {
      console.log(`  ${i+1}. IMEI: ${row.imei}, Model: ${row.model}, Working: ${row.working}`);
    });
    
    console.log('\n⚠️  About to delete the capitalized Item table...');
    console.log('   This will remove the over-engineered table with unnecessary columns.');
    console.log('   Your original item table will remain intact.');
    
    // Drop the capitalized Item table
    await client.query(`DROP TABLE IF EXISTS "Item" CASCADE`);
    console.log('✅ Deleted capitalized Item table');
    
    // Also drop other unnecessary capitalized tables
    await client.query(`DROP TABLE IF EXISTS "Inventory" CASCADE`);
    console.log('✅ Deleted capitalized Inventory table');
    
    await client.query(`DROP TABLE IF EXISTS "Location" CASCADE`);
    console.log('✅ Deleted capitalized Location table');
    
    await client.query(`DROP TABLE IF EXISTS "Warehouse" CASCADE`);
    console.log('✅ Deleted capitalized Warehouse table');
    
    console.log('\n🎉 Cleanup complete!');
    console.log('✅ Your original lowercase tables are now the only ones in use');
    console.log('✅ Removed over-engineered tables with unnecessary columns');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupDuplicateTables();


