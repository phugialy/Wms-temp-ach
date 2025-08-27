const { Client } = require('pg');
require('dotenv').config();

async function verifyDatabaseData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔍 Verifying Database Data...\n');
    
    await client.connect();
    console.log('✅ Connected to database');

    // Check all tables
    const tables = ['product', 'item', 'device_test', 'inventory', 'movement_history'];
    
    for (const table of tables) {
      console.log(`\n📋 ${table.toUpperCase()} TABLE:`);
      const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
      const count = parseInt(result.rows[0].count);
      console.log(`   Records: ${count}`);
      
      if (count > 0) {
        const sampleData = await client.query(`SELECT * FROM ${table} LIMIT 2`);
        console.log(`   Sample data:`, sampleData.rows);
      }
    }

    // Check views
    console.log('\n👀 VIEWS:');
    
    try {
      const inventoryViewResult = await client.query('SELECT COUNT(*) FROM inventory_view');
      const inventoryCount = parseInt(inventoryViewResult.rows[0].count);
      console.log(`   inventory_view: ${inventoryCount} records`);
      
      if (inventoryCount > 0) {
        const sampleInventory = await client.query('SELECT * FROM inventory_view LIMIT 2');
        console.log(`   Sample inventory data:`, sampleInventory.rows);
      }
    } catch (error) {
      console.log(`   inventory_view ERROR: ${error.message}`);
    }

    try {
      const deletionViewResult = await client.query('SELECT COUNT(*) FROM deletion_view');
      const deletionCount = parseInt(deletionViewResult.rows[0].count);
      console.log(`   deletion_view: ${deletionCount} records`);
      
      if (deletionCount > 0) {
        const sampleDeletion = await client.query('SELECT * FROM deletion_view LIMIT 2');
        console.log(`   Sample deletion data:`, sampleDeletion.rows);
      }
    } catch (error) {
      console.log(`   deletion_view ERROR: ${error.message}`);
    }

    // Check specific data patterns
    console.log('\n🎯 DATA PATTERNS:');
    
    // Check working status distribution
    const workingStats = await client.query(`
      SELECT working, COUNT(*) as count 
      FROM item 
      GROUP BY working
    `);
    console.log('   Working status distribution:', workingStats.rows);

    // Check SKU patterns
    const skuStats = await client.query(`
      SELECT sku, COUNT(*) as count 
      FROM product 
      GROUP BY sku
    `);
    console.log('   SKU patterns:', skuStats.rows);

    // Check movement history
    const movementStats = await client.query(`
      SELECT location_original, location_updated, COUNT(*) as count 
      FROM movement_history 
      GROUP BY location_original, location_updated
    `);
    console.log('   Movement patterns:', movementStats.rows);

    console.log('\n✅ Database verification completed!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  } finally {
    await client.end();
  }
}

verifyDatabaseData();
