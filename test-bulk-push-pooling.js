const fetch = require('node-fetch');

async function testBulkPushPooling() {
    console.log('🔍 Testing Bulk Push with Connection Pooling');

    // Create 16 test items (like your real scenario)
    const testItems = [];
    for (let i = 1; i <= 16; i++) {
        testItems.push({
            name: `GALAXY Z FOLD4 DUOS 512GB`,
            brand: "Samsung",
            model: "Galaxy Z Fold4 Duos",
            storage: "512GB",
            color: "Gray Green",
            carrier: "UNLOCKED",
            type: "phone",
            imei: `BULK_TEST_IMEI_${i.toString().padStart(3, '0')}`,
            serialNumber: `BULK_TEST_SERIAL_${i.toString().padStart(3, '0')}`,
            condition: "SEVEN",
            working: "YES",
            quantity: 1,
            location: "Main Warehouse",
            batteryHealth: "95",
            testResults: {
                imei: `BULK_TEST_IMEI_${i.toString().padStart(3, '0')}`,
                status: "PASS"
            }
        });
    }

    console.log(`\n📤 Pushing ${testItems.length} items simultaneously...`);

    // Push all items simultaneously (like your bulk-add scenario)
    const promises = testItems.map(async (item, index) => {
        try {
            console.log(`Pushing item ${index + 1}/${testItems.length}: ${item.imei}`);
            
            const response = await fetch('http://localhost:3001/api/admin/inventory-push', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(item)
            });

            const responseText = await response.text();
            
            if (response.ok) {
                console.log(`✅ Item ${index + 1} success`);
                return { success: true, index: index + 1, imei: item.imei };
            } else {
                console.log(`❌ Item ${index + 1} failed: ${response.status} - ${responseText}`);
                return { success: false, index: index + 1, imei: item.imei, error: responseText };
            }
        } catch (error) {
            console.log(`❌ Item ${index + 1} network error: ${error.message}`);
            return { success: false, index: index + 1, imei: item.imei, error: error.message };
        }
    });

    // Wait for all requests to complete
    const results = await Promise.all(promises);

    // Analyze results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`\n📊 Results Summary:`);
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);

    if (failed.length > 0) {
        console.log(`\n❌ Failed items:`);
        failed.forEach(f => {
            console.log(`- Item ${f.index} (${f.imei}): ${f.error}`);
        });
    }

    if (successful.length > 0) {
        console.log(`\n✅ Successful items:`);
        successful.forEach(s => {
            console.log(`- Item ${s.index} (${s.imei})`);
        });
    }
}

testBulkPushPooling();
