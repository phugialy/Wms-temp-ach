const CompleteSkuMatchingService = require('./src/services/CompleteSkuMatchingService');
const { Pool } = require('pg');
require('dotenv').config();

async function testFixedCarrierLogic() {
    console.log('🧪 TESTING FIXED CARRIER LOGIC...');
    
    try {
        // Initialize the matching service
        const matchingService = new CompleteSkuMatchingService();
        await matchingService.initialize();
        
        // Test cases
        const testCases = [
            {
                name: "CARRIER LOCKED - AT&T",
                device: {
                    model: "Galaxy Z Fold3 Duos",
                    capacity: "256GB",
                    color: "Phantom Black",
                    carrier: "AT&T",
                    device_notes: "CARRIER LOCKED"
                },
                expected: "Should select FOLD3-256-BLK-ATT"
            },
            {
                name: "CARRIER UNLOCKED - Verizon",
                device: {
                    model: "Galaxy Z Fold3 Duos",
                    capacity: "256GB",
                    color: "Phantom Black",
                    carrier: "Verizon",
                    device_notes: "CARRIER UNLOCKED"
                },
                expected: "Should select FOLD3-256-BLK (no carrier tag)"
            },
            {
                name: "NO CARRIER STATUS - T-Mobile",
                device: {
                    model: "Galaxy Z Fold3 Duos",
                    capacity: "256GB",
                    color: "Phantom Black",
                    carrier: "T-Mobile",
                    device_notes: null
                },
                expected: "Should select FOLD3-256-BLK (no carrier tag) - treated as UNLOCKED"
            },
            {
                name: "CARRIER LOCKED - 512GB",
                device: {
                    model: "Galaxy Z Fold3 Duos",
                    capacity: "512GB",
                    color: "Phantom Black",
                    carrier: "AT&T",
                    device_notes: "CARRIER LOCKED"
                },
                expected: "Should select FOLD3-512-BLK-ATT"
            }
        ];
        
        for (const testCase of testCases) {
            console.log(`\n📱 Testing: ${testCase.name}`);
            console.log(`  Expected: ${testCase.expected}`);
            
            const matches = await matchingService.matchImeiToSku(testCase.device, {
                filterPostfix: true,
                minScore: 70,
                maxResults: 3
            });
            
            if (matches.length > 0) {
                console.log(`  ✅ Result: ${matches[0].sku.sku_code} (Score: ${matches[0].totalScore}/120)`);
                console.log(`     Details: ${matches[0].matchedCharacteristics.join(', ')}`);
                
                // Check if result matches expectation
                if (testCase.name.includes("LOCKED") && matches[0].sku.sku_code.includes("-ATT")) {
                    console.log(`     🎯 CORRECT: Selected carrier-specific SKU for locked device`);
                } else if (testCase.name.includes("UNLOCKED") && !matches[0].sku.sku_code.includes("-ATT") && !matches[0].sku.sku_code.includes("-TMO") && !matches[0].sku.sku_code.includes("-VRZ")) {
                    console.log(`     🎯 CORRECT: Selected unlocked SKU for unlocked device`);
                } else if (testCase.name.includes("NO CARRIER STATUS") && !matches[0].sku.sku_code.includes("-ATT") && !matches[0].sku.sku_code.includes("-TMO") && !matches[0].sku.sku_code.includes("-VRZ")) {
                    console.log(`     🎯 CORRECT: Selected unlocked SKU for device without carrier status`);
                } else {
                    console.log(`     ⚠️  CHECK: Result may not match expectation`);
                }
            } else {
                console.log(`  ❌ No matches found`);
            }
        }
        
        // Test the specific IMEI that was problematic
        console.log(`\n🔍 Testing specific IMEI 356317536612128 (512GB issue):`);
        const specificDevice = {
            model: "Galaxy Z Fold3 Duos",
            capacity: "512GB",
            color: "Phantom Black",
            carrier: "Verizon",
            device_notes: "CARRIER UNLOCKED"
        };
        
        const specificMatches = await matchingService.matchImeiToSku(specificDevice, {
            filterPostfix: true,
            minScore: 70,
            maxResults: 3
        });
        
        if (specificMatches.length > 0) {
            console.log(`  ✅ Result: ${specificMatches[0].sku.sku_code} (Score: ${specificMatches[0].totalScore}/120)`);
            console.log(`     Details: ${specificMatches[0].matchedCharacteristics.join(', ')}`);
            
            if (specificMatches[0].sku.sku_code.includes("512")) {
                console.log(`     🎯 CORRECT: 512GB device matched to 512GB SKU`);
            } else {
                console.log(`     ❌ ERROR: 512GB device matched to wrong capacity SKU`);
            }
        }
        
        await matchingService.close();
        console.log('\n✅ Carrier logic testing completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testFixedCarrierLogic();

