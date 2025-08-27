const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyNewSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔧 Applying new IMEI-centric database schema...');
    
    // Connect to database
    await client.connect();
    console.log('✅ Connected to database');

    // Read and execute new schema script
    const schemaScript = fs.readFileSync(
      path.join(__dirname, 'migrations', '024_revamp_database_schema.sql'), 
      'utf8'
    );

    console.log('🏗️ Executing new schema script...');
    await client.query(schemaScript);
    
    console.log('✅ New IMEI-centric schema applied successfully!');
    console.log('📋 Database is ready for the new queue system');
    
  } catch (error) {
    console.error('❌ Error applying new schema:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run schema application if this script is executed directly
if (require.main === module) {
  applyNewSchema()
    .then(() => {
      console.log('🎉 New schema application completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Schema application failed:', error);
      process.exit(1);
    });
}

module.exports = { applyNewSchema };
