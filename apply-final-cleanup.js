const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyFinalCleanup() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔧 Starting final aggressive database cleanup...');
    
    // Connect to database
    await client.connect();
    console.log('✅ Connected to database');

    // Read and execute final cleanup script
    const cleanupScript = fs.readFileSync(
      path.join(__dirname, 'migrations', '025_final_cleanup.sql'), 
      'utf8'
    );

    console.log('🧹 Executing final cleanup script...');
    await client.query(cleanupScript);
    
    console.log('✅ Final cleanup completed successfully!');
    console.log('📋 Database is now completely clean and ready for new schema');
    
  } catch (error) {
    console.error('❌ Error during final cleanup:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run cleanup if this script is executed directly
if (require.main === module) {
  applyFinalCleanup()
    .then(() => {
      console.log('🎉 Final cleanup process completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Final cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = { applyFinalCleanup };
