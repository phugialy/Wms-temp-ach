const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

async function checkDatabaseSchema() {
  console.log('🔍 Checking Database Schema');
  console.log('===========================\n');

  try {
    // Get a sample item to see what columns exist
    const { data: sampleItem, error: sampleError } = await supabase
      .from('Item')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.error('❌ Error fetching sample item:', sampleError);
      return;
    }

    if (sampleItem && sampleItem.length > 0) {
      console.log('📋 Item Table Schema (from sample data):');
      console.log('========================================');
      const item = sampleItem[0];
      Object.keys(item).forEach(key => {
        console.log(`   ${key}: ${typeof item[key]} = ${item[key]}`);
      });
    }

    // Check if we can query specific columns
    console.log('\n🔍 Testing Column Access:');
    console.log('========================');
    
    const { data: testQuery, error: testError } = await supabase
      .from('Item')
      .select('imei, name, brand, model, storage, color, carrier, working, condition, batteryHealth, notes')
      .limit(1);

    if (testError) {
      console.error('❌ Error with specific column query:', testError);
    } else if (testQuery && testQuery.length > 0) {
      console.log('✅ Specific columns query successful:');
      const item = testQuery[0];
      Object.keys(item).forEach(key => {
        console.log(`   ${key}: ${item[key]}`);
      });
    }

    // Check what the actual data looks like for a recent item
    console.log('\n📱 Recent Item Data (Raw):');
    console.log('==========================');
    const { data: recentItem, error: recentError } = await supabase
      .from('Item')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!recentError && recentItem && recentItem.length > 0) {
      const item = recentItem[0];
      console.log('Raw item data:');
      console.log(JSON.stringify(item, null, 2));
    }

  } catch (error) {
    console.error('❌ Schema check failed:', error.message);
  }
}

checkDatabaseSchema().catch(console.error);
