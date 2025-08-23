const fetch = require('node-fetch');

async function testRestAPI() {
    console.log('🔍 Testing REST API Approach');
    console.log('📡 Using Supabase REST API (no connection pooling)');

    // Test data with 5 items
    const testItems = [
        {
            name: "iPhone 15 Pro",
            brand: "Apple",
            model: "iPhone 15 Pro",
            storage: "512GB",
            color: "Natural Titanium",
            carrier: "Unlocked",
            type: "phone",
            imei: "REST_TEST_001",
            serialNumber: "REST_SERIAL_001",
            condition: "EXCELLENT",
            working: "YES",
            quantity: 1,
            location: "DNCL-Inspection",
            batteryHealth: 98
        },
        {
            name: "Samsung Galaxy S24",
            brand: "Samsung",
            model: "Galaxy S24",
            storage: "256GB",
            color: "Onyx Black",
            carrier: "T-Mobile",
            type: "phone",
            imei: "REST_TEST_002",
            serialNumber: "REST_SERIAL_002",
            condition: "GOOD",
            working: "YES",
            quantity: 1,
            location: "DNCL-Inspection",
            batteryHealth: 91
        },
        {
            name: "Google Pixel 8",
            brand: "Google",
            model: "Pixel 8",
            storage: "128GB",
            color: "Obsidian",
            carrier: "Verizon",
            type: "phone",
            imei: "REST_TEST_003",
            serialNumber: "REST_SERIAL_003",
            condition: "FAIR",
            working: "NO",
            quantity: 1,
            location: "DNCL-Inspection",
            batteryHealth: 52
        },
        {
            name: "OnePlus 12",
            brand: "OnePlus",
            model: "OnePlus 12",
            storage: "256GB",
            color: "Silk Black",
            carrier: "Unlocked",
            type: "phone",
            imei: "REST_TEST_004",
            serialNumber: "REST_SERIAL_004",
            condition: "EXCELLENT",
            working: "YES",
            quantity: 1,
            location: "DNCL-Inspection",
            batteryHealth: 94
        },
        {
            name: "Motorola Razr+",
            brand: "Motorola",
            model: "Razr+",
            storage: "512GB",
            color: "Infinite Black",
            carrier: "AT&T",
            type: "phone",
            imei: "REST_TEST_005",
            serialNumber: "REST_SERIAL_005",
            condition: "GOOD",
            working: "YES",
            quantity: 1,
            location: "DNCL-Inspection",
            batteryHealth: 85
        }
    ];

    console.log(`\n📤 Testing ${testItems.length} items with REST API...`);

    const results = [];
    let successful = 0;
    let failed = 0;

    // Process items sequentially with minimal delay
    for (let i = 0; i < testItems.length; i++) {
        const item = testItems[i];
        const index = i + 1;
        
        try {
            console.log(`\n📤 Pushing item ${index}/${testItems.length}: ${item.imei}`);
            
            const response = await fetch('http://localhost:3001/api/admin/inventory-push', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(item)
            });

            const responseText = await response.text();
            
            if (response.ok) {
                console.log(`✅ Item ${index} success`);
                successful++;
                results.push({ success: true, index, imei: item.imei });
            } else {
                console.log(`❌ Item ${index} failed: ${response.status} - ${responseText}`);
                failed++;
                results.push({ success: false, index, imei: item.imei, error: responseText });
            }

            // Minimal delay for REST API
            if (i < testItems.length - 1) {
                console.log(`⏳ Waiting 50ms before next item...`);
                await new Promise(resolve => setTimeout(resolve, 50));
            }

        } catch (error) {
            console.log(`❌ Item ${index} network error: ${error.message}`);
            failed++;
            results.push({ success: false, index, imei: item.imei, error: error.message });
        }
    }

    // Final summary
    console.log(`\n📊 REST API Test Results:`);
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);

    if (failed > 0) {
        console.log(`\n❌ Failed items:`);
        results.filter(r => !r.success).forEach(f => {
            console.log(`- Item ${f.index} (${f.imei}): ${f.error}`);
        });
    }

    if (successful > 0) {
        console.log(`\n✅ Successful items:`);
        results.filter(r => r.success).forEach(s => {
            console.log(`- Item ${s.index} (${s.imei})`);
        });
    }

    // Verify data in database
    console.log('\n🔍 Verifying data in database...');
    await verifyDataInDatabase(testItems);

    return { successful, failed, results };
}

async function verifyDataInDatabase(testItems) {
    try {
        // Get current inventory count
        const response = await fetch('http://localhost:3001/api/admin/inventory');
        
        if (response.ok) {
            const inventory = await response.json();
            console.log(`📊 Total items in database: ${inventory.length}`);
            
            // Check for our test items
            const testImeis = testItems.map(item => item.imei);
            const foundItems = inventory.filter(item => testImeis.includes(item.imei));
            
            console.log(`🔍 Found ${foundItems.length}/${testItems.length} test items in database`);
            
            if (foundItems.length > 0) {
                console.log('\n✅ Test items found in database:');
                foundItems.forEach(item => {
                    console.log(`  - ${item.imei}: ${item.name} (ID: ${item.id})`);
                });
            }
            
            if (foundItems.length < testItems.length) {
                console.log('\n⚠️  Some test items not found in database:');
                const missingImeis = testImeis.filter(imei => !foundItems.find(item => item.imei === imei));
                missingImeis.forEach(imei => {
                    console.log(`  - ${imei}`);
                });
            }
        } else {
            console.log('❌ Could not verify data in database');
        }
    } catch (error) {
        console.log('❌ Error verifying data:', error.message);
    }
}

testRestAPI();
