const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseApiKey = process.env['SUPABASE_API_KEY'];

if (!supabaseUrl || !supabaseApiKey) {
  console.error('❌ Supabase URL or API Key not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseApiKey);

async function setupOptimizedDatabase() {
  console.log('🔧 Setting up optimized database schema for bulk PhoneCheck processing...\n');

  try {
    // Read the SQL script
    const sqlPath = path.join(__dirname, 'setup-optimized-tables.sql');
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');

    console.log('📡 Executing SQL script in Supabase...');
    
    // Split the SQL script into individual statements
    const statements = sqlScript
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    let executedCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      try {
        if (statement.trim()) {
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          
          if (error) {
            console.error(`❌ Error executing statement: ${error.message}`);
            console.error(`Statement: ${statement.substring(0, 100)}...`);
            errorCount++;
          } else {
            executedCount++;
          }
        }
      } catch (error) {
        console.error(`❌ Error executing statement: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n📊 SQL Execution Summary:`);
    console.log(`   ✅ Successfully executed: ${executedCount} statements`);
    console.log(`   ❌ Errors: ${errorCount} statements`);

    if (errorCount === 0) {
      console.log('\n✅ Database setup completed successfully!');
      
      // Test the new tables
      console.log('\n🔍 Testing new tables...');
      await testNewTables();
      
    } else {
      console.log('\n⚠️  Database setup completed with errors. Some tables may not have been created.');
    }

  } catch (error) {
    console.error('❌ Database setup failed:', error);
  }
}

async function testNewTables() {
  try {
    // Test IMEI Details table
    const { data: imeiData, error: imeiError } = await supabase
      .from('imei_details')
      .select('*')
      .limit(5);

    if (imeiError) {
      console.error('❌ IMEI Details table test failed:', imeiError.message);
    } else {
      console.log(`✅ IMEI Details table: ${imeiData.length} records found`);
    }

    // Test Inventory Items table
    const { data: itemsData, error: itemsError } = await supabase
      .from('inventory_items')
      .select('*')
      .limit(5);

    if (itemsError) {
      console.error('❌ Inventory Items table test failed:', itemsError.message);
    } else {
      console.log(`✅ Inventory Items table: ${itemsData.length} records found`);
    }

    // Test Inventory Units table
    const { data: unitsData, error: unitsError } = await supabase
      .from('inventory_units')
      .select('*')
      .limit(5);

    if (unitsError) {
      console.error('❌ Inventory Units table test failed:', unitsError.message);
    } else {
      console.log(`✅ Inventory Units table: ${unitsData.length} records found`);
    }

    // Test the inventory summary view
    const { data: summaryData, error: summaryError } = await supabase
      .from('inventory_summary')
      .select('*')
      .limit(5);

    if (summaryError) {
      console.error('❌ Inventory Summary view test failed:', summaryError.message);
    } else {
      console.log(`✅ Inventory Summary view: ${summaryData.length} records found`);
    }

  } catch (error) {
    console.error('❌ Table testing failed:', error);
  }
}

// Alternative approach using direct SQL execution
async function setupDatabaseAlternative() {
  console.log('🔧 Setting up database using alternative method...\n');

  try {
    // Create tables one by one using the Supabase client
    console.log('📝 Creating IMEI Details table...');
    
    // Note: This approach may not work due to Supabase limitations
    // You may need to run the SQL script directly in the Supabase dashboard
    
    console.log('💡 Since direct SQL execution may be limited, please:');
    console.log('   1. Go to your Supabase dashboard');
    console.log('   2. Navigate to the SQL Editor');
    console.log('   3. Copy and paste the contents of setup-optimized-tables.sql');
    console.log('   4. Execute the script');
    console.log('   5. Then run this script again to test the tables');

  } catch (error) {
    console.error('❌ Alternative setup failed:', error);
  }
}

// Main execution
if (require.main === module) {
  setupOptimizedDatabase().catch(console.error);
}

module.exports = { setupOptimizedDatabase, testNewTables };
