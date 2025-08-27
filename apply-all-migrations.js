const fs = require('fs');
const path = require('path');

console.log('🚀 Applying All Hybrid Queue Migrations...\n');

// Read both migration files
const enhanceQueuePath = path.join(__dirname, 'migrations', '022_enhance_queue_table.sql');
const missingTablesPath = path.join(__dirname, 'create-missing-tables.sql');

const enhanceQueueContent = fs.readFileSync(enhanceQueuePath, 'utf8');
const missingTablesContent = fs.readFileSync(missingTablesPath, 'utf8');

console.log('📋 Migration 1: Enhance Queue Table');
console.log('=' .repeat(50));
console.log(enhanceQueueContent);
console.log('=' .repeat(50));

console.log('\n📋 Migration 2: Create Missing Tables');
console.log('=' .repeat(50));
console.log(missingTablesContent);
console.log('=' .repeat(50));

console.log('\n📝 Instructions to apply these migrations:');
console.log('1. Go to your Supabase Dashboard');
console.log('2. Navigate to SQL Editor');
console.log('3. Copy and paste Migration 1 (Enhance Queue Table)');
console.log('4. Click "Run" to execute');
console.log('5. Copy and paste Migration 2 (Create Missing Tables)');
console.log('6. Click "Run" to execute');

console.log('\n⚠️  These migrations will:');
console.log('   Migration 1:');
console.log('   - Add new columns to imei_data_queue table');
console.log('   - Create indexes for better performance');
console.log('   - Add triggers for automatic timestamp updates');
console.log('   - Create SQL functions for queue management');
console.log('   - Grant necessary permissions');
console.log('');
console.log('   Migration 2:');
console.log('   - Create queue_processing_log table');
console.log('   - Create queue_batch table');
console.log('   - Add indexes and triggers');
console.log('   - Grant necessary permissions');

console.log('\n🔧 After applying both migrations:');
console.log('1. Run: npm run dev (to start the server)');
console.log('2. Run: node test-hybrid-queue.js (to test the system)');

console.log('\n✅ All migrations ready to apply!');
console.log('\n💡 Tip: Apply them one at a time to ensure each completes successfully.');

