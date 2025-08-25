const fs = require('fs');
const path = require('path');

console.log('🔧 Applying Queue Functions Migration');
console.log('=====================================\n');

try {
  // Read the migration file
  const migrationPath = path.join(__dirname, 'migrations', '013_add_queue_functions.sql');
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
  console.log('5. This will add the missing queue functions');
  
  console.log('\n✅ Migration ready to apply!');
  console.log('   This will fix the "retry_count does not exist" error');
  console.log('   and enable queue processing functionality.');
  
} catch (error) {
  console.error('❌ Error reading migration file:', error.message);
}
