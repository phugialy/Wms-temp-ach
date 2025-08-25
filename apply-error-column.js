const fs = require('fs');
const path = require('path');

console.log('🔧 Adding Error Message Column to Queue Table');
console.log('=============================================\n');

try {
  // Read the migration file
  const migrationPath = path.join(__dirname, 'migrations', '017_add_error_message_column.sql');
  const migrationContent = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('📋 Migration Content:');
  console.log('=====================');
  console.log(migrationContent);
  
  console.log('\n📝 Instructions to Apply:');
  console.log('==========================');
  console.log('1. Copy the SQL content above');
  console.log('2. Go to your Supabase dashboard');
  console.log('3. Navigate to SQL Editor');
  console.log('4. Paste the SQL content and execute');
  console.log('5. This will add the missing error_message column');
  
  console.log('\n🎯 What This Fixes:');
  console.log('===================');
  console.log('✅ Adds missing error_message column to imei_data_queue table');
  console.log('✅ Allows the queue processing function to store error messages');
  console.log('✅ Will enable proper error logging and debugging');
  console.log('✅ Fixes the "column error_message does not exist" error');
  
  console.log('\n⚠️  IMPORTANT:');
  console.log('==============');
  console.log('This is a simple ALTER TABLE command that adds a new column.');
  console.log('It will not affect existing data and is safe to run.');
  console.log('After this, the queue processing function will work properly.');
  
  console.log('\n✅ Migration ready to apply!');
  console.log('   This will fix the missing column error and enable proper error logging.');
  
} catch (error) {
  console.error('❌ Error reading migration file:', error.message);
}
