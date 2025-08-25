const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

async function testFlexibleQueue() {
  console.log('🧪 Testing Flexible Queue Processing');
  console.log('===================================\n');

  try {
    // Test data with different levels of completeness
    const testItems = [
      // Complete data
      {
        imei: 'TEST_COMPLETE_001',
        name: 'iPhone 15 Pro Max',
        brand: 'Apple',
        model: 'iPhone 15 Pro Max',
        storage: '256GB',
        color: 'Titanium',
        carrier: 'Unlocked',
        working: 'YES',
        batteryHealth: 95,
        location: 'Test Location',
        notes: 'Complete test item'
      },
      // Partial data
      {
        imei: 'TEST_PARTIAL_002',
        name: 'Samsung Galaxy S24',
        brand: 'Samsung',
        // Missing model, storage, color, carrier
        working: 'YES',
        location: 'Test Location'
      },
      // Minimal data
      {
        imei: 'TEST_MINIMAL_003',
        name: 'Unknown Device',
        // Only IMEI and name
        location: 'Test Location'
      },
      // Different field names
      {
        IMEI: 'TEST_ALT_NAMES_004',
        deviceName: 'Google Pixel 8',
        manufacturer: 'Google',
        deviceModel: 'Pixel 8',
        capacity: '128GB',
        deviceColor: 'Obsidian',
        network: 'Verizon',
        status: 'YES',
        battery: 88,
        comments: 'Alternative field names test'
      }
    ];

    console.log('📝 Adding test items to queue...\n');

    // Add items to queue
    for (const item of testItems) {
      const { data, error } = await supabase
        .from('imei_data_queue')
        .insert({
          raw_data: item,
          status: 'pending'
        });

      if (error) {
        console.error(`❌ Failed to add item ${item.imei || item.IMEI}:`, error.message);
      } else {
        console.log(`✅ Added item ${item.imei || item.IMEI} to queue`);
      }
    }

    console.log('\n🔄 Processing queue items...\n');

    // Process the queue using the API
    const response = await fetch('http://localhost:3001/api/imei-queue/process-pending', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Queue processing result:', result);
    } else {
      console.error('❌ Queue processing failed:', response.status, response.statusText);
    }

    // Check results
    console.log('\n📊 Checking results...\n');

    // Check queue status
    const { data: queueStatus } = await supabase
      .from('imei_data_queue')
      .select('*')
      .in('raw_data->>imei', ['TEST_COMPLETE_001', 'TEST_PARTIAL_002', 'TEST_MINIMAL_003', 'TEST_ALT_NAMES_004'])
      .or('raw_data->>IMEI.eq.TEST_ALT_NAMES_004');

    console.log('📦 Queue Status:');
    queueStatus?.forEach(item => {
      const imei = item.raw_data.imei || item.raw_data.IMEI;
      console.log(`   ${imei}: ${item.status}${item.error_message ? ` (${item.error_message})` : ''}`);
    });

    // Check created items
    const { data: createdItems } = await supabase
      .from('Item')
      .select('*')
      .in('imei', ['TEST_COMPLETE_001', 'TEST_PARTIAL_002', 'TEST_MINIMAL_003', 'TEST_ALT_NAMES_004']);

    console.log('\n📱 Created Items:');
    createdItems?.forEach(item => {
      console.log(`   ${item.imei}:`);
      console.log(`     Name: ${item.name}`);
      console.log(`     Brand: ${item.brand}`);
      console.log(`     Model: ${item.model}`);
      console.log(`     Storage: ${item.storage}`);
      console.log(`     Color: ${item.color}`);
      console.log(`     Carrier: ${item.carrier}`);
      console.log(`     Working: ${item.working}`);
      console.log(`     Battery: ${item.batteryHealth || 'N/A'}`);
      console.log('');
    });

    console.log('🎯 Analysis:');
    console.log('============');
    console.log('✅ Flexible processing should handle all data levels');
    console.log('✅ Items with minimal data should still be processed');
    console.log('✅ Alternative field names should be recognized');
    console.log('✅ Missing fields should use fallback values');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFlexibleQueue().catch(console.error);
