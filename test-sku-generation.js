const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api/imei-queue';

async function testSkuGeneration() {
    console.log('🧪 Testing New SKU Generation...\n');

    try {
        // Test cases with expected SKU formats
        const testCases = [
            {
                name: "GALAXY Z FOLD4 DUOS 512GB",
                brand: "Samsung",
                model: "Galaxy Z Fold4 Duos",
                storage: "512GB",
                color: "Black",
                carrier: "ATT",
                expectedSku: "Galaxy Z Fold4 Duos-512-BLK-ATT"
            },
            {
                name: "IPHONE 15 PRO 256GB",
                brand: "Apple",
                model: "iPhone 15 Pro",
                storage: "256GB",
                color: "Blue",
                carrier: "Verizon",
                expectedSku: "iPhone 15 Pro-256-BLU-Verizon"
            },
            {
                name: "GALAXY S24 ULTRA 1TB",
                brand: "Samsung",
                model: "Galaxy S24 Ultra",
                storage: "1TB",
                color: "Titanium Gray",
                carrier: "T-Mobile",
                expectedSku: "Galaxy S24 Ultra-1-GRY-T-Mobile"
            },
            {
                name: "IPHONE 14 PLUS 128GB",
                brand: "Apple",
                model: "iPhone 14 Plus",
                storage: "128GB",
                color: "Purple",
                carrier: "Sprint",
                expectedSku: "iPhone 14 Plus-128-PUR-Sprint"
            }
        ];

        console.log('📋 Test Cases:');
        testCases.forEach((testCase, index) => {
            console.log(`${index + 1}. ${testCase.name}`);
            console.log(`   Expected SKU: ${testCase.expectedSku}`);
        });

        console.log('\n🚀 Testing SKU Generation with Queue System...');

        // Add test items to queue
        const testItems = testCases.map((testCase, index) => ({
            name: testCase.name,
            brand: testCase.brand,
            model: testCase.model,
            storage: testCase.storage,
            color: testCase.color,
            carrier: testCase.carrier,
            type: "phone",
            imei: `12345678901234${index}`,
            serialNumber: `SN12345678${index}`,
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
                deviceName: testCase.name,
                brand: testCase.brand,
                model: testCase.model,
                storage: testCase.storage,
                color: testCase.color,
                carrier: testCase.carrier,
                imei: `12345678901234${index}`,
                condition: "Good",
                working: "YES",
                batteryHealth: 95,
                batteryCycle: 150,
                failed: false,
                workingStatus: "PASS",
                testerName: "Test Tester",
                checkDate: new Date().toISOString()
            }
        }));

        // Add to queue
        const addResponse = await fetch(`${API_BASE}/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: testItems,
                source: 'sku-test'
            })
        });

        if (addResponse.ok) {
            const addResult = await addResponse.json();
            console.log('✅ Items added to queue:', addResult);
        } else {
            const errorData = await addResponse.json();
            console.log('❌ Failed to add items:', errorData);
            return;
        }

        // Wait a moment for processing
        console.log('\n⏳ Waiting for queue processing...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Get processed data
        const imeiResponse = await fetch(`${API_BASE}/imei`);
        
        if (imeiResponse.ok) {
            const imeiResult = await imeiResponse.json();
            console.log('\n📊 Generated SKUs:');
            
            if (imeiResult.data && imeiResult.data.length > 0) {
                imeiResult.data.forEach((record, index) => {
                    const testCase = testCases[index];
                    const generatedSku = record.sku;
                    const expectedSku = testCase.expectedSku;
                    const isCorrect = generatedSku === expectedSku;
                    
                    console.log(`${index + 1}. ${testCase.name}`);
                    console.log(`   Generated: ${generatedSku}`);
                    console.log(`   Expected:  ${expectedSku}`);
                    console.log(`   Status:    ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);
                    console.log('');
                });
            } else {
                console.log('⚠️ No data found in queue');
            }
        } else {
            const errorData = await imeiResponse.json();
            console.log('❌ Failed to get IMEI data:', errorData);
        }

        console.log('🎉 SKU generation test completed!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testSkuGeneration();
