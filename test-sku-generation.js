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

        // Test SKU generation
        const testItems = [
          {
            imei: 'TEST_COMPLETE_001',
            name: 'iPhone 15 Pro Max',
            brand: 'Apple',
            model: 'iPhone 15 Pro Max',
            storage: '256GB',
            color: 'Titanium',
            carrier: 'Unlocked',
            working: 'YES',
            batteryHealth: 95,
            location: 'Test Location',
            notes: 'Complete test item'
          },
          {
            imei: 'TEST_PARTIAL_002',
            name: 'Samsung Galaxy S24',
            brand: 'Samsung',
            working: 'YES',
            location: 'Test Location'
          },
          {
            imei: 'TEST_MINIMAL_003',
            name: 'Unknown Device',
            location: 'Test Location'
          },
          {
            IMEI: 'TEST_ALT_NAMES_004',
            deviceName: 'Google Pixel 8',
            manufacturer: 'Google',
            deviceModel: 'Pixel 8',
            capacity: '128GB',
            deviceColor: 'Obsidian',
            network: 'Verizon',
            status: 'YES',
            battery: 88,
            comments: 'Alternative field names test'
          }
        ];

        console.log('🧪 Testing SKU Generation');
        console.log('========================\n');

        testItems.forEach((item, index) => {
          // Extract data with fallbacks
          const imei = item.imei || item.IMEI || item.serialNumber || `UNKNOWN_${Date.now()}`;
          const name = item.name || item.deviceName || item.model || 'Unknown Device';
          const brand = item.brand || item.manufacturer || 'Unknown';
          const model = item.model || item.deviceModel || 'Unknown Model';
          const storage = item.storage || item.capacity || 'Unknown';
          const color = item.color || item.deviceColor || 'Unknown';
          const carrier = item.carrier || item.network || 'Unlocked';
          const location = item.location || 'Default Location';
          const working = item.working || item.status || 'PENDING';
          const failed = item.failed || item.defects || 'NO';
          const batteryHealth = item.batteryHealth || item.battery || null;
          const screenCondition = item.screenCondition || item.screen || 'Unknown';
          const bodyCondition = item.bodyCondition || item.condition || 'Unknown';
          const notes = item.notes || item.comments || '';
          const quantity = item.quantity || 1;

          // Generate SKU
          const sku = `${brand.substring(0, 3).toUpperCase()}${model.substring(0, 3).toUpperCase()}`.replace(/\s+/g, '').substring(0, 15);

          console.log(`📱 Item ${index + 1}:`);
          console.log(`   IMEI: ${imei}`);
          console.log(`   Brand: ${brand}`);
          console.log(`   Model: ${model}`);
          console.log(`   Generated SKU: "${sku}" (length: ${sku.length})`);
          console.log('');
        });

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
