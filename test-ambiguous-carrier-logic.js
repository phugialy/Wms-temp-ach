const CompleteSkuMatchingService = require('./src/services/CompleteSkuMatchingService');
const { Pool } = require('pg');
require('dotenv').config();

async function testAmbiguousCarrierLogic() {
    console.log('🧪 TESTING AMBIGUOUS CARRIER LOGIC...');
    
    try {
        // Initialize the matching service
        const matchingService = new CompleteSkuMatchingService();
        await matchingService.initialize();
        
        // Test cases for ambiguous carrier status
        const testCases = [
            {
                name: "EXPLICITLY LOCKED - AT&T",
                device: {
                    model: "Galaxy Z Fold3 Duos",
                    capacity: "256GB",
                    color: "Phantom Black",
                    carrier: "AT&T",
                    device_notes: "CARRIER LOCKED"
                },
                expected: "Should select carrier-specific SKU, NO attention required"
            },
            {
                name: "EXPLICITLY UNLOCKED - T-Mobile",
                device: {
                    model: "Galaxy Z Fold3 Duos",
                    capacity: "256GB",
                    color: "Phantom Black",
                    carrier: "T-Mobile",
                    device_notes: "CARRIER UNLOCKED"
                },
                expected: "Should select unlocked SKU, NO attention required"
            },
            {
                name: "AMBIGUOUS - AT&T with no carrier status",
                device: {
                    model: "Galaxy Z Fold3 Duos",
                    capacity: "256GB",
                    color: "Phantom Black",
                    carrier: "AT&T",
                    device_notes: "Some other notes"
                },
                expected: "Should select carrier-specific SKU, ATTENTION REQUIRED"
            },
            {
                name: "AMBIGUOUS - Verizon with no device_notes",
                device: {
                    model: "Galaxy Z Fold3 Duos",
                    capacity: "256GB",
                    color: "Phantom Black",
                    carrier: "Verizon",
                    device_notes: null
                },
                expected: "Should select carrier-specific SKU, ATTENTION REQUIRED"
            },
            {
                name: "AMBIGUOUS - T-Mobile with unrelated notes",
                device: {
                    model: "Galaxy Z Fold3 Duos",
                    capacity: "256GB",
                    color: "Phantom Black",
                    carrier: "T-Mobile",
                    device_notes: "SCRATCHES ON SCREEN"
                },
                expected: "Should select carrier-specific SKU, ATTENTION REQUIRED"
            }
        ];
        
        for (const testCase of testCases) {
            console.log(`\n📱 Testing: ${testCase.name}`);
            console.log(`  Expected: ${testCase.expected}`);
            
            const result = await matchingService.matchImeiToSku(testCase.device, {
                filterPostfix: true,
                minScore: 70,
                maxResults: 3
            });
            
            if (result.matches && result.matches.length > 0) {
                console.log(`  ✅ Result: ${result.matches[0].sku.sku_code} (Score: ${result.matches[0].totalScore}/120)`);
                console.log(`     Details: ${result.matches[0].matchedCharacteristics.join(', ')}`);
                console.log(`     Requires Attention: ${result.requiresAttention ? 'YES ⚠️' : 'NO ✅'}`);
                
                // Check if result matches expectation
                if (testCase.name.includes("EXPLICITLY")) {
                    if (!result.requiresAttention) {
                        console.log(`     🎯 CORRECT: No attention required for explicit status`);
                    } else {
                        console.log(`     ❌ ERROR: Should not require attention for explicit status`);
                    }
                } else if (testCase.name.includes("AMBIGUOUS")) {
                    if (result.requiresAttention) {
                        console.log(`     🎯 CORRECT: Attention required for ambiguous status`);
                    } else {
                        console.log(`     ❌ ERROR: Should require attention for ambiguous status`);
                    }
                }
            } else {
                console.log(`  ❌ No matches found`);
                console.log(`     Requires Attention: ${result.requiresAttention ? 'YES ⚠️' : 'NO ✅'}`);
            }
        }
        
        await matchingService.close();
        console.log('\n✅ Ambiguous carrier logic testing completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testAmbiguousCarrierLogic();

