const fetch = require('node-fetch');

async function testSequentialPush() {
    console.log('🔍 Testing Sequential Push (Avoiding Connection Pooling Issues)');

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
            imei: `SEQ_TEST_IMEI_${i.toString().padStart(3, '0')}`,
            serialNumber: `SEQ_TEST_SERIAL_${i.toString().padStart(3, '0')}`,
            condition: "SEVEN",
            working: "YES",
            quantity: 1,
            location: "Main Warehouse",
            batteryHealth: "95",
            testResults: {
                imei: `SEQ_TEST_IMEI_${i.toString().padStart(3, '0')}`,
                status: "PASS"
            }
        });
    }

    console.log(`\n📤 Pushing ${testItems.length} items sequentially...`);

    const results = [];
    let successful = 0;
    let failed = 0;

    // Process items one by one (sequential)
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

            // Add a small delay between requests to avoid overwhelming the connection pool
            if (i < testItems.length - 1) {
                console.log(`⏳ Waiting 500ms before next item...`);
                await new Promise(resolve => setTimeout(resolve, 500));
            }

        } catch (error) {
            console.log(`❌ Item ${index} network error: ${error.message}`);
            failed++;
            results.push({ success: false, index, imei: item.imei, error: error.message });
        }
    }

    // Final summary
    console.log(`\n📊 Sequential Push Results:`);
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

    return { successful, failed, results };
}

testSequentialPush();
