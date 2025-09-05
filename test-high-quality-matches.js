const { Pool } = require('pg');
require('dotenv').config();

async function testHighQualityMatches() {
    console.log('🎯 Testing for HIGH-QUALITY Matches Only (Score > 70)...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Test with your REAL IMEI data
        const testDevice = {
            model: 'Galaxy Z Fold3 Duos',
            capacity: '256GB',
            color: 'Phantom Black',
            carrier: 'AT&T',
            postfix: null,
            device_notes: 'CARRIER UNLOCKED'
        };
        
        console.log(`\n🔍 Testing device: ${JSON.stringify(testDevice)}`);
        
        // Get all SKUs with tags
        const result = await client.query(`
            SELECT id, sku_code, sku_tags
            FROM sku_master 
            WHERE sku_tags IS NOT NULL AND array_length(sku_tags, 1) > 0
            ORDER BY id
        `);
        
        console.log(`📋 Found ${result.rows.length} total SKUs with tags`);
        
        // Enhanced matching with detailed scoring
        const matches = [];
        
        for (const sku of result.rows) {
            const matchResult = calculateDetailedScore(testDevice, sku.sku_tags);
            
            if (matchResult.score > 0) {
                matches.push({
                    sku: sku.sku_code,
                    tags: sku.sku_tags,
                    ...matchResult
                });
            }
        }
        
        // Sort by score (highest first)
        matches.sort((a, b) => b.score - a.score);
        
        console.log(`\n📊 Found ${matches.length} total matches`);
        
        // Show only HIGH-QUALITY matches (score > 70)
        const highQualityMatches = matches.filter(m => m.score > 70);
        console.log(`\n🏆 HIGH-QUALITY MATCHES (Score > 70): ${highQualityMatches.length}`);
        
        highQualityMatches.slice(0, 10).forEach((match, index) => {
            console.log(`\n  ${index + 1}. SKU: ${match.sku}`);
            console.log(`     Score: ${match.score}/100`);
            console.log(`     Tags: [${match.tags.join(', ')}]`);
            console.log(`     Matched: ${match.matchedCharacteristics.join(', ')}`);
        });
        
        // Show MEDIUM matches (score 30-70)
        const mediumMatches = matches.filter(m => m.score >= 30 && m.score <= 70);
        console.log(`\n📈 MEDIUM MATCHES (Score 30-70): ${mediumMatches.length}`);
        
        // Show LOW matches (score < 30)
        const lowMatches = matches.filter(m => m.score < 30);
        console.log(`\n📉 LOW MATCHES (Score < 30): ${lowMatches.length}`);
        
        // Show score distribution
        console.log(`\n📊 SCORE DISTRIBUTION:`);
        console.log(`  High Quality (>70): ${highQualityMatches.length} matches`);
        console.log(`  Medium (30-70): ${mediumMatches.length} matches`);
        console.log(`  Low (<30): ${lowMatches.length} matches`);
        
        client.release();
        await pool.end();
        
        console.log('\n✅ High-quality match test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

function calculateDetailedScore(device, skuTags) {
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
    
    // Check CARRIER match
    if (normalizedCarrier && skuTags.includes(normalizedCarrier)) {
        score += 15;
        matchedCharacteristics.push(`CARRIER: ${normalizedCarrier}`);
    }
    
    // Check device_notes for additional points
    if (device.device_notes) {
        const notesScore = parseDeviceNotes(device.device_notes, skuTags);
        if (notesScore > 0) {
            score += notesScore;
            matchedCharacteristics.push(`NOTES: +${notesScore} points`);
        }
    }
    
    return {
        score,
        matchedCharacteristics,
        totalCharacteristics: Object.keys(device).filter(key => device[key]).length
    };
}

function normalizeModel(model) {
    if (!model) return null;
    const upper = model.toUpperCase();
    
    // Your real IMEI data mappings
    if (upper.includes('GALAXY') && upper.includes('FOLD3')) return 'FOLD3';
    if (upper.includes('FOLD3')) return 'FOLD3';
    
    return upper;
}

function normalizeColor(color) {
    if (!color) return null;
    const upper = color.toUpperCase();
    
    // Your real IMEI data mappings
    if (upper.includes('PHANTOM') && upper.includes('BLACK')) return 'BLK';
    if (upper.includes('PHANTOM') && upper.includes('GREEN')) return 'GRN';
    if (upper.includes('PHANTOM') && upper.includes('SILVER')) return 'SLV';
    
    return upper;
}

function normalizeCarrier(carrier) {
    if (!carrier) return null;
    const upper = carrier.toUpperCase();
    
    // Your real IMEI data mappings
    if (upper === 'T-MOBILE') return 'TMO';
    if (upper === 'VERIZON') return 'VG';
    if (upper === 'AT&T') return 'ATT';
    if (upper === 'UNLOCKED') return 'UNL';
    if (upper === 'LOCKED') return 'LKD';
    
    return upper;
}

function parseDeviceNotes(notes, skuTags) {
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

// Run the high-quality match test
testHighQualityMatches();

