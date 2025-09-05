const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function checkTableConstraints() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking table constraints and defaults...');
    
    // Check table structure
    const tableInfo = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'data_queue'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 data_queue table structure:');
    tableInfo.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default || 'none'})`);
    });
    
    // Check for any triggers on the table
    const triggers = await client.query(`
      SELECT trigger_name, event_manipulation, action_timing, action_statement
      FROM information_schema.triggers 
      WHERE event_object_table = 'data_queue'
    `);
    
    console.log('\n📋 Triggers on data_queue:');
    triggers.rows.forEach(trigger => {
      console.log(`  ${trigger.trigger_name}: ${trigger.action_timing} ${trigger.event_manipulation}`);
    });
    
    // Check for any functions that might be called
    const functions = await client.query(`
      SELECT proname, prosrc 
      FROM pg_proc 
      WHERE proname LIKE '%data_queue%' OR proname LIKE '%process%'
    `);
    
    console.log('\n📋 Related functions:');
    functions.rows.forEach(func => {
      console.log(`  ${func.proname}`);
    });
    
    // Try the simplest possible insert
    console.log('\n🧪 Testing simplest possible insert...');
    
    try {
      const result = await client.query(`
        INSERT INTO data_queue (raw_data, status, source)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [
        '{"imei": "666666666666666", "brand": "Test"}',
        'pending',
        'test'
      ]);
      
      console.log(`✅ Simple insert worked: ID ${result.rows[0].id}`);
      await client.query(`DELETE FROM data_queue WHERE id = $1`, [result.rows[0].id]);
      
    } catch (error) {
      console.log(`❌ Simple insert failed: ${error.message}`);
    }
    
    // Try with explicit column list
    console.log('\n🧪 Testing with explicit column list...');
    
    try {
      const result = await client.query(`
        INSERT INTO data_queue (id, raw_data, status, source, priority, retry_count, max_retries, created_at, updated_at, processed_at)
        VALUES (DEFAULT, $1, $2, $3, $4, $5, $6, NOW(), NOW(), NULL)
        RETURNING id
      `, [
        '{"imei": "555555555555555", "brand": "Test"}',
        'pending',
        'test',
        5,
        0,
        3
      ]);
      
      console.log(`✅ Explicit column insert worked: ID ${result.rows[0].id}`);
      await client.query(`DELETE FROM data_queue WHERE id = $1`, [result.rows[0].id]);
      
    } catch (error) {
      console.log(`❌ Explicit column insert failed: ${error.message}`);
    }
    
    // Check if there are any other tables with similar issues
    console.log('\n🔍 Checking for similar issues in other tables...');
    
    const otherTables = await client.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns 
      WHERE data_type = 'jsonb' AND table_name != 'data_queue'
    `);
    
    if (otherTables.rows.length > 0) {
      console.log('📋 Other tables with JSONB columns:');
      otherTables.rows.forEach(row => {
        console.log(`  ${row.table_name}.${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.log('📋 No other tables with JSONB columns found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkTableConstraints();


