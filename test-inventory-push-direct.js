const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';

async function testInventoryPushDirect() {
  console.log('🧪 Testing Inventory Push Direct (with mock data)');
  console.log('================================================\n');

  try {
    // Test 1: Test inventory push with mock PhoneCheck data (boolean values)
    console.log('1️⃣ Testing inventory push with boolean working/failed values...');
    const mockDataBoolean = {
      name: 'Test iPhone 12',
      brand: 'Apple',
      model: 'iPhone 12',
      storage: '128GB',
      color: 'Black',
      carrier: 'Unlocked',
      type: 'SMARTPHONE',
      imei: '123456789012345',
      serialNumber: 'TEST123456',
      quantity: 1,
      location: 'Station 1',
      working: true,  // Boolean value
      failed: false,  // Boolean value
      batteryHealth: 85,
      screenCondition: 'Good',
      bodyCondition: 'Excellent'
    };

    console.log('📦 Mock data with boolean values:', {
      working: mockDataBoolean.working,
      failed: mockDataBoolean.failed,
      type: typeof mockDataBoolean.working
    });

    const response1 = await fetch(`${BASE_URL}/api/admin/inventory-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mockDataBoolean)
    });

    const result1 = await response1.json();
    console.log('📦 Inventory push result (boolean):', result1);

    if (result1.success) {
      console.log('✅ Inventory push with boolean values successful');
      console.log(`   Item ID: ${result1.data.itemId}`);
      console.log(`   SKU: ${result1.data.sku}`);
      console.log(`   Location: ${result1.data.location}`);
      console.log(`   Quantity: ${result1.data.quantity}`);
    } else {
      console.log('❌ Inventory push with boolean values failed:', result1.error);
    }

    // Test 2: Test inventory push with string working/failed values
    console.log('\n2️⃣ Testing inventory push with string working/failed values...');
    const mockDataString = {
      name: 'Test Samsung Galaxy',
      brand: 'Samsung',
      model: 'Galaxy S21',
      storage: '256GB',
      color: 'White',
      carrier: 'Verizon',
      type: 'SMARTPHONE',
      imei: '987654321098765',  // Different IMEI
      serialNumber: 'TEST654321',
      quantity: 1,
      location: 'Station 2',
      working: 'YES',  // String value
      failed: 'NO',    // String value
      batteryHealth: 92,
      screenCondition: 'Excellent',
      bodyCondition: 'Good'
    };

    console.log('📦 Mock data with string values:', {
      working: mockDataString.working,
      failed: mockDataString.failed,
      type: typeof mockDataString.working
    });

    const response2 = await fetch(`${BASE_URL}/api/admin/inventory-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mockDataString)
    });

    const result2 = await response2.json();
    console.log('📦 Inventory push result (string):', result2);

    if (result2.success) {
      console.log('✅ Inventory push with string values successful');
      console.log(`   Item ID: ${result2.data.itemId}`);
      console.log(`   SKU: ${result2.data.sku}`);
      console.log(`   Location: ${result2.data.location}`);
      console.log(`   Quantity: ${result2.data.quantity}`);
    } else {
      console.log('❌ Inventory push with string values failed:', result2.error);
    }

    // Test 3: Test locations API
    console.log('\n3️⃣ Testing locations API...');
    const locationsResponse = await fetch(`${BASE_URL}/api/admin/locations`);
    const locationsData = await locationsResponse.json();
    
    if (Array.isArray(locationsData)) {
      console.log(`✅ Locations API working - Found ${locationsData.length} locations`);
      console.log('   First 5 locations:', locationsData.slice(0, 5).map(l => l.name));
    } else {
      console.log('❌ Locations API failed:', locationsData.error || 'Unexpected response format');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testInventoryPushDirect().catch(console.error);
