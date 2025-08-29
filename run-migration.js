const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

async function runMigration(migrationFile) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log(`\n📋 Running migration: ${migrationFile}`);
    
    // Read the migration file
    const migrationSQL = fs.readFileSync(migrationFile, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the view was created correctly
    console.log('\n🔍 Verifying view structure...');
    
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sku_matching_view' 
      AND column_name = 'device_notes'
      ORDER BY ordinal_position
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ device_notes column found in sku_matching_view');
    } else {
      console.log('❌ device_notes column NOT found in sku_matching_view');
    }
    
    // Test with a sample query
    console.log('\n🧪 Testing view with sample data...');
    
    const testResult = await client.query(`
      SELECT imei, brand, model, carrier, device_notes 
      FROM sku_matching_view 
      WHERE device_notes IS NOT NULL 
      LIMIT 3
    `);
    
    console.log(`📊 Found ${testResult.rows.length} devices with notes:`);
    testResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. IMEI: ${row.imei}, Brand: ${row.brand}, Notes: "${row.device_notes}"`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await client.end();
  }
}

// Get migration file from command line argument
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('❌ Please provide a migration file path as an argument');
  console.error('Usage: node run-migration.js <migration-file>');
  process.exit(1);
}

runMigration(migrationFile);
