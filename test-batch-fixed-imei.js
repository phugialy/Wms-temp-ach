const fetch = require('node-fetch');

async function testBatchFixedImei() {
    console.log('🔍 Testing Batch Processing with Fixed IMEI Format');
    console.log('================================================');

    // Test data with proper IMEI format (15 characters or less)
    const itemsToProcess = [
        {
            name: "iPhone 14 Pro",
            brand: "Apple",
            model: "iPhone 14 Pro",
            storage: "256GB",
            color: "Deep Purple",
            carrier: "Unlocked",
            type: "phone",
            imei: "123456789012345", // 15 characters - proper format
            serialNumber: "TEST001",
            condition: "EXCELLENT",
            working: "YES",
            quantity: 1,
            location: "DNCL-Inspection",
            batteryHealth: 95,
            testResults: {
                status: "PASSED",
                batteryHealth: 95,
                condition: "EXCELLENT"
            },
            originalWorking: "YES",
            originalWorkingStatus: "YES",
            originalFailed: false
        },
        {
            name: "Samsung Galaxy S23",
            brand: "Samsung",
            model: "Galaxy S23",
            storage: "128GB",
            color: "Phantom Black",
            carrier: "T-Mobile",
            type: "phone",
            imei: "987654321098765", // 15 characters - proper format
            serialNumber: "TEST002",
            condition: "GOOD",
            working: "YES",
            quantity: 1,
            location: "DNCL-Inspection",
            batteryHealth: 88,
            testResults: {
                status: "PASSED",
                batteryHealth: 88,
                condition: "GOOD"
            },
            originalWorking: "YES",
            originalWorkingStatus: "YES",
            originalFailed: false
        }
    ];

    console.log(`\n📤 Testing batch processing with ${itemsToProcess.length} items...`);
    console.log(`📱 IMEI format check:`);
    itemsToProcess.forEach((item, index) => {
        console.log(`  Item ${index + 1}: ${item.imei} (${item.imei.length} characters)`);
    });

    try {
        const startTime = Date.now();
        
        const response = await fetch('http://localhost:3001/api/bulk-inventory/bulk-process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                items: itemsToProcess,
                batchSize: 5
            })
        });

        const responseData = await response.json();
        const endTime = Date.now();
        const processingTime = endTime - startTime;

        console.log(`\n⏱️  Processing time: ${processingTime}ms`);
        console.log(`📊 Response status: ${response.status}`);

        if (response.ok) {
            console.log('\n✅ Batch processing successful!');
            console.log('📊 Summary:');
            console.log(`  - Total requested: ${responseData.summary.totalRequested}`);
            console.log(`  - Valid items: ${responseData.summary.validItems}`);
            console.log(`  - Invalid items: ${responseData.summary.invalidItems}`);
            console.log(`  - Successful: ${responseData.summary.successful}`);
            console.log(`  - Failed: ${responseData.summary.failed}`);

            if (responseData.results.successful && responseData.results.successful.length > 0) {
                console.log('\n✅ Successfully processed items:');
                responseData.results.successful.forEach((item, index) => {
                    console.log(`  ${index + 1}. ${item.imei || item.itemId} (ID: ${item.itemId || item.id})`);
                });
            }

            if (responseData.invalidItems && responseData.invalidItems.length > 0) {
                console.log('\n⚠️  Invalid items:');
                responseData.invalidItems.forEach(invalid => {
                    console.log(`  - Item ${invalid.index + 1}: ${invalid.error}`);
                });
            }

            if (responseData.summary.successful > 0) {
                console.log('\n🎉 SUCCESS: Batch processing is working with proper IMEI format!');
                return true;
            } else {
                console.log('\n⚠️  WARNING: Items were processed but none were successful');
                return false;
            }

        } else {
            console.log('\n❌ Batch processing failed:');
            console.log(`  - Status: ${response.status}`);
            console.log(`  - Error: ${responseData.error}`);
            if (responseData.details) {
                console.log(`  - Details: ${responseData.details}`);
            }
            return false;
        }

    } catch (error) {
        console.log('\n❌ Network error:', error.message);
        return false;
    }
}

testBatchFixedImei();
