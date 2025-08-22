const fetch = require('node-fetch');

async function testDetailedError() {
    console.log('🔍 Testing Detailed Error Analysis');

    // Test different data structures to see what's causing the issue
    const testCases = [
        {
            name: "Minimal Data",
            data: {
                name: "Test Device",
                brand: "TestBrand",
                model: "TestModel",
                type: "phone",
                imei: "TEST_IMEI_001",
                quantity: 1,
                location: "Main Warehouse"
            }
        },
        {
            name: "Full Data",
            data: {
                name: "GALAXY Z FOLD4 DUOS 512GB",
                brand: "Samsung",
                model: "Galaxy Z Fold4 Duos",
                storage: "512GB",
                color: "Gray Green",
                carrier: "UNLOCKED",
                type: "phone",
                imei: "TEST_IMEI_002",
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
        }
    ];

    for (const testCase of testCases) {
        console.log(`\n🧪 Testing: ${testCase.name}`);
        console.log('Data:', JSON.stringify(testCase.data, null, 2));

        try {
            const response = await fetch('http://localhost:3001/api/admin/inventory-push', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(testCase.data)
            });

            const responseText = await response.text();
            console.log(`Status: ${response.status}`);
            console.log(`Response: ${responseText}`);

            if (!response.ok) {
                console.log('❌ Failed');
            } else {
                console.log('✅ Success');
            }

        } catch (error) {
            console.error('❌ Network error:', error.message);
        }

        // Wait a bit between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

testDetailedError();
