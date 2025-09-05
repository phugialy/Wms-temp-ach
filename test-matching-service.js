const SkuMatchingService = require('./src/services/SkuMatchingService');

async function testMatchingService() {
    console.log('🧪 Testing SKU Matching Service...');
    
    try {
        const matchingService = new SkuMatchingService();
        await matchingService.initialize();
        
        console.log('✅ Matching service initialized successfully');
        
        // Test cases with different scenarios
        const testCases = [
            {
                name: 'Exact Match - Samsung Galaxy Fold',
                device: {
                    model: 'FOLD3',
                    capacity: '256GB',
                    color: 'GREEN',
                    carrier: 'T-MOBILE'
                }
            },
            {
                name: 'Abbreviation Match - Color',
                device: {
                    model: 'IPAD',
                    capacity: '128GB',
                    color: 'GRN', // Should match GREEN via abbreviation
                    carrier: 'WIFI'
                }
            },
            {
                name: 'Token Match - Multi-word Color',
                device: {
                    model: 'IPAD',
                    capacity: '256GB',
                    color: 'PHANTOM GREEN', // Should match GREEN token
                    carrier: 'WIFI'
                }
            },
            {
                name: 'Partial Match - Missing Some Characteristics',
                device: {
                    model: 'IPHONE',
                    capacity: '128GB'
                    // Missing color and carrier
                }
            },
            {
                name: 'No Match - Unknown Device',
                device: {
                    model: 'UNKNOWN_DEVICE',
                    capacity: '999GB',
                    color: 'INVISIBLE'
                }
            }
        ];
        
        console.log(`\n📋 Testing ${testCases.length} scenarios:`);
        
        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            console.log(`\n🔍 Test ${i + 1}: ${testCase.name}`);
            console.log(`  Device: ${JSON.stringify(testCase.device)}`);
            
            try {
                const matches = await matchingService.matchDeviceToSku(testCase.device);
                
                if (matches.length > 0) {
                    console.log(`  ✅ Found ${matches.length} matches`);
                    
                    // Show top 3 matches
                    matches.slice(0, 3).forEach((match, index) => {
                        console.log(`    ${index + 1}. SKU: ${match.sku.sku_code}`);
                        console.log(`       Score: ${match.score}/100 | Method: ${match.method}`);
                        console.log(`       Matched: ${match.matchedCharacteristics.join(', ')}`);
                    });
                } else {
                    console.log(`  ❌ No matches found`);
                }
                
            } catch (error) {
                console.error(`  ❌ Error: ${error.message}`);
            }
        }
        
        // Show matching statistics
        console.log('\n📊 Matching Statistics:');
        const stats = await matchingService.getMatchingStats();
        console.log(`  Total matches attempted: ${stats.totalMatches}`);
        console.log(`  Exact matches: ${stats.exactMatches}`);
        console.log(`  Abbreviation matches: ${stats.abbreviationMatches}`);
        console.log(`  Token matches: ${stats.tokenMatches}`);
        console.log(`  No matches: ${stats.noMatches}`);
        console.log(`  Success rate: ${stats.successRate}%`);
        
        await matchingService.close();
        console.log('\n✅ Matching service test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testMatchingService();

