const { Pool } = require('pg');
require('dotenv').config();

async function simpleTestFixed() {
    console.log('🧪 Fixed Test of SKU Matching Logic with Device Notes...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Test device characteristics with CORRECT formats based on database
        // Including device_notes which is crucial for IMEI devices
        const testDevices = [
            {
                name: 'Samsung Galaxy Fold - Exact Match',
                device: {
                    model: 'FOLD3',
                    capacity: '256',  // Just '256', not '256GB'
                    color: 'GREEN',
                    carrier: 'VG',    // 'VG' for Verizon, not 'T-MOBILE'
                    postfix: null,
                    device_notes: 'Samsung Galaxy Fold 3, 256GB, Green, Verizon'
                }
            },
            {
                name: 'Samsung Galaxy Fold - Partial Match with Notes',
                device: {
                    model: 'FOLD3',
                    capacity: '256',
                    color: 'BLK',     // 'BLK' for Black
                    carrier: null,
                    postfix: null,
                    device_notes: 'Galaxy Fold 3 Black 256GB - Good condition'
                }
            },
            {
                name: 'iPhone - Partial Match with Notes',
                device: {
                    model: 'IP',
                    capacity: '128',
                    color: 'GREEN',
                    carrier: null,
                    postfix: null,
                    device_notes: 'iPhone 14 128GB Green - Unlocked, Mint condition'
                }
            },
            {
                name: 'iPad - Partial Match with Notes',
                device: {
                    model: 'IPAD',
                    capacity: '256',
                    color: 'SLV',     // 'SLV' for Silver
                    carrier: null,
                    postfix: null,
                    device_notes: 'iPad Pro 9.7" 256GB Silver WiFi - Excellent'
                }
            },
            {
                name: 'Device with Complex Notes - Smart Matching',
                device: {
                    model: null,
                    capacity: null,
                    color: null,
                    carrier: null,
                    postfix: null,
                    device_notes: 'Samsung Galaxy Fold 3 512GB Phantom Black Verizon - Like New'
                }
            },
            {
                name: 'Device with Abbreviations in Notes',
                device: {
                    model: null,
                    capacity: null,
                    color: null,
                    carrier: null,
                    postfix: null,
                    device_notes: 'IPAD PRO 9.7 32GB SLV WIFI - Good working condition'
                }
            }
        ];
        
        console.log(`\n📋 Testing ${testDevices.length} device scenarios:`);
        
        for (let i = 0; i < testDevices.length; i++) {
            const testCase = testDevices[i];
            console.log(`\n🔍 Test ${i + 1}: ${testCase.name}`);
            console.log(`  Device: ${JSON.stringify(testCase.device)}`);
            
            // Get SKUs with tags
            const result = await client.query(`
                SELECT id, sku_code, sku_tags
                FROM sku_master 
                WHERE sku_tags IS NOT NULL AND array_length(sku_tags, 1) > 0
                ORDER BY id 
                LIMIT 100
            `);
            
            // Enhanced matching logic that includes device_notes parsing
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
                    const notesScore = parseDeviceNotes(testCase.device.device_notes, sku.sku_tags);
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
                
                // Show top 3 matches
                matches.slice(0, 3).forEach((match, index) => {
                    console.log(`    ${index + 1}. SKU: ${match.sku} | Score: ${match.score}/100 | Method: ${match.matchMethod}`);
                    console.log(`       Matched: ${match.matchedCharacteristics.join(', ')}`);
                });
            } else {
                console.log(`  ❌ No matches found`);
            }
        }
        
        client.release();
        await pool.end();
        
        console.log('\n✅ Fixed test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Function to parse device_notes and find additional matches
function parseDeviceNotes(notes, skuTags) {
    if (!notes || !skuTags) return 0;
    
    let score = 0;
    const upperNotes = notes.toUpperCase();
    
    // Split notes into tokens and check for matches
    const tokens = upperNotes.split(/[\s,.-]+/).filter(token => token.length > 2);
    
    for (const token of tokens) {
        if (skuTags.includes(token)) {
            score += 5; // Small bonus for each token match
        }
        
        // Check for common abbreviations
        if (token === 'SLV' && skuTags.includes('SILVER')) score += 5;
        if (token === 'BLK' && skuTags.includes('BLACK')) score += 5;
        if (token === 'GRN' && skuTags.includes('GREEN')) score += 5;
        if (token === 'WHT' && skuTags.includes('WHITE')) score += 5;
        if (token === 'GLD' && skuTags.includes('GOLD')) score += 5;
        if (token === 'TMO' && skuTags.includes('T-MOBILE')) score += 5;
        if (token === 'VG' && skuTags.includes('VERIZON')) score += 5;
        if (token === 'ATT' && skuTags.includes('AT&T')) score += 5;
    }
    
    return Math.min(score, 20); // Cap at 20 points for notes matching
}

// Run the fixed test
simpleTestFixed();
