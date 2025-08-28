const { Client } = require('pg');
require('dotenv').config();

async function addCarrierOverrideColumn() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    console.log('\n🔄 ADDING CARRIER_OVERRIDE COLUMN TO SKU_MATCHING_RESULTS');
    console.log('==========================================================');

    // Check if the column already exists
    console.log('\n📋 Checking if carrier_override column exists...');
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sku_matching_results' 
      AND column_name = 'carrier_override'
    `;

    const columnCheck = await client.query(checkColumnQuery);

    if (columnCheck.rows.length > 0) {
      console.log('✅ carrier_override column already exists');
      return;
    }

    // Add the carrier_override column
    console.log('\n📋 Adding carrier_override column...');
    const addColumnQuery = `
      ALTER TABLE sku_matching_results 
      ADD COLUMN carrier_override JSONB
    `;

    await client.query(addColumnQuery);
    console.log('✅ carrier_override column added successfully');

    // Verify the column was added
    console.log('\n📋 Verifying column addition...');
    const verifyQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sku_matching_results' 
      AND column_name = 'carrier_override'
    `;

    const verifyResult = await client.query(verifyQuery);
    
    if (verifyResult.rows.length > 0) {
      const column = verifyResult.rows[0];
      console.log(`✅ Column verified: ${column.column_name} (${column.data_type})`);
    } else {
      console.log('❌ Column verification failed');
    }

    // Show table structure
    console.log('\n📋 Current sku_matching_results table structure:');
    const tableStructureQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'sku_matching_results'
      ORDER BY ordinal_position
    `;

    const tableStructure = await client.query(tableStructureQuery);
    
    tableStructure.rows.forEach((column, index) => {
      console.log(`   ${index + 1}. ${column.column_name} (${column.data_type}, ${column.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

    console.log('\n✅ carrier_override column addition completed successfully!');

  } catch (error) {
    console.error('❌ Error adding carrier_override column:', error);
  } finally {
    await client.end();
  }
}

addCarrierOverrideColumn().catch(console.error);
