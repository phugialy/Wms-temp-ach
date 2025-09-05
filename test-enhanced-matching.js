const EnhancedMatchingService = require('./enhanced-matching-service');

async function testEnhancedMatching() {
    console.log('🧪 Testing Enhanced Matching Service with Real IMEI Data...');
    
    try {
        const matchingService = new EnhancedMatchingService();
        await matchingService.initialize();
        
        console.log('✅ Enhanced matching service initialized successfully');
        
        // Test with your REAL IMEI data from SKU matching view
        const realImeiDevices = [
            {
                name: 'Galaxy Z Fold3 Duos - 256GB Phantom Black T-Mobile',
                device: {
                    model: 'Galaxy Z Fold3 Duos',
                    capacity: '256GB',
                    color: 'Phantom Black',
                    carrier: 'T-Mobile',
                    postfix: null,
                    device_notes: 'CARRIER LOCKED'
                }
            },
            {
                name: 'Galaxy Z Fold3 Duos - 512GB Phantom Black Verizon',
                device: {
                    model: 'Galaxy Z Fold3 Duos',
                    capacity: '512GB',
                    color: 'Phantom Black',
                    carrier: 'Verizon',
                    postfix: null,
                    device_notes: 'CARRIER UNLOCKED'
                }
            },
            {
                name: 'Galaxy Z Fold3 Duos - 256GB Phantom Black AT&T',
                device: {
                    model: 'Galaxy Z Fold3 Duos',
                    capacity: '256GB',
                    color: 'Phantom Black',
                    carrier: 'AT&T',
                    postfix: null,
                    device_notes: 'CARRIER UNLOCKED, OIL REQUIRED ON OUTSIDE SCREEN'
                }
            }
        ];
        
        console.log(`\n📋 Testing ${realImeiDevices.length} REAL IMEI device scenarios:`);
        
        for (let i = 0; i < realImeiDevices.length; i++) {
            const testCase = realImeiDevices[i];
            console.log(`\n🔍 Test ${i + 1}: ${testCase.name}`);
            console.log(`  Original IMEI: ${JSON.stringify(testCase.device)}`);
            
            try {
                const matches = await matchingService.matchImeiToSku(testCase.device);
                
                if (matches.length > 0) {
                    console.log(`  ✅ Found ${matches.length} matches`);
                    
                    // Show top 5 matches
                    matches.slice(0, 5).forEach((match, index) => {
                        console.log(`    ${index + 1}. SKU: ${match.sku.sku_code}`);
                        console.log(`       Score: ${match.score}/100 | Method: ${match.method}`);
                        console.log(`       Matched: ${match.matchedCharacteristics.join(', ')}`);
                        console.log(`       Tags: [${match.sku.sku_tags.join(', ')}]`);
                    });
                } else {
                    console.log(`  ❌ No matches found`);
                }
                
            } catch (error) {
                console.error(`  ❌ Error: ${error.message}`);
            }
        }
        
        await matchingService.close();
        console.log('\n✅ Enhanced matching test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the enhanced matching test
testEnhancedMatching();

