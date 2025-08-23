const fetch = require('node-fetch');

async function testConnectionComparison() {
    console.log('🔍 Connection Method Comparison Test');
    console.log('=====================================');

    // Test data with unique IMEIs
    const testItems = [
        {
            name: "Test Device 1",
            brand: "TestBrand",
            model: "TestModel",
            storage: "128GB",
            color: "Test Color",
            carrier: "Test Carrier",
            type: "phone",
            imei: `COMPARE_TEST_${Date.now()}_001`,
            serialNumber: `COMPARE_SERIAL_${Date.now()}_001`,
            condition: "EXCELLENT",
            working: "YES",
            quantity: 1,
            location: "DNCL-Inspection",
            batteryHealth: 95
        },
        {
            name: "Test Device 2",
            brand: "TestBrand",
            model: "TestModel",
            storage: "256GB",
            color: "Test Color",
            carrier: "Test Carrier",
            type: "phone",
            imei: `COMPARE_TEST_${Date.now()}_002`,
            serialNumber: `COMPARE_SERIAL_${Date.now()}_002`,
            condition: "GOOD",
            working: "YES",
            quantity: 1,
            location: "DNCL-Inspection",
            batteryHealth: 88
        },
        {
            name: "Test Device 3",
            brand: "TestBrand",
            model: "TestModel",
            storage: "512GB",
            color: "Test Color",
            carrier: "Test Carrier",
            type: "phone",
            imei: `COMPARE_TEST_${Date.now()}_003`,
            serialNumber: `COMPARE_SERIAL_${Date.now()}_003`,
            condition: "FAIR",
            working: "NO",
            quantity: 1,
            location: "DNCL-Inspection",
            batteryHealth: 45
        }
    ];

    console.log(`\n📊 Testing ${testItems.length} items with both methods...`);

    // Test 1: Current Method (Connection Pooling)
    console.log('\n🔧 TEST 1: Current Method (Connection Pooling)');
    console.log('==============================================');
    
    const currentResults = await testMethod(testItems, 'Current (Pooling)', 500);

    // Test 2: Direct Connection Method
    console.log('\n🔧 TEST 2: Direct Connection Method');
    console.log('===================================');
    
    const directResults = await testMethod(testItems, 'Direct Connection', 100);

    // Test 3: REST API Method
    console.log('\n🔧 TEST 3: REST API Method');
    console.log('==========================');
    
    const restResults = await testMethod(testItems, 'REST API', 50);

    // Comparison Summary
    console.log('\n📊 COMPARISON SUMMARY');
    console.log('=====================');
    console.log(`Method                    | Success | Failed | Avg Time`);
    console.log(`-------------------------|---------|--------|---------`);
    console.log(`Current (Pooling)        | ${currentResults.successful.toString().padStart(7)} | ${currentResults.failed.toString().padStart(6)} | ${currentResults.avgTime}ms`);
    console.log(`Direct Connection        | ${directResults.successful.toString().padStart(7)} | ${directResults.failed.toString().padStart(6)} | ${directResults.avgTime}ms`);
    console.log(`REST API                 | ${restResults.successful.toString().padStart(7)} | ${restResults.failed.toString().padStart(6)} | ${restResults.avgTime}ms`);

    // Recommendation
    console.log('\n💡 RECOMMENDATION');
    console.log('=================');
    
    if (restResults.successful > directResults.successful && restResults.successful > currentResults.successful) {
        console.log('✅ REST API method performed best - Recommended for bulk operations');
    } else if (directResults.successful > currentResults.successful) {
        console.log('✅ Direct Connection method performed better than pooling - Consider switching');
    } else {
        console.log('⚠️  Current method (pooling) performed adequately - Keep current setup');
    }

    return {
        current: currentResults,
        direct: directResults,
        rest: restResults
    };
}

async function testMethod(items, methodName, delayMs) {
    const startTime = Date.now();
    const results = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const index = i + 1;
        
        try {
            console.log(`📤 [${methodName}] Pushing item ${index}/${items.length}: ${item.imei}`);
            
            const response = await fetch('http://localhost:3001/api/admin/inventory-push', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(item)
            });

            const responseText = await response.text();
            
            if (response.ok) {
                console.log(`✅ [${methodName}] Item ${index} success`);
                successful++;
                results.push({ success: true, index, imei: item.imei });
            } else {
                console.log(`❌ [${methodName}] Item ${index} failed: ${response.status}`);
                failed++;
                results.push({ success: false, index, imei: item.imei, error: responseText });
            }

            // Delay between items
            if (i < items.length - 1) {
                console.log(`⏳ [${methodName}] Waiting ${delayMs}ms before next item...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }

        } catch (error) {
            console.log(`❌ [${methodName}] Item ${index} network error: ${error.message}`);
            failed++;
            results.push({ success: false, index, imei: item.imei, error: error.message });
        }
    }

    const totalTime = Date.now() - startTime;
    const avgTime = Math.round(totalTime / items.length);

    console.log(`\n📊 [${methodName}] Results: ${successful} success, ${failed} failed, ${avgTime}ms avg time`);

    return { successful, failed, avgTime, results };
}

testConnectionComparison();
