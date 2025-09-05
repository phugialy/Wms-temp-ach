const { Pool } = require('pg');
require('dotenv').config();

async function testCorrectCarrierMatching() {
    console.log('🎯 Testing CORRECT Carrier Matching (device_notes overrides carrier field)...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Test with your REAL IMEI data scenarios
        const testDevices = [
            {
                name: 'Galaxy Z Fold3 Duos - 256GB Phantom Black AT&T (UNLOCKED)',
                device: {
                    model: 'Galaxy Z Fold3 Duos',
                    capacity: '256GB',
                    color: 'Phantom Black',
                    carrier: 'AT&T',  // This should be OVERRIDDEN by device_notes
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
                    carrier: 'T-Mobile',  // This should be KEPT because device_notes says LOCKED
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
            
            // CORRECT: Parse device_notes to determine actual carrier status
            const actualCarrier = parseCarrierFromNotes(testCase.device);
            console.log(`  🔄 device_notes OVERRIDE: carrier "${testCase.device.carrier}" → "${actualCarrier}"`);
            
            // Now match with the CORRECT carrier
            const correctedDevice = {
                ...testCase.device,
                carrier: actualCarrier
            };
            
            console.log(`  ✅ Corrected device: ${JSON.stringify(correctedDevice)}`);
            
            // Get SKUs and test matching
            const result = await client.query(`
                SELECT id, sku_code, sku_tags
                FROM sku_master 
                WHERE sku_tags IS NOT NULL AND array_length(sku_tags, 1) > 0
                ORDER BY id
                LIMIT 100
            `);
            
            const matches = [];
            
            for (const sku of result.rows) {
                const matchResult = calculateCorrectScore(correctedDevice, sku.sku_tags);
                if (matchResult.score > 0) {
                    matches.push({
                        sku: sku.sku_code,
                        tags: sku.sku_tags,
                        ...matchResult
                    });
                }
            }
            
            matches.sort((a, b) => b.score - a.score);
            
            if (matches.length > 0) {
                console.log(`  📊 Found ${matches.length} matches`);
                
                // Show top 3 matches
                matches.slice(0, 3).forEach((match, index) => {
                    console.log(`    ${index + 1}. SKU: ${match.sku} | Score: ${match.score}/100`);
                    console.log(`       Tags: [${match.tags.join(', ')}]`);
                    console.log(`       Matched: ${match.matchedCharacteristics.join(', ')}`);
                });
            } else {
                console.log(`  ❌ No matches found`);
            }
        }
        
        client.release();
        await pool.end();
        
        console.log('\n✅ Correct carrier matching test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// CORRECT: Parse device_notes to determine actual carrier status
function parseCarrierFromNotes(device) {
    if (!device.device_notes) {
        return device.carrier; // No notes, use original carrier
    }
    
    const upperNotes = device.device_notes.toUpperCase();
    
    // Check for UNLOCKED status
    if (upperNotes.includes('CARRIER UNLOCKED') || upperNotes.includes('UNLOCKED')) {
        return 'UNLOCKED';
    }
    
    // Check for LOCKED status
    if (upperNotes.includes('CARRIER LOCKED') || upperNotes.includes('LOCKED')) {
        return device.carrier; // Keep original carrier (locked to that carrier)
    }
    
    // Check for specific carrier mentions in notes
    if (upperNotes.includes('T-MOBILE') || upperNotes.includes('TMO')) {
        return 'T-MOBILE';
    }
    if (upperNotes.includes('VERIZON') || upperNotes.includes('VG')) {
        return 'VERIZON';
    }
    if (upperNotes.includes('AT&T') || upperNotes.includes('ATT')) {
        return 'AT&T';
    }
    
    // Default: use original carrier
    return device.carrier;
}

function calculateCorrectScore(device, skuTags) {
    let score = 0;
    let matchedCharacteristics = [];
    
    // Normalize device data
    const normalizedModel = normalizeModel(device.model);
    const normalizedCapacity = device.capacity?.replace(/GB$/i, '');
    const normalizedColor = normalizeColor(device.color);
    const normalizedCarrier = normalizeCarrier(device.carrier);
    
    // Check MODEL match
    if (normalizedModel && skuTags.includes(normalizedModel)) {
        score += 30;
        matchedCharacteristics.push(`MODEL: ${normalizedModel}`);
    }
    
    // Check CAPACITY match
    if (normalizedCapacity && skuTags.includes(normalizedCapacity)) {
        score += 25;
        matchedCharacteristics.push(`CAPACITY: ${normalizedCapacity}`);
    }
    
    // Check COLOR match
    if (normalizedColor && skuTags.includes(normalizedColor)) {
        score += 20;
        matchedCharacteristics.push(`COLOR: ${normalizedColor}`);
    }
    
    // Check CARRIER match (now using the CORRECTED carrier from device_notes)
    if (normalizedCarrier && skuTags.includes(normalizedCarrier)) {
        score += 15;
        matchedCharacteristics.push(`CARRIER: ${normalizedCarrier}`);
    }
    
    // Check device_notes for additional context
    if (device.device_notes) {
        const notesScore = calculateNotesScore(device.device_notes, skuTags);
        if (notesScore > 0) {
            score += notesScore;
            matchedCharacteristics.push(`NOTES: +${notesScore} points`);
        }
    }
    
    return {
        score,
        matchedCharacteristics
    };
}

function normalizeModel(model) {
    if (!model) return null;
    const upper = model.toUpperCase();
    
    if (upper.includes('GALAXY') && upper.includes('FOLD3')) return 'FOLD3';
    if (upper.includes('FOLD3')) return 'FOLD3';
    
    return upper;
}

function normalizeColor(color) {
    if (!color) return null;
    const upper = color.toUpperCase();
    
    if (upper.includes('PHANTOM') && upper.includes('BLACK')) return 'BLK';
    if (upper.includes('PHANTOM') && upper.includes('GREEN')) return 'GRN';
    if (upper.includes('PHANTOM') && upper.includes('SILVER')) return 'SLV';
    
    return upper;
}

function normalizeCarrier(carrier) {
    if (!carrier) return null;
    const upper = carrier.toUpperCase();
    
    if (upper === 'T-MOBILE') return 'TMO';
    if (upper === 'VERIZON') return 'VG';
    if (upper === 'AT&T') return 'ATT';
    if (upper === 'UNLOCKED') return 'UNL';
    if (upper === 'LOCKED') return 'LKD';
    
    return upper;
}

function calculateNotesScore(notes, skuTags) {
    if (!notes || !skuTags) return 0;
    
    let score = 0;
    const upperNotes = notes.toUpperCase();
    const tokens = upperNotes.split(/[\s,.-]+/).filter(token => token.length > 2);
    
    for (const token of tokens) {
        if (skuTags.includes(token)) {
            score += 5;
        }
        
        // Check abbreviations
        if (token === 'SLV' && skuTags.includes('SILVER')) score += 5;
        if (token === 'BLK' && skuTags.includes('BLACK')) score += 5;
        if (token === 'GRN' && skuTags.includes('GREEN')) score += 5;
        if (token === 'TMO' && skuTags.includes('T-MOBILE')) score += 5;
        if (token === 'VG' && skuTags.includes('VERIZON')) score += 5;
        if (token === 'ATT' && skuTags.includes('AT&T')) score += 5;
        if (token === 'UNLOCKED' && skuTags.includes('UNLOCKED')) score += 5;
        if (token === 'LOCKED' && skuTags.includes('LOCKED')) score += 5;
    }
    
    return Math.min(score, 25);
}

// Run the correct carrier matching test
testCorrectCarrierMatching();

