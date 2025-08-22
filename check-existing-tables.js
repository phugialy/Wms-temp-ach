const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseApiKey = process.env['SUPABASE_API_KEY'];

if (!supabaseUrl || !supabaseApiKey) {
  console.error('❌ Supabase URL or API Key not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseApiKey);

/**
 * Check what tables exist in your Supabase database
 */
async function checkExistingTables() {
  console.log('🔍 Checking existing tables in your Supabase database...\n');

  try {
    // Correct tables from current schema
    const correctTables = [
      'Item',
      'Warehouse', 
      'Location',
      'Inventory',
      'InboundLog',
      'OutboundLog',
      'ProcessingQueue',
      'QCApproval',
      'OutboundQueue',
      'DeviceTest',
      'ItemAuditLog'
    ];

    // Extra tables that should be cleaned up
    const extraTables = [
      'imei_detail',
      'imei_details',
      'inventory_item',
      'inventory_items',
      'inventory_ledger',
      'inventory_summary',
      'inventory_unit',
      'inventory_units',
      'movement',
      'outbound',
      'outbound_unit',
      'phonecheck_log',
      'product',
      'tag',
      'entity_tag',
      'unit_location_history',
      'unit_status_history'
    ];

    const results = {};

    // Check correct tables
    console.log('📊 Checking Correct Tables:');
    console.log('==========================');
    
    for (const tableName of correctTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        if (error) {
          results[tableName] = { exists: false, error: error.message, type: 'correct' };
        } else {
          results[tableName] = { exists: true, count: data?.length || 0, type: 'correct' };
        }
      } catch (err) {
        results[tableName] = { exists: false, error: err.message, type: 'correct' };
      }
    }

    // Check extra tables
    console.log('\n🧹 Checking Extra Tables (should be cleaned up):');
    console.log('===============================================');
    
    for (const tableName of extraTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        if (error) {
          results[tableName] = { exists: false, error: error.message, type: 'extra' };
        } else {
          results[tableName] = { exists: true, count: data?.length || 0, type: 'extra' };
        }
      } catch (err) {
        results[tableName] = { exists: false, error: err.message, type: 'extra' };
      }
    }

    // Display results for correct tables
    let existingCorrectTables = 0;
    let missingCorrectTables = 0;

    for (const [tableName, result] of Object.entries(results)) {
      if (result.type === 'correct') {
        if (result.exists) {
          console.log(`✅ ${tableName} - EXISTS (${result.count} records)`);
          existingCorrectTables++;
        } else {
          console.log(`❌ ${tableName} - MISSING (${result.error})`);
          missingCorrectTables++;
        }
      }
    }

    // Display results for extra tables
    let existingExtraTables = 0;
    console.log('\n🧹 Extra Tables Status:');
    console.log('=======================');
    
    for (const [tableName, result] of Object.entries(results)) {
      if (result.type === 'extra') {
        if (result.exists) {
          console.log(`⚠️  ${tableName} - STILL EXISTS (${result.count} records) - NEEDS CLEANUP`);
          existingExtraTables++;
        } else {
          console.log(`✅ ${tableName} - ALREADY CLEANED UP`);
        }
      }
    }

    console.log('\n📈 Summary:');
    console.log(`  • Correct tables existing: ${existingCorrectTables}/${correctTables.length}`);
    console.log(`  • Correct tables missing: ${missingCorrectTables}`);
    console.log(`  • Extra tables still existing: ${existingExtraTables}`);
    console.log(`  • Extra tables cleaned up: ${extraTables.length - existingExtraTables}`);

    if (missingCorrectTables > 0) {
      console.log('\n🚨 Action Required:');
      console.log('  You need to create the missing tables in your database.');
      console.log('  Run the cleanup-and-create-tables.sql script in your Supabase SQL Editor.');
    }

    if (existingExtraTables > 0) {
      console.log('\n🧹 Cleanup Required:');
      console.log('  Some extra tables still exist and need to be cleaned up.');
      console.log('  Run the cleanup-and-create-tables.sql script in your Supabase SQL Editor.');
    }

    if (missingCorrectTables === 0 && existingExtraTables === 0) {
      console.log('\n✅ Perfect! All tables are correctly set up.');
      console.log('  • All correct tables exist');
      console.log('  • All extra tables have been cleaned up');
      console.log('  • Your database is ready for the auto-update system');
    }

    return results;

  } catch (error) {
    console.error('❌ Error checking tables:', error.message);
    throw error;
  }
}

// Run the check
checkExistingTables().catch(console.error);
