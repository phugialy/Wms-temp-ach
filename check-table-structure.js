const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function checkTableStructure() {
  const client = await pool.connect();
  try {
    // Check product table
    const productResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'product' 
      ORDER BY ordinal_position
    `);
    
    console.log('Product table structure:');
    productResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });
    
    console.log('\n---\n');
    
    // Check item table
    const itemResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'item' 
      ORDER BY ordinal_position
    `);
    
    console.log('Item table structure:');
    itemResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkTableStructure();