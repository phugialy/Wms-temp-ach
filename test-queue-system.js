const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api/imei-queue';

async function testQueueSystem() {
    console.log('🧪 Testing IMEI Queue System...\n');

    try {
        // Test 1: Add items to queue
        console.log('1️⃣ Testing: Add items to queue');
        const testItems = [
            {
                name: "GALAXY Z FOLD4 DUOS 512GB",
                brand: "Samsung",
                model: "Galaxy Z Fold4 Duos",
                storage: "512GB",
                color: "Black",
                carrier: "ATT",
                type: "phone",
                imei: "123456789012345",
                serialNumber: "SN123456789",
                condition: "Good",
                working: "YES",
                quantity: 1,
                location: "DNCL-Testing",
                batteryHealth: 95,
                batteryCycle: 150,
                failed: false,
                workingStatus: "PASS",
                testerName: "Test Tester",
                checkDate: new Date().toISOString(),
                testResults: {
                    deviceName: "GALAXY Z FOLD4 DUOS 512GB",
                    brand: "Samsung",
                    model: "Galaxy Z Fold4 Duos",
                    storage: "512GB",
                    color: "Black",
                    carrier: "ATT",
                    imei: "123456789012345",
                    condition: "Good",
                    working: "YES",
                    batteryHealth: 95,
                    batteryCycle: 150,
                    failed: false,
                    workingStatus: "PASS",
                    testerName: "Test Tester",
                    checkDate: new Date().toISOString()
                }
            },
            {
                name: "IPHONE 15 PRO 256GB",
                brand: "Apple",
                model: "iPhone 15 Pro",
                storage: "256GB",
                color: "Blue",
                carrier: "Verizon",
                type: "phone",
                imei: "987654321098765",
                serialNumber: "SN987654321",
                condition: "Excellent",
                working: "YES",
                quantity: 1,
                location: "DNCL-Testing",
                batteryHealth: 98,
                batteryCycle: 50,
                failed: false,
                workingStatus: "PASS",
                testerName: "Test Tester",
                checkDate: new Date().toISOString(),
                testResults: {
                    deviceName: "IPHONE 15 PRO 256GB",
                    brand: "Apple",
                    model: "iPhone 15 Pro",
                    storage: "256GB",
                    color: "Blue",
                    carrier: "Verizon",
                    imei: "987654321098765",
                    condition: "Excellent",
                    working: "YES",
                    batteryHealth: 98,
                    batteryCycle: 50,
                    failed: false,
                    workingStatus: "PASS",
                    testerName: "Test Tester",
                    checkDate: new Date().toISOString()
                }
            }
        ];

        const addResponse = await fetch(`${API_BASE}/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: testItems,
                source: 'test'
            })
        });

        if (addResponse.ok) {
            const addResult = await addResponse.json();
            console.log('✅ Add to queue successful:', addResult);
        } else {
            const errorData = await addResponse.json();
            console.log('❌ Add to queue failed:', errorData);
        }

        // Test 2: Get queue stats
        console.log('\n2️⃣ Testing: Get queue statistics');
        const statsResponse = await fetch(`${API_BASE}/stats`);
        
        if (statsResponse.ok) {
            const statsResult = await statsResponse.json();
            console.log('✅ Queue stats:', statsResult);
        } else {
            const errorData = await statsResponse.json();
            console.log('❌ Get stats failed:', errorData);
        }

        // Test 3: Get queue items
        console.log('\n3️⃣ Testing: Get queue items');
        const itemsResponse = await fetch(`${API_BASE}/items?status=pending&limit=10`);
        
        if (itemsResponse.ok) {
            const itemsResult = await itemsResponse.json();
            console.log('✅ Queue items:', itemsResult);
        } else {
            const errorData = await itemsResponse.json();
            console.log('❌ Get items failed:', errorData);
        }

        // Test 4: Process pending items
        console.log('\n4️⃣ Testing: Process pending items');
        const processResponse = await fetch(`${API_BASE}/process-pending`, {
            method: 'POST'
        });
        
        if (processResponse.ok) {
            const processResult = await processResponse.json();
            console.log('✅ Process pending successful:', processResult);
        } else {
            const errorData = await processResponse.json();
            console.log('❌ Process pending failed:', errorData);
        }

        // Test 5: Get updated stats
        console.log('\n5️⃣ Testing: Get updated queue statistics');
        const updatedStatsResponse = await fetch(`${API_BASE}/stats`);
        
        if (updatedStatsResponse.ok) {
            const updatedStatsResult = await updatedStatsResponse.json();
            console.log('✅ Updated queue stats:', updatedStatsResult);
        } else {
            const errorData = await updatedStatsResponse.json();
            console.log('❌ Get updated stats failed:', errorData);
        }

        console.log('\n🎉 Queue system test completed!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testQueueSystem();
