const fetch = require('node-fetch');

async function testImeiUniqueLogic() {
    console.log('🔍 Testing IMEI Unique Logic');
    
    try {
        // Test data with same SKU but different IMEIs
        const testItems = [
            {
                name: "GALAXY Z FOLD4 DUOS 512GB",
                brand: "Samsung",
                model: "Galaxy Z Fold4 Duos",
                storage: "512GB",
                color: "Gray Green",
                carrier: "UNLOCKED",
                type: "phone",
                imei: "TEST_IMEI_001",
                serialNumber: "TEST_SERIAL_001",
                condition: "SEVEN",
                working: "YES",
                quantity: 1,
                location: "Main Warehouse",
                batteryHealth: "95",
                testResults: {
                    imei: "TEST_IMEI_001",
                    status: "PASS"
                }
            },
            {
                name: "GALAXY Z FOLD4 DUOS 512GB",
                brand: "Samsung", 
                model: "Galaxy Z Fold4 Duos",
                storage: "512GB",
                color: "Gray Green",
                carrier: "UNLOCKED",
                type: "phone",
                imei: "TEST_IMEI_002", // Different IMEI, same SKU
                serialNumber: "TEST_SERIAL_002",
                condition: "SEVEN",
                working: "YES",
                quantity: 1,
                location: "Main Warehouse",
                batteryHealth: "95",
                testResults: {
                    imei: "TEST_IMEI_002",
                    status: "PASS"
                }
            }
        ];

        console.log('\n📤 Pushing test items...');
        
        for (let i = 0; i < testItems.length; i++) {
            const item = testItems[i];
            console.log(`\n--- Pushing Item ${i + 1} ---`);
            console.log(`IMEI: ${item.imei}`);
            console.log(`SKU: ${item.brand}-${item.model}-${item.storage}-${item.color}-${item.carrier}`);
            
            try {
                const response = await fetch('http://localhost:3001/api/admin/inventory-push', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(item)
                });

                const result = await response.json();
                
                if (response.ok) {
                    console.log(`✅ Success: Item ID ${result.itemId}`);
                } else {
                    console.log(`❌ Failed: ${result.error || result.message}`);
                }
            } catch (error) {
                console.log(`❌ Error: ${error.message}`);
            }
        }

        // Check final inventory count
        console.log('\n📊 Checking final inventory...');
        const inventoryResponse = await fetch('http://localhost:3001/api/admin/inventory');
        const inventory = await inventoryResponse.json();
        
        console.log(`Total items in inventory: ${inventory.length}`);
        
        // Show items with our test IMEIs
        const testItemsInInventory = inventory.filter(item => 
            item.imei === "TEST_IMEI_001" || item.imei === "TEST_IMEI_002"
        );
        
        console.log(`\nTest items found: ${testItemsInInventory.length}`);
        testItemsInInventory.forEach(item => {
            console.log(`- Item ID: ${item.id}, IMEI: ${item.imei}, SKU: ${item.sku}`);
        });

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testImeiUniqueLogic();
