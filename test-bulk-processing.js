const fetch = require('node-fetch');

async function testBulkProcessing() {
    console.log('🔍 Testing New Bulk Processing Approach');
    console.log('======================================');

    // Test data with 10 items
    const testItems = [
        {
            name: "iPhone 14 Pro",
            brand: "Apple",
            model: "iPhone 14 Pro",
            storage: "256GB",
            color: "Deep Purple",
            carrier: "Unlocked",
            type: "phone",
            imei: `BULK_TEST_${Date.now()}_001`,
            serialNumber: `BULK_SERIAL_${Date.now()}_001`,
            condition: "EXCELLENT",
            working: "YES",
            quantity: 1,
            location: "DNCL-Inspection",
            batteryHealth: 95
        },
        {
            name: "Samsung Galaxy S23",
            brand: "Samsung",
            model: "Galaxy S23",
            storage: "128GB",
            color: "Phantom Black",
            carrier: "T-Mobile",
            type: "phone",
            imei: `BULK_TEST_${Date.now()}_002`,
            serialNumber: `BULK_SERIAL_${Date.now()}_002`,
            condition: "GOOD",
            working: "YES",
            quantity: 1,
            location: "DNCL-Inspection",
            batteryHealth: 88
        },
        {
            name: "Google Pixel 7",
            brand: "Google",
            model: "Pixel 7",
            storage: "256GB",
            color: "Obsidian",
            carrier: "Verizon",
            type: "phone",
            imei: `BULK_TEST_${Date.now()}_003`,
            serialNumber: `BULK_SERIAL_${Date.now()}_003`,
            condition: "FAIR",
            working: "NO",
            quantity: 1,
            location: "DNCL-Inspection",
            batteryHealth: 45
        },
        {
            name: "OnePlus 11",
            brand: "OnePlus",
            model: "OnePlus 11",
            storage: "512GB",
            color: "Titan Black",
            carrier: "Unlocked",
            type: "phone",
            imei: `BULK_TEST_${Date.now()}_004`,
            serialNumber: `BULK_SERIAL_${Date.now()}_004`,
            condition: "EXCELLENT",
            working: "YES",
            quantity: 1,
            location: "DNCL-Inspection",
            batteryHealth: 92
        },
        {
            name: "Motorola Edge+",
            brand: "Motorola",
            model: "Edge+",
            storage: "256GB",
            color: "Interstellar Black",
            carrier: "AT&T",
            type: "phone",
            imei: `BULK_TEST_${Date.now()}_005`,
            serialNumber: `BULK_SERIAL_${Date.now()}_005`,
            condition: "GOOD",
            working: "YES",
            quantity: 1,
            location: "DNCL-Inspection",
            batteryHealth: 78
        },
        {
            name: "iPhone 15 Pro",
            brand: "Apple",
            model: "iPhone 15 Pro",
            storage: "512GB",
            color: "Natural Titanium",
            carrier: "Unlocked",
            type: "phone",
            imei: `BULK_TEST_${Date.now()}_006`,
            serialNumber: `BULK_SERIAL_${Date.now()}_006`,
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
            imei: `BULK_TEST_${Date.now()}_007`,
            serialNumber: `BULK_SERIAL_${Date.now()}_007`,
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
            imei: `BULK_TEST_${Date.now()}_008`,
            serialNumber: `BULK_SERIAL_${Date.now()}_008`,
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
            imei: `BULK_TEST_${Date.now()}_009`,
            serialNumber: `BULK_SERIAL_${Date.now()}_009`,
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
            imei: `BULK_TEST_${Date.now()}_010`,
            serialNumber: `BULK_SERIAL_${Date.now()}_010`,
            condition: "GOOD",
            working: "YES",
            quantity: 1,
            location: "DNCL-Inspection",
            batteryHealth: 85
        }
    ];

    console.log(`\n📤 Testing bulk processing with ${testItems.length} items...`);

    try {
        const startTime = Date.now();
        
        const response = await fetch('http://localhost:3001/api/bulk-inventory/bulk-process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                items: testItems,
                batchSize: 3 // Process in batches of 3
            })
        });

        const responseData = await response.json();
        const endTime = Date.now();
        const processingTime = endTime - startTime;

        console.log(`\n⏱️  Processing time: ${processingTime}ms`);
        console.log(`📊 Response status: ${response.status}`);

        if (response.ok) {
            console.log('\n✅ Bulk processing successful!');
            console.log('📊 Summary:');
            console.log(`  - Total requested: ${responseData.summary.totalRequested}`);
            console.log(`  - Valid items: ${responseData.summary.validItems}`);
            console.log(`  - Invalid items: ${responseData.summary.invalidItems}`);
            console.log(`  - Successful: ${responseData.summary.successful}`);
            console.log(`  - Failed: ${responseData.summary.failed}`);

            if (responseData.results.successful && responseData.results.successful.length > 0) {
                console.log('\n✅ Successfully processed items:');
                responseData.results.successful.forEach((item, index) => {
                    console.log(`  ${index + 1}. ${item.imei} (ID: ${item.id})`);
                });
            }

            if (responseData.invalidItems && responseData.invalidItems.length > 0) {
                console.log('\n⚠️  Invalid items:');
                responseData.invalidItems.forEach(invalid => {
                    console.log(`  - Item ${invalid.index + 1}: ${invalid.error}`);
                });
            }

            console.log('\n🎉 SUCCESS: Bulk processing approach is working!');
            return true;

        } else {
            console.log('\n❌ Bulk processing failed:');
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

testBulkProcessing();
