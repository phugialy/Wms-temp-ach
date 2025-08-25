const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

async function checkItemSchema() {
  console.log('🔍 Checking Item Table Schema');
  console.log('=============================\n');

  try {
    // Get a sample item to see the structure
    const { data: sampleItem, error: sampleError } = await supabase
      .from('Item')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.error('❌ Error fetching sample item:', sampleError);
      return;
    }

    if (sampleItem && sampleItem.length > 0) {
      console.log('📋 Item Table Columns:');
      const item = sampleItem[0];
      Object.keys(item).forEach(key => {
        console.log(`   - ${key}: ${typeof item[key]} (${item[key]})`);
      });
    } else {
      console.log('📋 No items found in Item table');
    }

    // Try to get table info using RPC
    console.log('\n🔍 Attempting to get table schema...');
    
    // Try a simple insert to see what columns are accepted
    const testData = {
      imei: 'SCHEMA_TEST_001',
      name: 'Test Device',
      sku: 'TEST-SKU-001',
      type: 'SMARTPHONE',
      status: 'active'
    };

    console.log('📝 Testing insert with basic fields:', testData);

    const { data: insertResult, error: insertError } = await supabase
      .from('Item')
      .insert(testData)
      .select('*')
      .single();

    if (insertError) {
      console.error('❌ Insert error:', insertError.message);
    } else {
      console.log('✅ Insert successful:', insertResult);
    }

  } catch (error) {
    console.error('❌ Check failed:', error.message);
  }
}

checkItemSchema().catch(console.error);
