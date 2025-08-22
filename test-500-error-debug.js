const fetch = require('node-fetch');

async function test500Error() {
    console.log('🔍 Testing 500 Error Debug');

    try {
        // Test with a single item that might be causing the 500 error
        const testItem = {
            name: "GALAXY Z FOLD4 DUOS 512GB",
            brand: "Samsung",
            model: "Galaxy Z Fold4 Duos",
            storage: "512GB",
            color: "Gray Green",
            carrier: "UNLOCKED",
            type: "phone",
            imei: "TEST_DEBUG_IMEI_001",
            serialNumber: "TEST_DEBUG_SERIAL_001",
            condition: "SEVEN",
            working: "YES",
            quantity: 1,
            location: "Main Warehouse",
            batteryHealth: "95",
            testResults: {
                imei: "TEST_DEBUG_IMEI_001",
                status: "PASS"
            }
        };

        console.log('\n📤 Sending test item...');
        console.log('Item data:', JSON.stringify(testItem, null, 2));

        const response = await fetch('http://localhost:3001/api/admin/inventory-push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testItem)
        });

        console.log(`\n📊 Response Status: ${response.status}`);
        console.log(`Response Headers:`, Object.fromEntries(response.headers.entries()));

        const responseText = await response.text();
        console.log(`\n📄 Response Body:`, responseText);

        if (response.ok) {
            console.log('✅ Success!');
            try {
                const result = JSON.parse(responseText);
                console.log('Parsed result:', result);
            } catch (e) {
                console.log('Could not parse response as JSON');
            }
        } else {
            console.log('❌ Failed with status:', response.status);
            try {
                const error = JSON.parse(responseText);
                console.log('Error details:', error);
            } catch (e) {
                console.log('Could not parse error as JSON');
            }
        }

    } catch (error) {
        console.error('❌ Network error:', error.message);
    }
}

test500Error();
