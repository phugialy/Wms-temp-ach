// Test Database Push Functionality
const BASE_URL = 'http://localhost:3001';

async function testDatabasePush() {
  console.log('🧪 Testing Database Push Functionality...\n');
  
  const testCases = [
    {
      name: 'Valid Device Data - Standard Location',
      data: {
        name: 'Samsung Galaxy Tab S8+',
        brand: 'Samsung',
        model: 'Galaxy Tab S8+',
        storage: '128GB',
        color: 'Obsidian',
        carrier: 'Unlocked',
        type: 'tablet',
        imei: '123456789012345',
        serialNumber: 'R52T509SESW',
        quantity: 1,
        location: 'Test Location'
      }
    },
    {
      name: 'Valid Device Data - DNCL Prefixed Location',
      data: {
        name: 'Google Pixel 7 Pro',
        brand: 'Google',
        model: 'Pixel 7 Pro',
        storage: '128GB',
        color: 'Obsidian',
        carrier: 'Unlocked',
        type: 'phone',
        imei: '987654321098765',
        serialNumber: 'R52W402ERMR',
        quantity: 1,
        location: 'DNCL-Warehouse-A'
      }
    },
    {
      name: 'Valid Device Data - Minimal Fields',
      data: {
        name: 'iPhone 14 Pro',
        brand: 'Apple',
        model: 'iPhone 14 Pro',
        type: 'phone',
        imei: '111222333444555',
        quantity: 1,
        location: 'Storage Room'
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`📋 Testing: ${testCase.name}`);
    
    try {
      const response = await fetch(`${BASE_URL}/api/admin/inventory-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testCase.data)
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log(`✅ SUCCESS: ${testCase.name}`);
        console.log(`   Item ID: ${result.data.itemId}`);
        console.log(`   SKU: ${result.data.sku}`);
        console.log(`   Location: ${result.data.location}`);
        console.log(`   Quantity: ${result.data.quantity}`);
      } else {
        console.log(`❌ FAILED: ${testCase.name}`);
        console.log(`   Error: ${result.error}`);
        console.log(`   Status: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ERROR: ${testCase.name}`);
      console.log(`   Error: ${error.message}`);
    }
    
    console.log(''); // Empty line for readability
  }
}

// Run the test
testDatabasePush().catch(console.error);


