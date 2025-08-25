const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';

async function testSingleAdd() {
  console.log('🧪 Testing Single Add Functionality');
  console.log('=====================================\n');

  try {
    // Test 1: Test PhoneCheck lookup
    console.log('1️⃣ Testing PhoneCheck lookup...');
    const lookupResponse = await fetch(`${BASE_URL}/api/phonecheck/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        imei: '123456789012345' 
      })
    });

    const lookupData = await lookupResponse.json();
    console.log('📱 PhoneCheck lookup result:', lookupData);

    if (lookupData.success) {
      console.log('✅ PhoneCheck lookup successful');
      
      // Test 2: Test inventory push with the lookup data
      console.log('\n2️⃣ Testing inventory push with PhoneCheck data...');
      const inventoryData = {
        ...lookupData.data,
        location: 'Station 1',
        quantity: 1
      };

      console.log('📦 Inventory data to push:', {
        name: inventoryData.name,
        brand: inventoryData.brand,
        model: inventoryData.model,
        imei: inventoryData.imei,
        working: inventoryData.working,
        failed: inventoryData.failed,
        location: inventoryData.location,
        quantity: inventoryData.quantity
      });

      const pushResponse = await fetch(`${BASE_URL}/api/admin/inventory-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inventoryData)
      });

      const pushData = await pushResponse.json();
      console.log('📦 Inventory push result:', pushData);

      if (pushData.success) {
        console.log('✅ Inventory push successful');
        console.log(`   Item ID: ${pushData.itemId}`);
        console.log(`   SKU: ${pushData.sku}`);
        console.log(`   Location: ${pushData.location}`);
        console.log(`   Quantity: ${pushData.quantity}`);
      } else {
        console.log('❌ Inventory push failed:', pushData.error);
      }
    } else {
      console.log('❌ PhoneCheck lookup failed:', lookupData.error);
    }

    // Test 3: Test locations API
    console.log('\n3️⃣ Testing locations API...');
    const locationsResponse = await fetch(`${BASE_URL}/api/admin/locations`);
    const locationsData = await locationsResponse.json();
    
    if (locationsData.success) {
      console.log(`✅ Locations API working - Found ${locationsData.data.length} locations`);
      console.log('   First 5 locations:', locationsData.data.slice(0, 5).map(l => l.name));
    } else {
      console.log('❌ Locations API failed:', locationsData.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testSingleAdd().catch(console.error);
