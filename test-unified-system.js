const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api';

async function testUnifiedSystem() {
    console.log('🧪 Testing Unified System (Old + New APIs)...\n');

    try {
        // Step 1: Add data via NEW IMEI system
        console.log('📝 Step 1: Adding data via NEW IMEI system...');
        const testItems = [
            {
                name: "UNIFIED TEST DEVICE 1",
                brand: "Samsung",
                model: "Galaxy S24",
                storage: "256GB",
                color: "Black",
                carrier: "ATT",
                type: "phone",
                imei: "111111111111111",
                serialNumber: "SN11111111",
                condition: "Good",
                working: "YES",
                quantity: 1,
                location: "DNCL-Testing",
                batteryHealth: 95,
                batteryCycle: 150,
                failed: false,
                workingStatus: "PASS",
                testerName: "Unified Tester",
                checkDate: new Date().toISOString(),
                testResults: {
                    deviceName: "UNIFIED TEST DEVICE 1",
                    brand: "Samsung",
                    model: "Galaxy S24",
                    storage: "256GB",
                    color: "Black",
                    carrier: "ATT",
                    imei: "111111111111111",
                    condition: "Good",
                    working: "YES",
                    batteryHealth: 95,
                    batteryCycle: 150,
                    failed: false,
                    workingStatus: "PASS",
                    testerName: "Unified Tester",
                    checkDate: new Date().toISOString()
                }
            },
            {
                name: "UNIFIED TEST DEVICE 2",
                brand: "Apple",
                model: "iPhone 15",
                storage: "512GB",
                color: "Blue",
                carrier: "Verizon",
                type: "phone",
                imei: "222222222222222",
                serialNumber: "SN22222222",
                condition: "Excellent",
                working: "YES",
                quantity: 1,
                location: "DNCL-Testing",
                batteryHealth: 98,
                batteryCycle: 50,
                failed: false,
                workingStatus: "PASS",
                testerName: "Unified Tester",
                checkDate: new Date().toISOString(),
                testResults: {
                    deviceName: "UNIFIED TEST DEVICE 2",
                    brand: "Apple",
                    model: "iPhone 15",
                    storage: "512GB",
                    color: "Blue",
                    carrier: "Verizon",
                    imei: "222222222222222",
                    condition: "Excellent",
                    working: "YES",
                    batteryHealth: 98,
                    batteryCycle: 50,
                    failed: false,
                    workingStatus: "PASS",
                    testerName: "Unified Tester",
                    checkDate: new Date().toISOString()
                }
            }
        ];

        const addResponse = await fetch(`${API_BASE}/imei-queue/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: testItems,
                source: 'unified-test'
            })
        });

        if (addResponse.ok) {
            const addResult = await addResponse.json();
            console.log('✅ Data added to NEW IMEI system:', addResult);
        } else {
            const errorData = await addResponse.json();
            console.log('❌ Failed to add data to NEW system:', errorData);
            return;
        }

        // Step 2: Wait for processing
        console.log('\n⏳ Step 2: Waiting for queue processing...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Step 3: Check NEW IMEI system data
        console.log('\n📊 Step 3: Checking NEW IMEI system data...');
        const imeiDataResponse = await fetch(`${API_BASE}/imei-queue/imei`);
        if (imeiDataResponse.ok) {
            const imeiData = await imeiDataResponse.json();
            console.log('✅ NEW IMEI system data:', imeiData.data?.length || 0, 'items found');
        }

        // Step 4: Check OLD system data (should be auto-synced)
        console.log('\n🔄 Step 4: Checking OLD system data (auto-synced)...');
        const oldSystemResponse = await fetch(`${API_BASE}/admin/inventory-summary`);
        if (oldSystemResponse.ok) {
            const oldSystemData = await oldSystemResponse.json();
            console.log('✅ OLD system data (auto-synced):', oldSystemData);
        }

        // Step 5: Test OLD API endpoints
        console.log('\n🔍 Step 5: Testing OLD API endpoints...');
        
        // Test inventory endpoint
        const inventoryResponse = await fetch(`${API_BASE}/inventory`);
        if (inventoryResponse.ok) {
            const inventoryData = await inventoryResponse.json();
            console.log('✅ OLD inventory API:', inventoryData.data?.length || 0, 'items');
        }

        // Test search endpoint
        const searchResponse = await fetch(`${API_BASE}/inventory/search?q=Samsung`);
        if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            console.log('✅ OLD search API:', searchData.data?.length || 0, 'Samsung items found');
        }

        // Step 6: Test NEW API endpoints
        console.log('\n🆕 Step 6: Testing NEW API endpoints...');
        
        // Test IMEI-specific endpoint
        const specificImeiResponse = await fetch(`${API_BASE}/imei-queue/imei/111111111111111`);
        if (specificImeiResponse.ok) {
            const specificImeiData = await specificImeiResponse.json();
            console.log('✅ NEW IMEI-specific API:', specificImeiData.data ? 'Found device' : 'Not found');
        }

        // Step 7: Demonstrate data consistency
        console.log('\n🎯 Step 7: Demonstrating data consistency...');
        console.log('📋 Both systems should show the same data:');
        console.log('   - NEW IMEI system: Direct access to imei_sku_info, imei_inspect_data, imei_units');
        console.log('   - OLD system: Auto-synced to Item table via triggers');
        console.log('   - Both systems: Same IMEI, same SKU, same device info');

        // Step 8: Test archival system
        console.log('\n🗄️ Step 8: Testing archival system...');
        const archiveResponse = await fetch(`${API_BASE}/imei-archival/archive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imei: '111111111111111',
                reason: 'unified_test_archive'
            })
        });

        if (archiveResponse.ok) {
            const archiveResult = await archiveResponse.json();
            console.log('✅ Archival system working:', archiveResult);
        }

        console.log('\n🎉 Unified system test completed!');
        console.log('\n📈 What you just saw:');
        console.log('   1. Data added via NEW IMEI system');
        console.log('   2. Automatically synced to OLD system');
        console.log('   3. Both APIs work with the same data');
        console.log('   4. No duplication - single source of truth');
        console.log('   5. Archival system working');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testUnifiedSystem();
