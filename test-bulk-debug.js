const fetch = require('node-fetch');

async function testBulkDebug() {
    console.log('🔍 Debugging Bulk Processing');
    console.log('============================');

    // Test with just 1 item first
    const testItem = {
        name: "Debug Test Device",
        brand: "TestBrand",
        model: "TestModel",
        storage: "128GB",
        color: "Test Color",
        carrier: "Test Carrier",
        type: "phone",
        imei: `DEBUG_TEST_${Date.now()}`,
        serialNumber: `DEBUG_SERIAL_${Date.now()}`,
        condition: "EXCELLENT",
        working: "YES",
        quantity: 1,
        location: "DNCL-Inspection",
        batteryHealth: 95
    };

    console.log(`\n📤 Testing single item in bulk processing...`);
    console.log(`IMEI: ${testItem.imei}`);

    try {
        const response = await fetch('http://localhost:3001/api/bulk-inventory/bulk-process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                items: [testItem],
                batchSize: 1
            })
        });

        const responseData = await response.json();

        console.log(`\n📊 Response status: ${response.status}`);
        console.log('📄 Full response:');
        console.log(JSON.stringify(responseData, null, 2));

        if (response.ok) {
            console.log('\n✅ Request successful, but let\'s check the details...');
            
            if (responseData.summary.successful === 0 && responseData.summary.failed === 1) {
                console.log('\n❌ Item failed to process. This suggests a database issue.');
                console.log('🔍 Check server logs for detailed error information.');
            }
        } else {
            console.log('\n❌ Request failed');
        }

    } catch (error) {
        console.log('\n❌ Network error:', error.message);
    }
}

testBulkDebug();
