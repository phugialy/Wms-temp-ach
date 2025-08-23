const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api/imei-queue';

async function testQueueData() {
    console.log('🔍 Checking Queue Data Processing...\n');

    try {
        // Test 1: Get all IMEI data
        console.log('1️⃣ Testing: Get all IMEI data from new tables');
        const imeiResponse = await fetch(`${API_BASE}/imei`);
        
        if (imeiResponse.ok) {
            const imeiResult = await imeiResponse.json();
            console.log('✅ IMEI data retrieved:', imeiResult);
            
            if (imeiResult.data && imeiResult.data.length > 0) {
                console.log(`📊 Found ${imeiResult.data.length} IMEI records`);
                
                // Show details of first record
                const firstRecord = imeiResult.data[0];
                console.log('📋 First record details:');
                console.log('  - IMEI:', firstRecord.imei);
                console.log('  - Brand:', firstRecord.brand);
                console.log('  - Model:', firstRecord.model);
                console.log('  - SKU:', firstRecord.sku);
                console.log('  - Created:', firstRecord.created_at);
                
                if (firstRecord.imei_inspect_data && firstRecord.imei_inspect_data.length > 0) {
                    console.log('  - Has inspect data:', firstRecord.imei_inspect_data.length, 'records');
                }
                
                if (firstRecord.imei_units && firstRecord.imei_units.length > 0) {
                    console.log('  - Has unit data:', firstRecord.imei_units.length, 'records');
                }
            } else {
                console.log('⚠️ No IMEI data found in new tables');
            }
        } else {
            const errorData = await imeiResponse.json();
            console.log('❌ Get IMEI data failed:', errorData);
        }

        // Test 2: Get specific IMEI data
        console.log('\n2️⃣ Testing: Get specific IMEI data');
        const specificImeiResponse = await fetch(`${API_BASE}/imei/123456789012345`);
        
        if (specificImeiResponse.ok) {
            const specificResult = await specificImeiResponse.json();
            console.log('✅ Specific IMEI data:', specificResult);
        } else {
            const errorData = await specificImeiResponse.json();
            console.log('❌ Get specific IMEI failed:', errorData);
        }

        // Test 3: Check queue items with all statuses
        console.log('\n3️⃣ Testing: Get all queue items');
        const allItemsResponse = await fetch(`${API_BASE}/items?limit=50`);
        
        if (allItemsResponse.ok) {
            const allItemsResult = await allItemsResponse.json();
            console.log('✅ All queue items:', allItemsResult);
            
            if (allItemsResult.data && allItemsResult.data.length > 0) {
                console.log(`📊 Found ${allItemsResult.data.length} queue items`);
                
                // Group by status
                const statusCounts = {};
                allItemsResult.data.forEach(item => {
                    statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
                });
                
                console.log('📈 Status breakdown:', statusCounts);
            }
        } else {
            const errorData = await allItemsResponse.json();
            console.log('❌ Get all items failed:', errorData);
        }

        console.log('\n🎉 Queue data check completed!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testQueueData();
