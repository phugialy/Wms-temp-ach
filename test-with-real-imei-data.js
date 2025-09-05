const { Pool } = require('pg');
require('dotenv').config();

async function testWithRealImeiData() {
    console.log('🧪 Testing with REAL IMEI Data from SKU Matching View...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Test with REAL IMEI device characteristics from your SKU matching view
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
                name: 'Galaxy Z Fold3 Duos - 256GB Phantom Black Unlocked',
                device: {
                    model: 'Galaxy Z Fold3 Duos',
                    capacity: '256GB',
                    color: 'Phantom Black',
                    carrier: 'Unlocked',
                    postfix: null,
                    device_notes: 'SCRATCHES ON INSIDE SCREEN'
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
            console.log(`  Device: ${JSON.stringify(testCase.device)}`);
            
            // Get SKUs with tags
            const result = await client.query(`
                SELECT id, sku_code, sku_tags
                FROM sku_master 
                WHERE sku_tags IS NOT NULL AND array_length(sku_tags, 1) > 0
                ORDER BY id 
                LIMIT 200
            `);
            
            // Enhanced matching logic for REAL IMEI data
            const matches = [];
            
            for (const sku of result.rows) {
                let score = 0;
                let matchedCharacteristics = [];
                let matchMethod = 'exact';
                
                // Check explicit device characteristics first
                if (testCase.device.model && sku.sku_tags.includes(testCase.device.model)) {
                    score += 30;
                    matchedCharacteristics.push(`MODEL: ${testCase.device.model}`);
                }
                
                if (testCase.device.capacity && sku.sku_tags.includes(testCase.device.capacity)) {
                    score += 25;
                    matchedCharacteristics.push(`CAPACITY: ${testCase.device.capacity}`);
                }
                
                if (testCase.device.color && sku.sku_tags.includes(testCase.device.color)) {
                    score += 20;
                    matchedCharacteristics.push(`COLOR: ${testCase.device.color}`);
                }
                
                if (testCase.device.carrier && sku.sku_tags.includes(testCase.device.carrier)) {
                    score += 15;
                    matchedCharacteristics.push(`CARRIER: ${testCase.device.carrier}`);
                }
                
                if (testCase.device.postfix && sku.sku_tags.includes(testCase.device.postfix)) {
                    score += 10;
                    matchedCharacteristics.push(`POSTFIX: ${testCase.device.postfix}`);
                }
                
                // Enhanced: Parse device_notes for additional matching
                if (testCase.device.device_notes) {
                    const notesScore = parseRealDeviceNotes(testCase.device.device_notes, sku.sku_tags);
                    if (notesScore > 0) {
                        score += notesScore;
                        matchMethod = 'notes_enhanced';
                        matchedCharacteristics.push(`NOTES: +${notesScore} points`);
                    }
                }
                
                if (score > 0) {
                    matches.push({
                        sku: sku.sku_code,
                        score,
                        matchedCharacteristics,
                        matchMethod
                    });
                }
            }
            
            // Sort by score
            matches.sort((a, b) => b.score - a.score);
            
            if (matches.length > 0) {
                console.log(`  ✅ Found ${matches.length} matches`);
                
                // Show top 5 matches
                matches.slice(0, 5).forEach((match, index) => {
                    console.log(`    ${index + 1}. SKU: ${match.sku} | Score: ${match.score}/100 | Method: ${match.matchMethod}`);
                    console.log(`       Matched: ${match.matchedCharacteristics.join(', ')}`);
                });
            } else {
                console.log(`  ❌ No matches found`);
            }
        }
        
        // Test abbreviation handling for your real data
        console.log('\n🔍 Testing Abbreviation Handling for Real Data:');
        console.log('  Looking for SKUs that might match "FOLD3" (abbreviation of "Galaxy Z Fold3")');
        
        const fold3Result = await client.query(`
            SELECT id, sku_code, sku_tags
            FROM sku_master 
            WHERE sku_tags IS NOT NULL 
            AND ('FOLD3' = ANY(sku_tags) OR 'GALAXY' = ANY(sku_tags) OR 'Z' = ANY(sku_tags))
            ORDER BY id 
            LIMIT 10
        `);
        
        if (fold3Result.rows.length > 0) {
            console.log(`  ✅ Found ${fold3Result.rows.length} potential Galaxy/Fold SKUs:`);
            fold3Result.rows.forEach((sku, index) => {
                console.log(`    ${index + 1}. ${sku.sku_code} - Tags: [${sku.sku_tags.join(', ')}]`);
            });
        } else {
            console.log('  ❌ No Galaxy/Fold SKUs found');
        }
        
        client.release();
        await pool.end();
        
        console.log('\n✅ Real IMEI data test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Function to parse REAL device_notes from your IMEI data
function parseRealDeviceNotes(notes, skuTags) {
    if (!notes || !skuTags) return 0;
    
    let score = 0;
    const upperNotes = notes.toUpperCase();
    
    // Split notes into tokens and check for matches
    const tokens = upperNotes.split(/[\s,.-]+/).filter(token => token.length > 2);
    
    for (const token of tokens) {
        if (skuTags.includes(token)) {
            score += 5; // Small bonus for each token match
        }
        
        // Check for common abbreviations from your real data
        if (token === 'SLV' && skuTags.includes('SILVER')) score += 5;
        if (token === 'BLK' && skuTags.includes('BLACK')) score += 5;
        if (token === 'GRN' && skuTags.includes('GREEN')) score += 5;
        if (token === 'WHT' && skuTags.includes('WHITE')) score += 5;
        if (token === 'GLD' && skuTags.includes('GOLD')) score += 5;
        if (token === 'TMO' && skuTags.includes('T-MOBILE')) score += 5;
        if (token === 'VG' && skuTags.includes('VERIZON')) score += 5;
        if (token === 'ATT' && skuTags.includes('AT&T')) score += 5;
        
        // Handle your specific carrier cases
        if (token === 'UNLOCKED' && skuTags.includes('UNLOCKED')) score += 5;
        if (token === 'LOCKED' && skuTags.includes('LOCKED')) score += 5;
        
        // Handle condition notes
        if (token === 'SCRATCHES' && skuTags.includes('SCRATCHES')) score += 3;
        if (token === 'OIL' && skuTags.includes('OIL')) score += 3;
        if (token === 'SCREEN' && skuTags.includes('SCREEN')) score += 3;
    }
    
    return Math.min(score, 25); // Cap at 25 points for notes matching
}

// Run the test with real IMEI data
testWithRealImeiData();

