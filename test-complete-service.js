const CompleteSkuMatchingService = require('./src/services/CompleteSkuMatchingService');

async function testCompleteService() {
    console.log('🧪 Testing Complete SKU Matching Service (Production Ready)...');
    
    try {
        const matchingService = new CompleteSkuMatchingService();
        await matchingService.initialize();
        
        console.log('✅ Complete SKU Matching Service initialized successfully');
        
        // Test with your REAL IMEI data scenarios
        const testDevices = [
            {
                name: 'Galaxy Z Fold3 Duos - 256GB Phantom Black AT&T (UNLOCKED)',
                device: {
                    model: 'Galaxy Z Fold3 Duos',
                    capacity: '256GB',
                    color: 'Phantom Black',
                    carrier: 'AT&T',
                    postfix: null,
                    device_notes: 'CARRIER UNLOCKED'
                }
            },
            {
                name: 'Galaxy Z Fold3 Duos - 256GB Phantom Black T-Mobile (LOCKED)',
                device: {
                    model: 'Galaxy Z Fold3 Duos',
                    capacity: '256GB',
                    color: 'Phantom Black',
                    carrier: 'T-Mobile',
                    postfix: null,
                    device_notes: 'CARRIER LOCKED'
                }
            }
        ];
        
        console.log(`\n📋 Testing ${testDevices.length} carrier scenarios:`);
        
        for (let i = 0; i < testDevices.length; i++) {
            const testCase = testDevices[i];
            console.log(`\n🔍 Test ${i + 1}: ${testCase.name}`);
            console.log(`  Original: ${JSON.stringify(testCase.device)}`);
            
            try {
                // Test with default options (filterPostfix=true, minScore=70, maxResults=10)
                const matches = await matchingService.matchImeiToSku(testCase.device);
                
                if (matches.length > 0) {
                    console.log(`  ✅ Found ${matches.length} high-quality matches (Score >= 70):`);
                    
                    matches.forEach((match, index) => {
                        console.log(`\n    ${index + 1}. SKU: ${match.sku.sku_code}`);
                        console.log(`       Score: ${match.score}/100`);
                        console.log(`       Tags: [${match.sku.sku_tags.join(', ')}]`);
                        console.log(`       Matched: ${match.matchedCharacteristics.join(', ')}`);
                        
                        // Decode the POSTFIX meaning
                        const postfixInfo = matchingService.decodePostfix(match.sku.sku_code);
                        if (postfixInfo) {
                            console.log(`       📦 POSTFIX: ${postfixInfo.grade} - ${postfixInfo.condition}`);
                        }
                    });
                } else {
                    console.log(`  ❌ No high-quality matches found (Score >= 70)`);
                }
                
            } catch (error) {
                console.error(`  ❌ Error: ${error.message}`);
            }
        }
        
        // Test with custom options
        console.log('\n🔧 Testing with custom options (filterPostfix=false, minScore=50, maxResults=5):');
        const customMatches = await matchingService.matchImeiToSku(testDevices[0].device, {
            filterPostfix: false,  // Include SKUs with postfix
            minScore: 50,          // Lower score threshold
            maxResults: 5          // Only 5 results
        });
        
        if (customMatches.length > 0) {
            console.log(`  ✅ Found ${customMatches.length} matches with custom options:`);
            customMatches.forEach((match, index) => {
                console.log(`    ${index + 1}. SKU: ${match.sku.sku_code} | Score: ${match.score}/100`);
            });
        }
        
        // Get service statistics
        console.log('\n📊 Getting service statistics...');
        const stats = await matchingService.getMatchingStats();
        console.log(`  Service Status: ${stats.serviceStatus}`);
        console.log(`  Total SKUs: ${stats.totalSkus}`);
        console.log(`  Total Tags: ${stats.totalTags}`);
        
        await matchingService.close();
        console.log('\n✅ Complete service test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the complete service test
testCompleteService();

