const fetch = require('node-fetch');

async function testSimpleDBVerification() {
    console.log('🔍 Simple Database Verification Test');
    console.log('====================================');

    // Get current database state
    console.log('\n📊 Getting current database state...');
    const initialInventory = await getInventory();
    console.log(`📊 Current database count: ${initialInventory.length}`);

    // Test a single item push
    console.log('\n📤 Testing single item push...');
    const testItem = {
        name: "Simple Test Device",
        brand: "TestBrand",
        model: "TestModel",
        storage: "128GB",
        color: "Test Color",
        carrier: "Test Carrier",
        type: "phone",
        imei: `SIMPLE_TEST_${Date.now()}`,
        serialNumber: `SIMPLE_SERIAL_${Date.now()}`,
        condition: "EXCELLENT",
        working: "YES",
        quantity: 1,
        location: "DNCL-Inspection",
        batteryHealth: 95
    };

    try {
        console.log(`📤 Pushing item: ${testItem.imei}`);
        
        const response = await fetch('http://localhost:3001/api/admin/inventory-push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testItem)
        });

        const responseText = await response.text();
        
        if (response.ok) {
            console.log('✅ Item pushed successfully');
            
            // Wait a moment for database to update
            console.log('⏳ Waiting for database to update...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Verify the item is in the database
            console.log('\n🔍 Verifying item in database...');
            const finalInventory = await getInventory();
            console.log(`📊 Final database count: ${finalInventory.length}`);
            
            const foundItem = finalInventory.find(item => item.imei === testItem.imei);
            
            if (foundItem) {
                console.log('✅ Item found in database!');
                console.log(`  - IMEI: ${foundItem.imei}`);
                console.log(`  - Name: ${foundItem.name}`);
                console.log(`  - ID: ${foundItem.id}`);
                console.log(`  - Created: ${foundItem.createdAt}`);
                
                console.log('\n🎉 SUCCESS: Database operations working correctly!');
                return true;
            } else {
                console.log('❌ Item not found in database');
                console.log('\n⚠️  WARNING: Item was pushed but not found in database');
                return false;
            }
            
        } else {
            console.log(`❌ Push failed: ${response.status} - ${responseText}`);
            console.log('\n⚠️  WARNING: Push operation failed');
            return false;
        }

    } catch (error) {
        console.log(`❌ Network error: ${error.message}`);
        console.log('\n⚠️  WARNING: Network error occurred');
        return false;
    }
}

async function getInventory() {
    try {
        const response = await fetch('http://localhost:3001/api/admin/inventory');
        if (response.ok) {
            return await response.json();
        }
        return [];
    } catch (error) {
        console.log('❌ Error getting inventory:', error.message);
        return [];
    }
}

testSimpleDBVerification();
