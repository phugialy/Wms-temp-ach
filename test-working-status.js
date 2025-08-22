const fetch = require('node-fetch');

async function testWorkingStatus() {
    console.log('🔍 Testing Working Status Logic');

    // Test different working status scenarios
    const testCases = [
        {
            name: "Working YES",
            data: {
                name: "Test Device",
                brand: "TestBrand",
                model: "TestModel",
                type: "phone",
                imei: "WORKING_YES_001",
                quantity: 1,
                location: "Main Warehouse",
                working: "YES"
            }
        },
        {
            name: "Working NO",
            data: {
                name: "Test Device",
                brand: "TestBrand",
                model: "TestModel",
                type: "phone",
                imei: "WORKING_NO_001",
                quantity: 1,
                location: "Main Warehouse",
                working: "NO"
            }
        },
        {
            name: "Working PENDING",
            data: {
                name: "Test Device",
                brand: "TestBrand",
                model: "TestModel",
                type: "phone",
                imei: "WORKING_PENDING_001",
                quantity: 1,
                location: "Main Warehouse",
                working: "PENDING"
            }
        },
        {
            name: "No Working Field",
            data: {
                name: "Test Device",
                brand: "TestBrand",
                model: "TestModel",
                type: "phone",
                imei: "NO_WORKING_001",
                quantity: 1,
                location: "Main Warehouse"
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

            if (response.ok) {
                console.log('✅ Success');
            } else {
                console.log('❌ Failed');
            }

        } catch (error) {
            console.error('❌ Network error:', error.message);
        }

        // Wait between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

testWorkingStatus();
