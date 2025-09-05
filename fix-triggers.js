const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function fixTriggers() {
  const client = await pool.connect();
  try {
    console.log('🔧 Fixing triggers that reference deleted tables...');
    
    // Drop the sync_item_data trigger since it references the deleted "Item" table
    await client.query(`DROP TRIGGER IF EXISTS trigger_sync_item_data ON item`);
    console.log('✅ Dropped trigger_sync_item_data trigger');
    
    // Drop the sync_item_data function since it's no longer needed
    await client.query(`DROP FUNCTION IF EXISTS sync_item_data()`);
    console.log('✅ Dropped sync_item_data function');
    
    // Check if there are other triggers that might reference deleted tables
    const result = await client.query(`
      SELECT 
        trigger_name,
        event_manipulation,
        action_statement
      FROM information_schema.triggers 
      WHERE event_object_table = 'item'
    `);
    
    console.log('\n📋 Remaining triggers on item table:');
    result.rows.forEach(row => {
      console.log(`  ${row.trigger_name}: ${row.event_manipulation}`);
    });
    
    console.log('\n🎉 Trigger cleanup complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixTriggers();


