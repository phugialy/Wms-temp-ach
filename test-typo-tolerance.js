const CompleteSkuMatchingService = require('./src/services/CompleteSkuMatchingService');

async function testTypoTolerance() {
    console.log('🧪 TESTING TYPO TOLERANCE FOR CARRIER STATUS...');
    
    try {
        const matchingService = new CompleteSkuMatchingService();
        await matchingService.initialize();
        
        // Test cases with various typos and realistic device_notes
        const testCases = [
            // Correct cases
            { notes: 'CARRIER UNLOCKED', expected: { locked: false, unlocked: true } },
            { notes: 'CARRIER LOCKED', expected: { locked: true, unlocked: false } },
            { notes: 'CARRIER LOCK', expected: { locked: true, unlocked: false } },
            { notes: 'CARRIER UNLOCK', expected: { locked: false, unlocked: true } },
            
            // Single character typos (should work)
            { notes: 'CARRIER UNLOKED', expected: { locked: false, unlocked: true } }, // Missing C
            { notes: 'CARRIER UNLCKED', expected: { locked: false, unlocked: true } }, // Missing O
            { notes: 'CARRIER UNLOK', expected: { locked: false, unlocked: true } },   // Missing ED
            { notes: 'CARRIER LOK', expected: { locked: true, unlocked: false } },     // Missing C
            { notes: 'CARRIER LCK', expected: { locked: true, unlocked: false } },     // Missing O
            { notes: 'CARRIER LOKED', expected: { locked: true, unlocked: false } },   // Missing C
            
            // Double character typos (should work for common cases)
            { notes: 'CARRIER UNLCK', expected: { locked: false, unlocked: true } },   // Missing O and ED
            { notes: 'CARRIER UNLOKD', expected: { locked: false, unlocked: true } },  // Missing C and E
            
            // Realistic device_notes with other content
            { notes: 'CARRIER UNLOCKED, SCRATCHES ON SCREEN', expected: { locked: false, unlocked: true } },
            { notes: 'CARRIER LOCKED - OIL REQUIRED', expected: { locked: true, unlocked: false } },
            { notes: 'CARRIER UNLOKED, SCRATCHES ON THE MIDDLE OF INSIDE SCREEN', expected: { locked: false, unlocked: true } },
            { notes: 'CARRIER LOK - OIL REQUIERED ON FRONT SCREEN', expected: { locked: true, unlocked: false } },
            { notes: 'CARRIER UNLOCKED,SCRATCHES ALONG THE FRONT SCREEN', expected: { locked: false, unlocked: true } },
            { notes: 'CARRIER LOCKED; OIL REQUIERED ON INSIDE ON SCREEN', expected: { locked: true, unlocked: false } },
            
            // Ambiguous cases (should be marked as ambiguous)
            { notes: 'CARRIER NLOC', expected: { locked: false, unlocked: false } },   // Too ambiguous
            { notes: 'CARRIER UNLC', expected: { locked: false, unlocked: true } },    // UNLC = UNLOCKED (as per user preference)
            { notes: 'CARRIER LOKC', expected: { locked: false, unlocked: false } },   // Too ambiguous
            
            // No carrier status
            { notes: 'SOME OTHER NOTES', expected: { locked: false, unlocked: false } },
            { notes: 'SCRATCHES ON SCREEN', expected: { locked: false, unlocked: false } },
            { notes: 'OIL REQUIRED', expected: { locked: false, unlocked: false } },
            { notes: null, expected: { locked: false, unlocked: false } },
            { notes: '', expected: { locked: false, unlocked: false } },
        ];
        
        console.log('\n📋 Running typo tolerance tests...\n');
        
        let passedTests = 0;
        let totalTests = testCases.length;
        
        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            const result = matchingService.parseCarrierStatusWithTypoTolerance(testCase.notes);
            
            const passed = (
                result.isExplicitlyLocked === testCase.expected.locked &&
                result.isExplicitlyUnlocked === testCase.expected.unlocked
            );
            
            const status = passed ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} Test ${i + 1}: "${testCase.notes}"`);
            console.log(`   Expected: locked=${testCase.expected.locked}, unlocked=${testCase.expected.unlocked}`);
            console.log(`   Got:      locked=${result.isExplicitlyLocked}, unlocked=${result.isExplicitlyUnlocked}`);
            
            if (passed) {
                passedTests++;
            }
            console.log('');
        }
        
        console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed (${((passedTests/totalTests)*100).toFixed(1)}%)`);
        
        // Test the specific problematic case
        console.log('\n🎯 Testing the specific problematic IMEI case:');
        const problematicResult = matchingService.parseCarrierStatusWithTypoTolerance('CARRIER UNLOKED');
        console.log(`   Input: "CARRIER UNLOKED"`);
        console.log(`   Result: locked=${problematicResult.isExplicitlyLocked}, unlocked=${problematicResult.isExplicitlyUnlocked}`);
        console.log(`   Expected: locked=false, unlocked=true`);
        console.log(`   Status: ${problematicResult.isExplicitlyUnlocked ? '✅ FIXED' : '❌ STILL BROKEN'}`);
        
        await matchingService.close();
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testTypoTolerance();
