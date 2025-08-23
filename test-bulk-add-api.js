const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api';

async function testBulkAddAPI() {
    console.log('🧪 Testing Bulk Add API with large payload...\n');

    try {
        // Create a large payload similar to what bulk-add.html sends
        const largePayload = {
            items: Array.from({ length: 50 }, (_, i) => ({
                name: `TEST DEVICE ${i + 1}`,
                brand: "Samsung",
                model: "Galaxy S24",
                storage: "256GB",
                color: "Black",
                carrier: "ATT",
                type: "phone",
                imei: `111111111111${String(i).padStart(3, '0')}`,
                serialNumber: `SN${String(i).padStart(8, '0')}`,
                condition: "Good",
                working: "YES",
                quantity: 1,
                location: "DNCL-Testing",
                batteryHealth: 95,
                batteryCycle: 150,
                failed: false,
                workingStatus: "PASS",
                testerName: "API Tester",
                checkDate: new Date().toISOString(),
                testResults: {
                    deviceName: `TEST DEVICE ${i + 1}`,
                    brand: "Samsung",
                    model: "Galaxy S24",
                    storage: "256GB",
                    color: "Black",
                    carrier: "ATT",
                    imei: `111111111111${String(i).padStart(3, '0')}`,
                    condition: "Good",
                    working: "YES",
                    batteryHealth: 95,
                    batteryCycle: 150,
                    failed: false,
                    workingStatus: "PASS",
                    testerName: "API Tester",
                    checkDate: new Date().toISOString()
                }
            })),
            source: 'bulk-add-test'
        };

        console.log(`📦 Sending ${largePayload.items.length} items to /api/imei-queue/add...`);
        console.log(`📊 Payload size: ${JSON.stringify(largePayload).length} characters`);

        const response = await fetch(`${API_BASE}/imei-queue/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(largePayload)
        });

        console.log(`📡 Response status: ${response.status} ${response.statusText}`);

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Success! API Response:', result);
            
            if (result.added > 0) {
                console.log(`🎉 Successfully added ${result.added} items to queue`);
            }
            
            if (result.errors && result.errors.length > 0) {
                console.log(`⚠️ ${result.errors.length} errors occurred:`, result.errors);
            }
        } else {
            const errorData = await response.text();
            console.log('❌ API Error Response:', errorData);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Wait for server to start, then test
setTimeout(() => {
    testBulkAddAPI();
}, 3000);
