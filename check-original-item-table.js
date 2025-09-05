const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function checkOriginalItemTable() {
  const client = await pool.connect();
  try {
    // Check the original lowercase item table structure
    const itemResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'item' 
      ORDER BY ordinal_position
    `);
    
    console.log('Original item table structure:');
    itemResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    console.log('\n---\n');
    
    // Check the capitalized Item table structure
    const ItemResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'Item' 
      ORDER BY ordinal_position
    `);
    
    console.log('Capitalized Item table structure:');
    ItemResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    console.log('\n---\n');
    
    // Check data in both tables
    const itemCount = await client.query(`SELECT COUNT(*) as count FROM item`);
    const ItemCount = await client.query(`SELECT COUNT(*) as count FROM "Item"`);
    
    console.log(`Data counts:`);
    console.log(`  item (lowercase): ${itemCount.rows[0].count} records`);
    console.log(`  Item (capitalized): ${ItemCount.rows[0].count} records`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkOriginalItemTable();


