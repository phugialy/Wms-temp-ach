const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api';

async function test500Devices() {
    console.log('🧪 Testing 500 Devices with Chunked Processing...\n');

    try {
        // Create 500 test devices
        const largePayload = {
            items: Array.from({ length: 500 }, (_, i) => ({
                name: `BULK TEST DEVICE ${i + 1}`,
                brand: "Samsung",
                model: "Galaxy S24",
                storage: "256GB",
                color: "Black",
                carrier: "ATT",
                type: "phone",
                imei: `500000000000${String(i).padStart(3, '0')}`,
                serialNumber: `SN500${String(i).padStart(8, '0')}`,
                condition: "Good",
                working: "YES",
                quantity: 1,
                location: "DNCL-Bulk-Testing",
                batteryHealth: 95,
                batteryCycle: 150,
                failed: false,
                workingStatus: "PASS",
                testerName: "Bulk Tester",
                checkDate: new Date().toISOString(),
                testResults: {
                    deviceName: `BULK TEST DEVICE ${i + 1}`,
                    brand: "Samsung",
                    model: "Galaxy S24",
                    storage: "256GB",
                    color: "Black",
                    carrier: "ATT",
                    imei: `500000000000${String(i).padStart(3, '0')}`,
                    condition: "Good",
                    working: "YES",
                    batteryHealth: 95,
                    batteryCycle: 150,
                    failed: false,
                    workingStatus: "PASS",
                    testerName: "Bulk Tester",
                    checkDate: new Date().toISOString()
                }
            })),
            source: 'bulk-500-test'
        };

        console.log(`📦 Sending ${largePayload.items.length} devices to /api/imei-queue/add...`);
        console.log(`📊 Payload size: ${JSON.stringify(largePayload).length} characters`);
        console.log(`🔄 Expected chunks: ${Math.ceil(largePayload.items.length / 50)}`);

        const startTime = Date.now();

        const response = await fetch(`${API_BASE}/imei-queue/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(largePayload)
        });

        const endTime = Date.now();
        const processingTime = endTime - startTime;

        console.log(`📡 Response status: ${response.status} ${response.statusText}`);
        console.log(`⏱️ Processing time: ${processingTime}ms`);

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Success! API Response:', result);
            
            if (result.added > 0) {
                console.log(`🎉 Successfully processed ${result.added} devices in ${result.chunks} chunks`);
                console.log(`📈 Processing rate: ${Math.round(result.added / (processingTime / 1000))} devices/second`);
            }
            
            if (result.errors && result.errors.length > 0) {
                console.log(`⚠️ ${result.errors.length} errors occurred:`);
                result.errors.slice(0, 5).forEach((error, index) => {
                    console.log(`   ${index + 1}. ${error}`);
                });
                if (result.errors.length > 5) {
                    console.log(`   ... and ${result.errors.length - 5} more errors`);
                }
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
    test500Devices();
}, 3000);
