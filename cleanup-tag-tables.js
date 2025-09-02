const { Client } = require('pg');
require('dotenv').config();

async function cleanupTagTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log('\n🧹 Cleaning up tag tables...');
    
    // Clear existing data
    await client.query('DELETE FROM sku_master_tags');
    console.log('✅ Cleared sku_master_tags');
    
    await client.query('DELETE FROM sku_tags');
    console.log('✅ Cleared sku_tags');
    
    // Reset tag columns in sku_master
    await client.query(`
      UPDATE sku_master 
      SET 
        model_tag = NULL,
        capacity_tag = NULL,
        color_tag = NULL,
        carrier_tag = NULL,
        postfix_tag = NULL,
        tag_count = 0
    `);
    console.log('✅ Reset sku_master tag columns');
    
    console.log('\n🎯 Cleanup complete! Ready to test enhanced categorization.');

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('🔌 Disconnected from database');
  }
}

// Run the cleanup
cleanupTagTables();
