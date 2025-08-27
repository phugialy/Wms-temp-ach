const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyConstraintFix() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔧 Applying device_test constraint fix...');
    
    await client.connect();
    console.log('✅ Connected to database');

    const fixScript = fs.readFileSync(
      path.join(__dirname, 'fix-device-test-constraint.sql'), 
      'utf8'
    );

    await client.query(fixScript);
    console.log('✅ Constraint fix applied successfully!');
    
  } catch (error) {
    console.error('❌ Error applying fix:', error);
    throw error;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  applyConstraintFix()
    .then(() => {
      console.log('🎉 Fix completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fix failed:', error);
      process.exit(1);
    });
}
