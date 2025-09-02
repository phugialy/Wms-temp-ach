const { Client } = require('pg');
require('dotenv').config();

async function cleanupTagTablesComplete() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log('\n🧹 COMPLETE CLEANUP OF TAG TABLES...');
    
    // Check what's in the tables first
    console.log('\n📊 Checking current table contents...');
    
    const skuTagsCount = await client.query('SELECT COUNT(*) FROM sku_tags');
    const skuMasterTagsCount = await client.query('SELECT COUNT(*) FROM sku_master_tags');
    
    console.log(`   sku_tags: ${skuTagsCount.rows[0].count} records`);
    console.log(`   sku_master_tags: ${skuMasterTagsCount.rows[0].count} records`);

    // Clean up sku_master_tags first (due to foreign key constraints)
    console.log('\n🗑️ Cleaning sku_master_tags...');
    await client.query('DELETE FROM sku_master_tags');
    console.log('✅ Cleared sku_master_tags');

    // Clean up sku_tags
    console.log('\n🗑️ Cleaning sku_tags...');
    await client.query('DELETE FROM sku_tags');
    console.log('✅ Cleared sku_tags');

    // Reset the auto-increment counters
    console.log('\n🔄 Resetting auto-increment counters...');
    await client.query('ALTER SEQUENCE sku_tags_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE sku_master_tags_id_seq RESTART WITH 1');
    console.log('✅ Reset auto-increment counters');

    // Reset tag columns in sku_master
    console.log('\n🔄 Resetting sku_master tag columns...');
    const resetQueries = [
      'UPDATE sku_master SET model_tag = NULL',
      'UPDATE sku_master SET capacity_tag = NULL',
      'UPDATE sku_master SET color_tag = NULL',
      'UPDATE sku_master SET carrier_tag = NULL',
      'UPDATE sku_master SET postfix_tag = NULL',
      'UPDATE sku_master SET tag_count = 0'
    ];

    for (const query of resetQueries) {
      await client.query(query);
    }
    console.log('✅ Reset sku_master tag columns');

    // Verify cleanup
    console.log('\n✅ Verifying cleanup...');
    const finalSkuTagsCount = await client.query('SELECT COUNT(*) FROM sku_tags');
    const finalSkuMasterTagsCount = await client.query('SELECT COUNT(*) FROM sku_master_tags');
    
    console.log(`   sku_tags: ${finalSkuTagsCount.rows[0].count} records`);
    console.log(`   sku_master_tags: ${finalSkuMasterTagsCount.rows[0].count} records`);

    if (finalSkuTagsCount.rows[0].count === '0' && finalSkuMasterTagsCount.rows[0].count === '0') {
      console.log('\n🎯 COMPLETE CLEANUP SUCCESSFUL!');
      console.log('✅ All tag tables are now empty');
      console.log('✅ All sku_master tag columns are reset');
      console.log('✅ Auto-increment counters are reset');
      console.log('\n🚀 Ready to start fresh parsing!');
    } else {
      console.log('\n⚠️ Cleanup may not be complete');
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the complete cleanup
cleanupTagTablesComplete();
