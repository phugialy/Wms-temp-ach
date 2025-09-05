const CompleteSkuMatchingService = require('./src/services/CompleteSkuMatchingService');

async function testUnlockedNoNotes() {
    console.log('🧪 TESTING UNLOCKED CARRIER WITH NO DEVICE_NOTES...');
    
    try {
        // Initialize the matching service
        const matchingService = new CompleteSkuMatchingService();
        await matchingService.initialize();
        
        // Test case: UNLOCKED carrier with no device_notes
        const testDevice = {
            model: "Galaxy Z Fold3 Duos",
            capacity: "512GB",
            color: "Phantom Black",
            carrier: "Unlocked",
            device_notes: null
        };
        
        console.log('\n📱 Testing UNLOCKED carrier with no device_notes:');
        console.log(`  Model: ${testDevice.model}, Capacity: ${testDevice.capacity}, Color: ${testDevice.color}`);
        console.log(`  Carrier: ${testDevice.carrier}, Notes: ${testDevice.device_notes || 'None'}`);
        
        const result = await matchingService.matchImeiToSku(testDevice, {
            filterPostfix: true,
            minScore: 70,
            maxResults: 3
        });
        
        if (result.matches && result.matches.length > 0) {
            console.log(`\n✅ MATCH RESULT:`);
            console.log(`  SKU: ${result.matches[0].sku.sku_code} (Score: ${result.matches[0].totalScore}/120)`);
            console.log(`  Details: ${result.matches[0].matchedCharacteristics.join(', ')}`);
            console.log(`  Requires Attention: ${result.requiresAttention ? 'YES ⚠️' : 'NO ✅'}`);
            
            // Check if result matches expectation
            if (!result.requiresAttention) {
                console.log(`  🎯 CORRECT: No attention required for UNLOCKED carrier with no notes`);
            } else {
                console.log(`  ❌ ERROR: Should not require attention for UNLOCKED carrier with no notes`);
            }
            
            // Check if it selected unlocked SKU (no carrier tag)
            const hasNoCarrierTag = !result.matches[0].sku.sku_code.includes("-ATT") && 
                                  !result.matches[0].sku.sku_code.includes("-TMO") && 
                                  !result.matches[0].sku.sku_code.includes("-VRZ") &&
                                  !result.matches[0].sku.sku_code.includes("-VZ") &&
                                  !result.matches[0].sku.sku_code.includes("-XFI") &&
                                  !result.matches[0].sku.sku_code.includes("-XFINITY") &&
                                  !result.matches[0].sku.sku_code.includes("-SPECTRUM") &&
                                  !result.matches[0].sku.sku_code.includes("-SPRINT") &&
                                  !result.matches[0].sku.sku_code.includes("-TRACFONE");
            
            if (hasNoCarrierTag) {
                console.log(`  🎯 CORRECT: Selected unlocked SKU (no carrier tag)`);
            } else {
                console.log(`  ❌ ERROR: Should have selected unlocked SKU (no carrier tag)`);
            }
            
        } else {
            console.log(`\n❌ No matches found`);
            console.log(`  Requires Attention: ${result.requiresAttention ? 'YES ⚠️' : 'NO ✅'}`);
        }
        
        await matchingService.close();
        console.log('\n✅ Test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testUnlockedNoNotes();

