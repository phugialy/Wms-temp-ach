const fetch = require('node-fetch');

async function testMinimalPush() {
    console.log('🔍 Testing Minimal Data Push');

    // Test with absolute minimal data
    const minimalItem = {
        name: "Test Device",
        brand: "TestBrand",
        model: "TestModel",
        type: "phone",
        imei: "MINIMAL_TEST_001",
        quantity: 1,
        location: "Main Warehouse"
    };

    console.log('\n📤 Testing minimal item...');
    console.log('Data:', JSON.stringify(minimalItem, null, 2));

    try {
        const response = await fetch('http://localhost:3001/api/admin/inventory-push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(minimalItem)
        });

        const responseText = await response.text();
        console.log(`Status: ${response.status}`);
        console.log(`Response: ${responseText}`);

        if (response.ok) {
            console.log('✅ Minimal item success!');
        } else {
            console.log('❌ Minimal item failed');
        }

    } catch (error) {
        console.error('❌ Network error:', error.message);
    }
}

testMinimalPush();
