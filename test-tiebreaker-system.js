const CompleteSkuMatchingService = require('./src/services/CompleteSkuMatchingService');

async function testTiebreakerSystem() {
    console.log('🧪 Testing TIEBREAKER System for SKU Matching...');
    
    try {
        const matchingService = new CompleteSkuMatchingService();
        await matchingService.initialize();
        
        console.log('✅ Complete SKU Matching Service initialized successfully');
        
        // Test with UNLOCKED device (should prefer SKUs without carrier postfix)
        const unlockedDevice = {
            model: 'Galaxy Z Fold3 Duos',
            capacity: '256GB',
            color: 'Phantom Black',
            carrier: 'AT&T',
            postfix: null,
            device_notes: 'CARRIER UNLOCKED'
        };
        
        console.log('\n🔍 Testing UNLOCKED device with tiebreaker system:');
        console.log(`  Device: ${JSON.stringify(unlockedDevice)}`);
        
        // Test with custom options to see tiebreaker in action
        const matches = await matchingService.matchImeiToSku(unlockedDevice, {
            filterPostfix: false,  // Include all SKUs to see tiebreaker
            minScore: 70,          // Only high-quality matches
            maxResults: 10         // Show more results
        });
        
        if (matches.length > 0) {
            console.log(`\n📊 Found ${matches.length} matches with tiebreaker scoring:`);
            
            matches.forEach((match, index) => {
                console.log(`\n    ${index + 1}. SKU: ${match.sku.sku_code}`);
                console.log(`       Primary Score: ${match.score}/100`);
                console.log(`       Tiebreaker Score: ${match.tiebreakerScore}/20`);
                console.log(`       🏆 TOTAL Score: ${match.totalScore}/120`);
                console.log(`       Tags: [${match.sku.sku_tags.join(', ')}]`);
                console.log(`       Matched: ${match.matchedCharacteristics.join(', ')}`);
                
                if (match.tiebreakerDetails.length > 0) {
                    console.log(`       🔍 Tiebreaker Details:`);
                    match.tiebreakerDetails.forEach(detail => {
                        console.log(`         • ${detail}`);
                    });
                }
                
                // Decode the POSTFIX meaning
                const postfixInfo = matchingService.decodePostfix(match.sku.sku_code);
                if (postfixInfo) {
                    console.log(`       📦 POSTFIX: ${postfixInfo.grade} - ${postfixInfo.condition}`);
                }
            });
            
            // Show the WINNER
            const winner = matches[0];
            console.log(`\n🏆 WINNER: ${winner.sku.sku_code}`);
            console.log(`   Total Score: ${winner.totalScore}/120`);
            console.log(`   Primary: ${winner.score}/100 | Tiebreaker: ${winner.tiebreakerScore}/20`);
            
        } else {
            console.log(`  ❌ No high-quality matches found (Score >= 70)`);
        }
        
        await matchingService.close();
        console.log('\n✅ Tiebreaker system test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the tiebreaker test
testTiebreakerSystem();

