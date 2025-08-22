const fetch = require('node-fetch');

async function testSkuConstraint() {
    console.log('🔍 Testing SKU Constraint Issue');
    
    try {
        // First, let's check what's currently in the database
        console.log('\n📊 Current inventory...');
        const inventoryResponse = await fetch('http://localhost:3001/api/admin/inventory');
        const inventory = await inventoryResponse.json();
        
        console.log(`Total items: ${inventory.length}`);
        
        // Check for duplicate SKUs
        const skuCounts = {};
        inventory.forEach(item => {
            if (item.sku) {
                skuCounts[item.sku] = (skuCounts[item.sku] || 0) + 1;
            }
        });
        
        const duplicateSkus = Object.entries(skuCounts).filter(([sku, count]) => count > 1);
        console.log(`\nDuplicate SKUs found: ${duplicateSkus.length}`);
        duplicateSkus.forEach(([sku, count]) => {
            console.log(`- ${sku}: ${count} items`);
        });
        
        // Check for duplicate IMEIs
        const imeiCounts = {};
        inventory.forEach(item => {
            if (item.imei) {
                imeiCounts[item.imei] = (imeiCounts[item.imei] || 0) + 1;
            }
        });
        
        const duplicateImeis = Object.entries(imeiCounts).filter(([imei, count]) => count > 1);
        console.log(`\nDuplicate IMEIs found: ${duplicateImeis.length}`);
        duplicateImeis.forEach(([imei, count]) => {
            console.log(`- ${imei}: ${count} items`);
        });
        
        // Try to create an item with a SKU that already exists
        console.log('\n🧪 Testing SKU constraint...');
        const existingSku = inventory[0]?.sku;
        if (existingSku) {
            console.log(`Trying to create item with existing SKU: ${existingSku}`);
            
            const testItem = {
                name: "TEST DEVICE",
                brand: "TestBrand",
                model: "TestModel", 
                storage: "128GB",
                color: "Black",
                carrier: "UNLOCKED",
                type: "phone",
                imei: "UNIQUE_TEST_IMEI_123",
                serialNumber: "UNIQUE_TEST_SERIAL_123",
                condition: "SEVEN",
                working: "YES",
                quantity: 1,
                location: "Main Warehouse",
                batteryHealth: "95",
                sku: existingSku, // Use existing SKU
                testResults: {
                    imei: "UNIQUE_TEST_IMEI_123",
                    status: "PASS"
                }
            };
            
            try {
                const response = await fetch('http://localhost:3001/api/admin/inventory-push', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(testItem)
                });

                const result = await response.json();
                
                if (response.ok) {
                    console.log(`✅ Success: Item ID ${result.itemId}`);
                    console.log('❌ This means SKU is NOT unique constraint - which is wrong!');
                } else {
                    console.log(`❌ Failed: ${result.error || result.message}`);
                    console.log('✅ This means SKU IS unique constraint - which is the problem!');
                }
            } catch (error) {
                console.log(`❌ Error: ${error.message}`);
            }
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testSkuConstraint();
