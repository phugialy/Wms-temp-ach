const fetch = require('node-fetch');

async function testInventoryCount() {
    console.log('🔍 Testing Inventory Count and Data Structure');
    
    try {
        // Test 1: Get inventory via API
        console.log('\n📊 Test 1: Getting inventory via API...');
        const response = await fetch('http://localhost:3001/api/admin/inventory');
        
        if (response.ok) {
            const inventory = await response.json();
            console.log('✅ API Response:');
            console.log(`  - Total items returned: ${inventory.length}`);
            console.log(`  - Items with isActive=true: ${inventory.filter(item => item.isActive === true).length}`);
            console.log(`  - Items with isActive=false: ${inventory.filter(item => item.isActive === false).length}`);
            console.log(`  - Items with no isActive: ${inventory.filter(item => item.isActive === undefined || item.isActive === null).length}`);
            
            // Show sample items
            console.log('\n📱 Sample Items:');
            inventory.slice(0, 3).forEach((item, index) => {
                console.log(`  Item ${index + 1}:`, {
                    id: item.id,
                    name: item.name,
                    imei: item.imei,
                    isActive: item.isActive,
                    working: item.working,
                    createdAt: item.createdAt
                });
            });
            
            // Check for PhoneCheck data
            console.log('\n📋 PhoneCheck Data Analysis:');
            const withPhoneCheckData = inventory.filter(item => item.testResults);
            console.log(`  - Items with testResults: ${withPhoneCheckData.length}`);
            console.log(`  - Items with batteryHealth: ${inventory.filter(item => item.batteryHealth).length}`);
            console.log(`  - Items with screenCondition: ${inventory.filter(item => item.screenCondition).length}`);
            
        } else {
            const errorData = await response.json();
            console.error('❌ API Error:', errorData);
        }
        
        // Test 2: Check raw database count
        console.log('\n📊 Test 2: Checking raw database...');
        const rawResponse = await fetch('http://localhost:3001/api/admin/inventory?debug=true');
        
        if (rawResponse.ok) {
            const rawData = await rawResponse.json();
            console.log('✅ Raw Database Data:', rawData);
        } else {
            console.log('⚠️ Debug endpoint not available');
        }
        
    } catch (error) {
        console.error('❌ Test Error:', error.message);
    }
}

testInventoryCount();
