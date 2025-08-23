const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api';

async function testCascadeDeletion() {
    console.log('🧪 Testing Cascade Deletion...\n');

    try {
        // Step 1: Add a test item first
        console.log('📝 Step 1: Adding test item for cascade deletion...');
        const testItem = {
            items: [{
                name: "CASCADE TEST DEVICE",
                brand: "Samsung",
                model: "Galaxy S24",
                storage: "256GB",
                color: "Black",
                carrier: "ATT",
                type: "phone",
                imei: "888888888888888",
                serialNumber: "SN888888888",
                condition: "Good",
                working: "YES",
                quantity: 1,
                location: "DNCL-Cascade-Test",
                batteryHealth: 95,
                batteryCycle: 150,
                failed: false,
                workingStatus: "PASS",
                testerName: "Cascade Tester",
                checkDate: new Date().toISOString(),
                testResults: {
                    deviceName: "CASCADE TEST DEVICE",
                    brand: "Samsung",
                    model: "Galaxy S24",
                    storage: "256GB",
                    color: "Black",
                    carrier: "ATT",
                    imei: "888888888888888",
                    condition: "Good",
                    working: "YES",
                    batteryHealth: 95,
                    batteryCycle: 150,
                    failed: false,
                    workingStatus: "PASS",
                    testerName: "Cascade Tester",
                    checkDate: new Date().toISOString()
                }
            }],
            source: 'cascade-test'
        };

        const addResponse = await fetch(`${API_BASE}/imei-queue/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testItem)
        });

        if (addResponse.ok) {
            console.log('✅ Test item added successfully');
            
            // Wait for processing
            console.log('⏳ Waiting for processing...');
            await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
            console.log('❌ Failed to add test item');
            return;
        }

        // Step 2: Verify the item exists in all tables
        console.log('\n🔍 Step 2: Verifying item exists in all tables...');
        
        const imeiData = await fetch(`${API_BASE}/imei-queue/imei/888888888888888`);
        const imeiResult = await imeiData.json();
        
        if (imeiResult.data) {
            console.log('✅ Item found in IMEI data');
            console.log('   - SKU Info:', imeiResult.data.sku_info ? 'EXISTS' : 'MISSING');
            console.log('   - Inspect Data:', imeiResult.data.inspect_data ? 'EXISTS' : 'MISSING');
            console.log('   - Unit Data:', imeiResult.data.unit_data ? 'EXISTS' : 'MISSING');
        } else {
            console.log('❌ Item not found in IMEI data');
            return;
        }

        // Step 3: Check Item table
        const itemData = await fetch(`${API_BASE}/admin/inventory`);
        const itemResult = await itemData.json();
        const foundInItem = itemResult.data?.find(item => item.imei === '888888888888888');
        
        if (foundInItem) {
            console.log('✅ Item found in Item table');
        } else {
            console.log('❌ Item not found in Item table');
        }

        // Step 4: Test cascade deletion by calling the manual function
        console.log('\n🗑️ Step 3: Testing cascade deletion...');
        
        // We'll use a direct SQL call through a new API endpoint
        const deleteResponse = await fetch(`${API_BASE}/imei-archival/delete-imei/888888888888888`, {
            method: 'DELETE'
        });

        if (deleteResponse.ok) {
            const deleteResult = await deleteResponse.json();
            console.log('✅ Cascade deletion completed:', deleteResult);
        } else {
            console.log('❌ Cascade deletion failed');
            console.log('   Response:', await deleteResponse.text());
        }

        // Step 5: Verify the item is gone from all tables
        console.log('\n🔍 Step 4: Verifying item is removed from all tables...');
        
        const imeiDataAfter = await fetch(`${API_BASE}/imei-queue/imei/888888888888888`);
        const imeiResultAfter = await imeiDataAfter.json();
        
        if (!imeiResultAfter.data) {
            console.log('✅ Item removed from IMEI data');
        } else {
            console.log('❌ Item still exists in IMEI data');
        }

        const itemDataAfter = await fetch(`${API_BASE}/admin/inventory`);
        const itemResultAfter = await itemDataAfter.json();
        const foundInItemAfter = itemResultAfter.data?.find(item => item.imei === '888888888888888');
        
        if (!foundInItemAfter) {
            console.log('✅ Item removed from Item table');
        } else {
            console.log('❌ Item still exists in Item table');
        }

        // Step 6: Check archived data
        console.log('\n📋 Step 5: Checking archived data...');
        const archiveData = await fetch(`${API_BASE}/imei-archival/records/888888888888888`);
        const archiveResult = await archiveData.json();
        
        if (archiveResult.data && archiveResult.data.length > 0) {
            console.log(`✅ Found ${archiveResult.data.length} archived records`);
            archiveResult.data.forEach(record => {
                console.log(`   - ${record.original_table}: ${record.archive_reason}`);
            });
        } else {
            console.log('❌ No archived records found');
        }

        console.log('\n🎉 Cascade deletion test completed!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Wait for server to start, then test
setTimeout(() => {
    testCascadeDeletion();
}, 3000);
