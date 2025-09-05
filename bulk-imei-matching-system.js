const { Pool } = require('pg');
require('dotenv').config();

async function testBulkImeiMatching() {
    console.log('🎯 Testing BULK IMEI Matching System (FILTERING OUT postfix SKUs)...');
    
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
            
            // CORRECT: Parse device_notes to determine actual carrier status
            const actualCarrier = parseCarrierFromNotes(testCase.device);
            console.log(`  🔄 device_notes OVERRIDE: carrier "${testCase.device.carrier}" → "${actualCarrier}"`);
            
            // Now match with the CORRECT carrier
            const correctedDevice = {
                ...testCase.device,
                carrier: actualCarrier
            };
            
            console.log(`  ✅ Corrected device: ${JSON.stringify(correctedDevice)}`);
            
            // Get ALL SKUs but FILTER OUT those with postfix
            const result = await client.query(`
                SELECT id, sku_code, sku_tags
                FROM sku_master 
                WHERE sku_tags IS NOT NULL AND array_length(sku_tags, 1) > 0
                ORDER BY id
            `);
            
            console.log(`  📋 Searching through ${result.rows.length} total SKUs...`);
            
            // FILTER OUT SKUs with postfix (to avoid confusion in bulk processing)
            const filteredSkus = result.rows.filter(sku => !hasPostfix(sku.sku_code));
            console.log(`  🔍 FILTERED OUT postfix SKUs: ${result.rows.length - filteredSkus.length} removed`);
            console.log(`  ✅ Remaining SKUs (no postfix): ${filteredSkus.length}`);
            
            const matches = [];
            
            for (const sku of filteredSkus) {
                const matchResult = calculateBulkScore(correctedDevice, sku.sku_tags);
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
                console.log(`  📊 Found ${matches.length} matches (postfix SKUs filtered out)`);
                
                // Show only HIGH-QUALITY matches (score > 70)
                const highQualityMatches = matches.filter(m => m.score > 70);
                console.log(`  🏆 HIGH-QUALITY matches (Score > 70): ${highQualityMatches.length}`);
                
                if (highQualityMatches.length > 0) {
                    highQualityMatches.slice(0, 5).forEach((match, index) => {
                        console.log(`\n    ${index + 1}. SKU: ${match.sku}`);
                        console.log(`       Score: ${match.score}/100`);
                        console.log(`       Tags: [${match.tags.join(', ')}]`);
                        console.log(`       Matched: ${match.matchedCharacteristics.join(', ')}`);
                        console.log(`       📦 Status: Grade A Renew + No retail box (no postfix)`);
                    });
                } else {
                    console.log(`  📈 MEDIUM matches (Score 30-70): ${matches.filter(m => m.score >= 30 && m.score <= 70).length}`);
                    console.log(`  📉 LOW matches (Score < 30): ${matches.filter(m => m.score < 30).length}`);
                }
            } else {
                console.log(`  ❌ No matches found (after filtering out postfix SKUs)`);
            }
        }
        
        // Show what was filtered out
        console.log('\n🔍 SHOWING WHAT WAS FILTERED OUT:');
        const allSkus = await client.query(`
            SELECT sku_code, sku_tags
            FROM sku_master 
            WHERE sku_tags IS NOT NULL AND array_length(sku_tags, 1) > 0
            AND sku_code LIKE 'FOLD3-256-BLK%'
            ORDER BY sku_code
        `);
        
        console.log(`\n📋 FOLD3-256-BLK SKUs (including postfix):`);
        allSkus.rows.forEach((sku, index) => {
            const hasPostfix = hasPostfix(sku.sku_code);
            const postfixInfo = hasPostfix ? decodePostfix(sku.sku_code) : null;
            
            console.log(`  ${index + 1}. ${sku.sku_code}`);
            console.log(`     Tags: [${sku.sku_tags.join(', ')}]`);
            if (hasPostfix) {
                console.log(`     ❌ FILTERED OUT: ${postfixInfo.grade} - ${postfixInfo.condition}`);
            } else {
                console.log(`     ✅ INCLUDED: Grade A Renew + No retail box`);
            }
        });
        
        client.release();
        await pool.end();
        
        console.log('\n✅ Bulk IMEI matching test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// NEW: Check if SKU has postfix
function hasPostfix(skuCode) {
    const parts = skuCode.split('-');
    return parts.length >= 4; // 3 parts = no postfix, 4+ parts = has postfix
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

// Decode POSTFIX meaning (for reference only)
function decodePostfix(skuCode) {
    const parts = skuCode.split('-');
    if (parts.length < 4) return null; // No postfix
    
    const postfix = parts[parts.length - 1];
    
    // Grade B
    if (postfix === 'VG' || postfix === 'UV') {
        return { grade: 'Grade B', condition: 'Good condition' };
    }
    
    // Grade C
    if (postfix === 'ACCEPTABLE') {
        return { grade: 'Grade C', condition: 'Acceptable condition' };
    }
    
    // Grade A + Has Retail Box
    if (postfix === 'UL' || postfix === 'LN') {
        return { grade: 'Grade A', condition: 'Has retail box' };
    }
    
    // New sealed box
    if (postfix === 'NEW') {
        return { grade: 'New', condition: 'Sealed box' };
    }
    
    // Unknown postfix
    return { grade: 'Unknown', condition: `Postfix: ${postfix}` };
}

function calculateBulkScore(device, skuTags) {
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

// Run the bulk IMEI matching test
testBulkImeiMatching();

