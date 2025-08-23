const fetch = require('node-fetch');

async function testComprehensiveDBPush() {
    console.log('🔍 Comprehensive Database Push Test');
    console.log('====================================');
    console.log('Testing both connection methods AND data persistence');

    // Get initial database state
    console.log('\n📊 Getting initial database state...');
    const initialCount = await getDatabaseCount();
    console.log(`📊 Initial database count: ${initialCount}`);

    // Test data with unique IMEIs
    const testItems = [
        {
            name: "Test Device Alpha",
            brand: "TestBrand",
            model: "TestModel",
            storage: "128GB",
            color: "Test Color",
            carrier: "Test Carrier",
            type: "phone",
            imei: `COMPREHENSIVE_TEST_${Date.now()}_001`,
            serialNumber: `COMPREHENSIVE_SERIAL_${Date.now()}_001`,
            condition: "EXCELLENT",
            working: "YES",
            quantity: 1,
            location: "DNCL-Inspection",
            batteryHealth: 95
        },
        {
            name: "Test Device Beta",
            brand: "TestBrand",
            model: "TestModel",
            storage: "256GB",
            color: "Test Color",
            carrier: "Test Carrier",
            type: "phone",
            imei: `COMPREHENSIVE_TEST_${Date.now()}_002`,
            serialNumber: `COMPREHENSIVE_SERIAL_${Date.now()}_002`,
            condition: "GOOD",
            working: "YES",
            quantity: 1,
            location: "DNCL-Inspection",
            batteryHealth: 88
        },
        {
            name: "Test Device Gamma",
            brand: "TestBrand",
            model: "TestModel",
            storage: "512GB",
            color: "Test Color",
            carrier: "Test Carrier",
            type: "phone",
            imei: `COMPREHENSIVE_TEST_${Date.now()}_003`,
            serialNumber: `COMPREHENSIVE_SERIAL_${Date.now()}_003`,
            condition: "FAIR",
            working: "NO",
            quantity: 1,
            location: "DNCL-Inspection",
            batteryHealth: 45
        }
    ];

    console.log(`\n📤 Testing ${testItems.length} items with comprehensive verification...`);

    // Test 1: Push items and verify
    console.log('\n🔧 TEST 1: Pushing Items to Database');
    console.log('=====================================');
    
    const pushResults = await pushItemsToDatabase(testItems);

    // Test 2: Verify data persistence
    console.log('\n🔧 TEST 2: Verifying Data Persistence');
    console.log('======================================');
    
    const verificationResults = await verifyDataPersistence(testItems, initialCount);

    // Test 3: Test different connection methods
    console.log('\n🔧 TEST 3: Testing Connection Methods');
    console.log('=====================================');
    
    const connectionResults = await testConnectionMethods(testItems);

    // Final Summary
    console.log('\n📊 COMPREHENSIVE TEST SUMMARY');
    console.log('==============================');
    console.log(`Push Results: ${pushResults.successful}/${testItems.length} successful`);
    console.log(`Data Persistence: ${verificationResults.persisted}/${testItems.length} items found in DB`);
    console.log(`Connection Methods: ${connectionResults.successful}/${testItems.length} successful`);
    
    if (pushResults.successful === testItems.length && 
        verificationResults.persisted === testItems.length) {
        console.log('\n🎉 SUCCESS: All tests passed! Database operations working correctly.');
    } else {
        console.log('\n⚠️  WARNING: Some tests failed. Check results above.');
    }

    return {
        push: pushResults,
        verification: verificationResults,
        connection: connectionResults
    };
}

async function getDatabaseCount() {
    try {
        const response = await fetch('http://localhost:3001/api/admin/inventory');
        if (response.ok) {
            const inventory = await response.json();
            return inventory.length;
        }
        return 0;
    } catch (error) {
        console.log('❌ Error getting database count:', error.message);
        return 0;
    }
}

