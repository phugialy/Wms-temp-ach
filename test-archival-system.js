const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api';
const ARCHIVAL_BASE = `${API_BASE}/imei-archival`;

async function testArchivalSystem() {
    console.log('🧪 Testing IMEI Archival System...\n');

    try {
        // First, let's add some test data to the queue
        console.log('📝 Step 1: Adding test data to queue...');
        const testItems = [
            {
                name: "TEST DEVICE 1",
                brand: "Samsung",
                model: "Galaxy S24",
                storage: "256GB",
                color: "Black",
                carrier: "ATT",
                type: "phone",
                imei: "123456789012345",
                serialNumber: "SN12345678",
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
                    deviceName: "TEST DEVICE 1",
                    brand: "Samsung",
                    model: "Galaxy S24",
                    storage: "256GB",
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
                name: "TEST DEVICE 2",
                brand: "Apple",
                model: "iPhone 15",
                storage: "512GB",
                color: "Blue",
                carrier: "Verizon",
                type: "phone",
                imei: "987654321098765",
                serialNumber: "SN87654321",
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
                    deviceName: "TEST DEVICE 2",
                    brand: "Apple",
                    model: "iPhone 15",
                    storage: "512GB",
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

        const addResponse = await fetch(`${API_BASE}/imei-queue/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: testItems,
                source: 'archival-test'
            })
        });

        if (addResponse.ok) {
            const addResult = await addResponse.json();
            console.log('✅ Test data added to queue:', addResult);
        } else {
            const errorData = await addResponse.json();
            console.log('❌ Failed to add test data:', errorData);
            return;
        }

        // Wait for processing
        console.log('\n⏳ Step 2: Waiting for queue processing...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check queue stats
        console.log('\n📊 Step 3: Checking queue stats...');
        const queueStatsResponse = await fetch(`${API_BASE}/imei-queue/stats`);
        if (queueStatsResponse.ok) {
            const queueStats = await queueStatsResponse.json();
            console.log('Queue Stats:', queueStats.data);
        }

        // Test archival operations
        console.log('\n🗄️ Step 4: Testing archival operations...');
        
        // Archive an IMEI
        const archiveResponse = await fetch(`${ARCHIVAL_BASE}/archive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imei: '123456789012345',
                reason: 'test_archive'
            })
        });

        if (archiveResponse.ok) {
            const archiveResult = await archiveResponse.json();
            console.log('✅ IMEI archived:', archiveResult);
        } else {
            const errorData = await archiveResponse.json();
            console.log('❌ Failed to archive IMEI:', errorData);
        }

        // Get archive stats
        console.log('\n📈 Step 5: Getting archive statistics...');
        const archiveStatsResponse = await fetch(`${ARCHIVAL_BASE}/stats`);
        if (archiveStatsResponse.ok) {
            const archiveStats = await archiveStatsResponse.json();
            console.log('Archive Stats:', archiveStats.data);
        }

        // Get archived records for the IMEI
        console.log('\n📋 Step 6: Getting archived records...');
        const archivedRecordsResponse = await fetch(`${ARCHIVAL_BASE}/records/123456789012345`);
        if (archivedRecordsResponse.ok) {
            const archivedRecords = await archivedRecordsResponse.json();
            console.log(`Archived Records for IMEI 123456789012345:`, archivedRecords.data);
        }

        // Get data log records
        console.log('\n📝 Step 7: Getting data log records...');
        const dataLogResponse = await fetch(`${ARCHIVAL_BASE}/logs?limit=10`);
        if (dataLogResponse.ok) {
            const dataLog = await dataLogResponse.json();
            console.log('Data Log Records:', dataLog.data);
        }

        // Get data log stats
        console.log('\n📊 Step 8: Getting data log statistics...');
        const dataLogStatsResponse = await fetch(`${ARCHIVAL_BASE}/logs/stats`);
        if (dataLogStatsResponse.ok) {
            const dataLogStats = await dataLogStatsResponse.json();
            console.log('Data Log Stats:', dataLogStats.data);
        }

        // Get processing metrics
        console.log('\n⚡ Step 9: Getting processing metrics...');
        const metricsResponse = await fetch(`${ARCHIVAL_BASE}/metrics`);
        if (metricsResponse.ok) {
            const metrics = await metricsResponse.json();
            console.log('Processing Metrics:', metrics.data);
        }

        // Test restore functionality
        console.log('\n🔄 Step 10: Testing restore functionality...');
        const restoreResponse = await fetch(`${ARCHIVAL_BASE}/restore/123456789012345`, {
            method: 'POST'
        });

        if (restoreResponse.ok) {
            const restoreResult = await restoreResponse.json();
            console.log('✅ IMEI restored:', restoreResult);
        } else {
            const errorData = await restoreResponse.json();
            console.log('❌ Failed to restore IMEI:', errorData);
        }

        // Test cleanup functionality
        console.log('\n🧹 Step 11: Testing cleanup functionality...');
        const cleanupResponse = await fetch(`${ARCHIVAL_BASE}/cleanup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                olderThanDays: 1
            })
        });

        if (cleanupResponse.ok) {
            const cleanupResult = await cleanupResponse.json();
            console.log('✅ Cleanup completed:', cleanupResult);
        } else {
            const errorData = await cleanupResponse.json();
            console.log('❌ Failed to cleanup:', errorData);
        }

        console.log('\n🎉 Archival system test completed!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testArchivalSystem();
