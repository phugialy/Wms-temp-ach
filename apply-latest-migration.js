const fs = require('fs');
const path = require('path');

console.log('🔧 Applying Latest Database Migration\n');

// Read the latest migration file
const migrationFile = path.join(__dirname, 'migrations', '007_fix_recursive_triggers.sql');

if (!fs.existsSync(migrationFile)) {
    console.log('❌ Migration file not found:', migrationFile);
    process.exit(1);
}

console.log('📄 Reading migration file:', migrationFile);
const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

console.log('📋 Migration content preview:');
console.log('   - Drops old recursive triggers');
console.log('   - Creates safe_archive_imei_data function');
console.log('   - Creates cascade_delete_imei_complete function');
console.log('   - Creates cleanup_imei_data wrapper function');
console.log('   - Sets up proper archival system');

console.log('\n🚀 To apply this migration, you need to:');
console.log('\n1. Connect to your Supabase database (or local PostgreSQL)');
console.log('2. Run the SQL commands from: migrations/007_fix_recursive_triggers.sql');
console.log('\n   You can do this by:');
console.log('   - Using Supabase Dashboard > SQL Editor');
console.log('   - Using psql command line tool');
console.log('   - Using any PostgreSQL client');

console.log('\n📝 Migration SQL file location:');
console.log(`   ${migrationFile}`);

console.log('\n⚠️  Important Notes:');
console.log('   - This migration fixes the "stack depth limit exceeded" error');
console.log('   - It separates archiving and cascading logic to prevent recursion');
console.log('   - The cleanup_imei_data function is now safe to use');
console.log('   - All IMEI-related tables will be properly set up');

console.log('\n🎯 After applying the migration:');
console.log('1. The enhanced search functionality will work');
console.log('2. The data cleanup page will function properly');
console.log('3. Bulk deletion will work without recursion errors');

console.log('\n📖 To view the migration content, run:');
console.log(`   cat "${migrationFile}"`);

console.log('\n✅ Migration instructions complete!');
