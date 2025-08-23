const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api';

async function testDataFlow() {
    console.log('🧪 Testing Complete Data Flow...\n');

    try {
        // Step 1: Check current queue status
        console.log('📊 Step 1: Checking current queue status...');
        const queueStats = await fetch(`${API_BASE}/imei-queue/stats`);
        const stats = await queueStats.json();
        console.log('Queue Stats:', stats.data);

        // Step 2: Check data log
        console.log('\n📋 Step 2: Checking data log...');
        const dataLog = await fetch(`${API_BASE}/imei-archival/logs?limit=5`);
        const logData = await dataLog.json();
        console.log('Data Log (last 5):', logData.data?.length || 0, 'records');

        // Step 3: Check IMEI data
        console.log('\n📱 Step 3: Checking IMEI data...');
        const imeiData = await fetch(`${API_BASE}/imei-queue/imei`);
        const imeiResult = await imeiData.json();
        console.log('IMEI Data Count:', imeiResult.data?.length || 0);

        // Step 4: Check Item table sync
        console.log('\n🏷️ Step 4: Checking Item table sync...');
        const itemData = await fetch(`${API_BASE}/admin/inventory`);
        const itemResult = await itemData.json();
        console.log('Item Table Count:', itemResult.data?.length || 0);

        // Step 5: Add a test item to verify flow
        console.log('\n➕ Step 5: Adding test item to verify flow...');
        const testItem = {
            items: [{
                name: "TEST FLOW DEVICE",
                brand: "Samsung",
                model: "Galaxy S24",
                storage: "256GB",
                color: "Black",
                carrier: "ATT",
                type: "phone",
                imei: "999999999999999",
                serialNumber: "SN999999999",
                condition: "Good",
                working: "YES",
                quantity: 1,
                location: "DNCL-Testing",
                batteryHealth: 95,
                batteryCycle: 150,
                failed: false,
                workingStatus: "PASS",
                testerName: "Flow Tester",
                checkDate: new Date().toISOString(),
                testResults: {
                    deviceName: "TEST FLOW DEVICE",
                    brand: "Samsung",
                    model: "Galaxy S24",
                    storage: "256GB",
                    color: "Black",
                    carrier: "ATT",
                    imei: "999999999999999",
                    condition: "Good",
                    working: "YES",
                    batteryHealth: 95,
                    batteryCycle: 150,
                    failed: false,
                    workingStatus: "PASS",
                    testerName: "Flow Tester",
                    checkDate: new Date().toISOString()
                }
            }],
            source: 'data-flow-test'
        };

        const addResponse = await fetch(`${API_BASE}/imei-queue/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testItem)
        });

        if (addResponse.ok) {
            const addResult = await addResponse.json();
            console.log('✅ Test item added:', addResult.message);

            // Wait a moment for processing
            console.log('⏳ Waiting for processing...');
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Step 6: Check if test item was processed
            console.log('\n🔍 Step 6: Checking if test item was processed...');
            const testImeiData = await fetch(`${API_BASE}/imei-queue/imei/999999999999999`);
            const testResult = await testImeiData.json();
            
            if (testResult.data) {
                console.log('✅ Test item found in IMEI data:', testResult.data);
            } else {
                console.log('❌ Test item not found in IMEI data');
            }

            // Check Item table
            const testItemData = await fetch(`${API_BASE}/admin/inventory`);
            const testItemResult = await testItemData.json();
            const foundInItem = testItemResult.data?.find(item => item.imei === '999999999999999');
            
            if (foundInItem) {
                console.log('✅ Test item found in Item table:', foundInItem);
            } else {
                console.log('❌ Test item not found in Item table');
            }

        } else {
            console.log('❌ Failed to add test item');
        }

        // Step 7: Final status check
        console.log('\n📊 Step 7: Final status check...');
        const finalStats = await fetch(`${API_BASE}/imei-queue/stats`);
        const finalStatsData = await finalStats.json();
        console.log('Final Queue Stats:', finalStatsData.data);

        const finalLog = await fetch(`${API_BASE}/imei-archival/logs?limit=5`);
        const finalLogData = await finalLog.json();
        console.log('Final Data Log Count:', finalLogData.data?.length || 0);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Wait for server to start, then test
setTimeout(() => {
    testDataFlow();
}, 3000);
