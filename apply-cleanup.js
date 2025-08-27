const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyCleanup() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔧 Starting database cleanup...');
    
    // Connect to database
    await client.connect();
    console.log('✅ Connected to database');

    // Read and execute cleanup script
    const cleanupScript = fs.readFileSync(
      path.join(__dirname, 'migrations', '023_cleanup_database.sql'), 
      'utf8'
    );

    console.log('🧹 Executing cleanup script...');
    await client.query(cleanupScript);
    
    console.log('✅ Database cleanup completed successfully!');
    console.log('📋 Ready to apply new IMEI-centric schema');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run cleanup if this script is executed directly
if (require.main === module) {
  applyCleanup()
    .then(() => {
      console.log('🎉 Cleanup process completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = { applyCleanup };
