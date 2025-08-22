const fetch = require('node-fetch');

async function testBulkAddSimulation() {
    console.log('🧪 Testing Bulk Add Simulation - 62 Items');
    
    try {
        // Step 1: Get initial count
        console.log('\n📊 Step 1: Getting initial inventory count...');
        const initialResponse = await fetch('http://localhost:3001/api/admin/inventory');
        const initialInventory = await initialResponse.json();
        const initialCount = initialInventory.length;
        console.log(`  - Initial count: ${initialCount} items`);
        
        // Step 2: Simulate adding 62 items
        console.log('\n📊 Step 2: Simulating bulk add of 62 items...');
        const testItems = [];
        
        for (let i = 1; i <= 62; i++) {
            testItems.push({
                name: `Test Device ${i}`,
                brand: "Samsung",
                model: "Galaxy Test",
                storage: "256GB",
                color: "Test Color",
                carrier: "TEST",
                type: "phone",
                imei: `TESTIMEI${i.toString().padStart(6, '0')}`, // Unique IMEI
                serialNumber: `TESTSERIAL${i.toString().padStart(6, '0')}`, // Unique serial
                condition: "SEVEN",
                working: "YES",
                quantity: 1,
                location: "DNCL-Inspection",
                batteryHealth: 95,
                batteryCycle: 150,
                mdm: "N/A",
                notes: `Test note for device ${i}`,
                failed: false,
                workingStatus: "YES",
                testerName: "Test User",
                repairNotes: "No repairs needed",
                firstReceived: "2024-01-01",
                lastUpdate: "2024-01-15",
                checkDate: "2024-01-15",
                dataQuality: "HIGH",
                processingLevel: "FULL",
                source: "PHONECHECK",
                defects: "None",
                custom1: `Test data ${i}`,
                testResults: {
                    batteryHealth: 95,
                    condition: "SEVEN",
                    status: "success"
                },
                originalWorking: "YES",
                originalWorkingStatus: "YES",
                originalFailed: false
            });
        }
        
        // Step 3: Add items one by one and track results
        console.log('\n📊 Step 3: Adding items to database...');
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        
        for (let i = 0; i < testItems.length; i++) {
            const item = testItems[i];
            try {
                const response = await fetch('http://localhost:3001/api/admin/inventory-push', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item)
                });
                
                if (response.ok) {
                    const result = await response.json();
                    successCount++;
                    if (i < 3) { // Show first 3 results
                        console.log(`  ✅ Item ${i + 1} added: ${result.data?.itemId}`);
                    }
                } else {
                    const errorData = await response.json();
                    errorCount++;
                    errors.push({
                        item: i + 1,
                        imei: item.imei,
                        error: errorData.error || 'Unknown error'
                    });
                    if (i < 3) { // Show first 3 errors
                        console.log(`  ❌ Item ${i + 1} failed: ${errorData.error}`);
                    }
                }
            } catch (error) {
                errorCount++;
                errors.push({
                    item: i + 1,
                    imei: item.imei,
                    error: error.message
                });
                if (i < 3) {
                    console.log(`  ❌ Item ${i + 1} error: ${error.message}`);
                }
            }
        }
        
        // Step 4: Get final count
        console.log('\n📊 Step 4: Getting final inventory count...');
        const finalResponse = await fetch('http://localhost:3001/api/admin/inventory');
        const finalInventory = await finalResponse.json();
        const finalCount = finalInventory.length;
        
        // Step 5: Analysis
        console.log('\n📊 Step 5: Analysis Results');
        console.log(`  - Initial count: ${initialCount}`);
        console.log(`  - Final count: ${finalCount}`);
        console.log(`  - Net increase: ${finalCount - initialCount}`);
        console.log(`  - Items attempted: ${testItems.length}`);
        console.log(`  - Successful adds: ${successCount}`);
        console.log(`  - Failed adds: ${errorCount}`);
        
        if (errors.length > 0) {
            console.log('\n❌ Error Analysis:');
            errors.slice(0, 5).forEach(error => {
                console.log(`  - Item ${error.item} (IMEI: ${error.imei}): ${error.error}`);
            });
            if (errors.length > 5) {
                console.log(`  - ... and ${errors.length - 5} more errors`);
            }
        }
        
        // Step 6: Check for duplicates
        console.log('\n📊 Step 6: Checking for duplicates...');
        const imeiCounts = {};
        finalInventory.forEach(item => {
            if (item.imei) {
                imeiCounts[item.imei] = (imeiCounts[item.imei] || 0) + 1;
            }
        });
        
        const duplicates = Object.entries(imeiCounts).filter(([imei, count]) => count > 1);
        if (duplicates.length > 0) {
            console.log(`  - Found ${duplicates.length} duplicate IMEIs:`);
            duplicates.slice(0, 3).forEach(([imei, count]) => {
                console.log(`    * ${imei}: ${count} times`);
            });
        } else {
            console.log('  - No duplicate IMEIs found');
        }
        
    } catch (error) {
        console.error('❌ Test Error:', error.message);
    }
}

testBulkAddSimulation();
