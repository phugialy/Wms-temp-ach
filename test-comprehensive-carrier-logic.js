const CompleteSkuMatchingService = require('./src/services/CompleteSkuMatchingService');
const { Pool } = require('pg');
require('dotenv').config();

async function testComprehensiveCarrierLogic() {
    console.log('🧪 TESTING COMPREHENSIVE CARRIER LOGIC...');
    
    try {
        // Initialize the matching service
        const matchingService = new CompleteSkuMatchingService();
        await matchingService.initialize();
        
        // Test cases with various carrier formats
        const testCases = [
            {
                name: "CARRIER LOCKED - AT&T (ATT format)",
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
                name: "CARRIER LOCKED - T-Mobile (TMO format)",
                device: {
                    model: "Galaxy Z Fold3 Duos",
                    capacity: "256GB",
                    color: "Phantom Black",
                    carrier: "T-Mobile",
                    device_notes: "CARRIER LOCKED"
                },
                expected: "Should select FOLD3-256-BLK-TMO"
            },
            {
                name: "CARRIER LOCKED - Verizon (VRZ format)",
                device: {
                    model: "Galaxy Z Fold3 Duos",
                    capacity: "256GB",
                    color: "Phantom Black",
                    carrier: "Verizon",
                    device_notes: "CARRIER LOCKED"
                },
                expected: "Should select FOLD3-256-BLK-VRZ"
            },
            {
                name: "CARRIER LOCKED - Xfinity (XFI format)",
                device: {
                    model: "Galaxy Z Fold3 Duos",
                    capacity: "256GB",
                    color: "Phantom Black",
                    carrier: "Xfinity",
                    device_notes: "CARRIER LOCKED"
                },
                expected: "Should select FOLD3-256-BLK-XFI or similar"
            },
            {
                name: "CARRIER UNLOCKED - Any carrier",
                device: {
                    model: "Galaxy Z Fold3 Duos",
                    capacity: "256GB",
                    color: "Phantom Black",
                    carrier: "AT&T",
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
                if (testCase.name.includes("LOCKED")) {
                    const hasCarrierTag = matches[0].sku.sku_code.includes("-ATT") || 
                                        matches[0].sku.sku_code.includes("-TMO") || 
                                        matches[0].sku.sku_code.includes("-VRZ") ||
                                        matches[0].sku.sku_code.includes("-VZ") ||
                                        matches[0].sku.sku_code.includes("-XFI") ||
                                        matches[0].sku.sku_code.includes("-XFINITY") ||
                                        matches[0].sku.sku_code.includes("-SPECTRUM") ||
                                        matches[0].sku.sku_code.includes("-SPRINT") ||
                                        matches[0].sku.sku_code.includes("-TRACFONE");
                    
                    if (hasCarrierTag) {
                        console.log(`     🎯 CORRECT: Selected carrier-specific SKU for locked device`);
                    } else {
                        console.log(`     ⚠️  WARNING: Should have selected carrier-specific SKU for locked device`);
                    }
                } else {
                    const hasNoCarrierTag = !matches[0].sku.sku_code.includes("-ATT") && 
                                          !matches[0].sku.sku_code.includes("-TMO") && 
                                          !matches[0].sku.sku_code.includes("-VRZ") &&
                                          !matches[0].sku.sku_code.includes("-VZ") &&
                                          !matches[0].sku.sku_code.includes("-XFI") &&
                                          !matches[0].sku.sku_code.includes("-XFINITY") &&
                                          !matches[0].sku.sku_code.includes("-SPECTRUM") &&
                                          !matches[0].sku.sku_code.includes("-SPRINT") &&
                                          !matches[0].sku.sku_code.includes("-TRACFONE");
                    
                    if (hasNoCarrierTag) {
                        console.log(`     🎯 CORRECT: Selected unlocked SKU for unlocked device`);
                    } else {
                        console.log(`     ⚠️  WARNING: Should have selected unlocked SKU for unlocked device`);
                    }
                }
            } else {
                console.log(`  ❌ No matches found`);
            }
        }
        
        await matchingService.close();
        console.log('\n✅ Comprehensive carrier logic testing completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testComprehensiveCarrierLogic();

