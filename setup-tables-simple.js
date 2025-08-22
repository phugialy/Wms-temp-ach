const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseApiKey = process.env['SUPABASE_API_KEY'];

if (!supabaseUrl || !supabaseApiKey) {
  console.error('❌ Supabase URL or API Key not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseApiKey);

async function setupTablesSimple() {
  console.log('🔧 Setting up optimized tables using Supabase client...\n');

  try {
    // Test if tables already exist
    console.log('🔍 Checking existing tables...');
    await testExistingTables();

    console.log('\n💡 Since we need to create tables with complex schema, please:');
    console.log('   1. Go to your Supabase dashboard');
    console.log('   2. Navigate to the SQL Editor');
    console.log('   3. Copy and paste the contents of setup-optimized-tables.sql');
    console.log('   4. Execute the script');
    console.log('   5. Then run this script again to test the tables');

    console.log('\n📋 Here\'s the SQL to copy:');
    console.log('=====================================');
    
    const fs = require('fs');
    const sqlContent = fs.readFileSync('setup-optimized-tables.sql', 'utf8');
    console.log(sqlContent);
    console.log('=====================================');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

async function testExistingTables() {
  try {
    // Test IMEI Details table
    const { data: imeiData, error: imeiError } = await supabase
      .from('imei_details')
      .select('*')
      .limit(1);

    if (imeiError) {
      console.log('❌ IMEI Details table: Not found');
    } else {
      console.log('✅ IMEI Details table: Found');
    }

    // Test Inventory Items table
    const { data: itemsData, error: itemsError } = await supabase
      .from('inventory_items')
      .select('*')
      .limit(1);

    if (itemsError) {
      console.log('❌ Inventory Items table: Not found');
    } else {
      console.log('✅ Inventory Items table: Found');
    }

    // Test Inventory Units table
    const { data: unitsData, error: unitsError } = await supabase
      .from('inventory_units')
      .select('*')
      .limit(1);

    if (unitsError) {
      console.log('❌ Inventory Units table: Not found');
    } else {
      console.log('✅ Inventory Units table: Found');
    }

  } catch (error) {
    console.error('❌ Table testing failed:', error);
  }
}

// Main execution
if (require.main === module) {
  setupTablesSimple().catch(console.error);
}

module.exports = { setupTablesSimple, testExistingTables };
