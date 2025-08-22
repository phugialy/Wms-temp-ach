const fetch = require('node-fetch');

async function testImeiMismatch() {
    console.log('🔍 Testing IMEI Mismatch Issue');
    
    try {
        // Get current inventory
        const response = await fetch('http://localhost:3001/api/admin/inventory');
        const inventory = await response.json();
        
        console.log('\n📊 IMEI Analysis:');
        
        // Check for IMEI mismatches
        const mismatches = [];
        inventory.forEach(item => {
            const dbImei = item.imei;
            const phonecheckImei = item.testResults?.imei;
            
            if (dbImei && phonecheckImei && dbImei !== phonecheckImei) {
                mismatches.push({
                    itemId: item.id,
                    dbImei: dbImei,
                    phonecheckImei: phonecheckImei,
                    name: item.name
                });
            }
        });
        
        console.log(`Found ${mismatches.length} IMEI mismatches:`);
        mismatches.forEach(mismatch => {
            console.log(`  - Item ${mismatch.itemId} (${mismatch.name}):`);
            console.log(`    Database IMEI: ${mismatch.dbImei}`);
            console.log(`    PhoneCheck IMEI: ${mismatch.phonecheckImei}`);
        });
        
        // Test what happens when we try to add an item with PhoneCheck IMEI
        if (mismatches.length > 0) {
            const testItem = {
                name: "Test Device",
                brand: "Samsung",
                model: "Galaxy Test",
                storage: "256GB",
                color: "Test",
                carrier: "TEST",
                type: "phone",
                imei: mismatches[0].phonecheckImei, // Use PhoneCheck IMEI
                serialNumber: "TESTSERIAL123",
                condition: "SEVEN",
                working: "YES",
                quantity: 1,
                location: "DNCL-Inspection",
                batteryHealth: 95,
                testResults: {
                    imei: mismatches[0].phonecheckImei, // Same PhoneCheck IMEI
                    status: "success"
                },
                originalWorking: "YES",
                originalFailed: false
            };
            
            console.log('\n🧪 Testing with PhoneCheck IMEI:', mismatches[0].phonecheckImei);
            
            const testResponse = await fetch('http://localhost:3001/api/admin/inventory-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testItem)
            });
            
            if (testResponse.ok) {
                const result = await testResponse.json();
                console.log('✅ Result:', result);
                console.log(`  - This will UPDATE item ${result.data.itemId} instead of creating new`);
            } else {
                const error = await testResponse.json();
                console.log('❌ Error:', error);
            }
        }
        
        // Show the duplicate detection logic
        console.log('\n🔧 Duplicate Detection Logic:');
        console.log('1. Check by IMEI (from data.imei)');
        console.log('2. Check by Serial Number (if IMEI not found)');
        console.log('3. Check by SKU (if neither found)');
        console.log('');
        console.log('⚠️ Problem: PhoneCheck data has different IMEI than database!');
        console.log('   - Database stores: data.imei');
        console.log('   - PhoneCheck contains: data.testResults.imei');
        console.log('   - These can be different, causing updates instead of new items');
        
    } catch (error) {
        console.error('❌ Test Error:', error.message);
    }
}

testImeiMismatch();