async function pushItemsToDatabase(testItems) {
    const results = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < testItems.length; i++) {
        const item = testItems[i];
        const index = i + 1;
        
        try {
            console.log(`📤 Pushing item ${index}/${testItems.length}: ${item.imei}`);
            
            const response = await fetch('http://localhost:3001/api/admin/inventory-push', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(item)
            });

            const responseText = await response.text();
            
            if (response.ok) {
                console.log(`✅ Item ${index} pushed successfully`);
                successful++;
                results.push({ success: true, index, imei: item.imei });
            } else {
                console.log(`❌ Item ${index} failed: ${response.status}`);
                failed++;
                results.push({ success: false, index, imei: item.imei, error: responseText });
            }

            // Small delay between pushes
            if (i < testItems.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }

        } catch (error) {
            console.log(`❌ Item ${index} network error: ${error.message}`);
            failed++;
            results.push({ success: false, index, imei: item.imei, error: error.message });
        }
    }

    console.log(`\n📊 Push Results: ${successful} successful, ${failed} failed`);
    return { successful, failed, results };
}

async function verifyDataPersistence(testItems, initialCount) {
    try {
        console.log('🔍 Verifying data persistence in database...');
        
        // Wait a moment for database to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const response = await fetch('http://localhost:3001/api/admin/inventory');
        
        if (response.ok) {
            const inventory = await response.json();
            const finalCount = inventory.length;
            
            console.log(`📊 Database count: ${initialCount} → ${finalCount} (${finalCount - initialCount} new items)`);
            
            // Check for our test items
            const testImeis = testItems.map(item => item.imei);
            const foundItems = inventory.filter(item => testImeis.includes(item.imei));
            
            console.log(`🔍 Found ${foundItems.length}/${testItems.length} test items in database`);
            
            if (foundItems.length > 0) {
                console.log('\n✅ Test items found in database:');
                foundItems.forEach(item => {
                    console.log(`  - ${item.imei}: ${item.name} (ID: ${item.id})`);
                });
            }
            
            if (foundItems.length < testItems.length) {
                console.log('\n⚠️  Missing test items:');
                const missingImeis = testImeis.filter(imei => !foundItems.find(item => item.imei === imei));
                missingImeis.forEach(imei => {
                    console.log(`  - ${imei}`);
                });
            }
            
            return { 
                persisted: foundItems.length, 
                totalItems: finalCount, 
                newItems: finalCount - initialCount,
                foundItems 
            };
        } else {
            console.log('❌ Could not verify data persistence');
            return { persisted: 0, totalItems: 0, newItems: 0, foundItems: [] };
        }
    } catch (error) {
        console.log('❌ Error verifying data persistence:', error.message);
        return { persisted: 0, totalItems: 0, newItems: 0, foundItems: [] };
    }
}

async function testConnectionMethods(testItems) {
    console.log('🔍 Testing different connection methods...');
    
    const results = [];
    let successful = 0;
    let failed = 0;

    // Test with different delays to simulate different connection methods
    const testMethods = [
        { name: 'Fast Connection', delay: 50 },
        { name: 'Standard Connection', delay: 200 },
        { name: 'Slow Connection', delay: 500 }
    ];

    for (const method of testMethods) {
        console.log(`\n📡 Testing ${method.name} (${method.delay}ms delay)`);
        
        for (let i = 0; i < testItems.length; i++) {
            const item = testItems[i];
            const index = i + 1;
            
            try {
                const response = await fetch('http://localhost:3001/api/admin/inventory-push', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ...item,
                        imei: `${item.imei}_${method.name.replace(' ', '_')}`,
                        name: `${item.name} (${method.name})`
                    })
                });

                if (response.ok) {
                    console.log(`✅ ${method.name} - Item ${index} success`);
                    successful++;
                } else {
                    console.log(`❌ ${method.name} - Item ${index} failed`);
                    failed++;
                }

                // Apply method-specific delay
                if (i < testItems.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, method.delay));
                }

            } catch (error) {
                console.log(`❌ ${method.name} - Item ${index} error: ${error.message}`);
                failed++;
            }
        }
    }

    console.log(`\n📊 Connection Test Results: ${successful} successful, ${failed} failed`);
    return { successful, failed, results };
}

testComprehensiveDBPush();
