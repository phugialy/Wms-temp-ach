const { Pool } = require('pg');
require('dotenv').config();

async function debugDeviceNotes() {
    console.log('🔍 Debugging device_notes matching...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Your test device
        const testDevice = {
            model: 'Galaxy Z Fold3 Duos',
            capacity: '256GB',
            color: 'Phantom Black',
            carrier: 'AT&T',
            postfix: null,
            device_notes: 'CARRIER UNLOCKED'
        };
        
        console.log(`\n📱 Test Device: ${JSON.stringify(testDevice)}`);
        
        // Check what tokens we extract from device_notes
        const notesTokens = extractNotesTokens(testDevice.device_notes);
        console.log(`\n🔤 Extracted tokens from device_notes: [${notesTokens.join(', ')}]`);
        
        // Check which SKUs contain these tokens
        const result = await client.query(`
            SELECT id, sku_code, sku_tags
            FROM sku_master 
            WHERE sku_tags IS NOT NULL AND array_length(sku_tags, 1) > 0
            ORDER BY id
            LIMIT 50
        `);
        
        console.log(`\n📋 Checking ${result.rows.length} SKUs for device_notes tokens...`);
        
        // Check each SKU for device_notes matches
        for (const sku of result.rows) {
            const notesScore = calculateNotesScore(testDevice.device_notes, sku.sku_tags);
            if (notesScore > 0) {
                console.log(`\n  ✅ SKU: ${sku.sku_code}`);
                console.log(`     Tags: [${sku.sku_tags.join(', ')}]`);
                console.log(`     Notes Score: ${notesScore}`);
                
                // Show which tokens matched
                const matchedTokens = findMatchedTokens(testDevice.device_notes, sku.sku_tags);
                console.log(`     Matched tokens: [${matchedTokens.join(', ')}]`);
            }
        }
        
        // Check if any SKUs have "UNLOCKED" or "LOCKED" tags
        console.log('\n🔍 Checking for UNLOCKED/LOCKED tags in SKUs...');
        const unlockedResult = await client.query(`
            SELECT id, sku_code, sku_tags
            FROM sku_master 
            WHERE sku_tags IS NOT NULL 
            AND ('UNLOCKED' = ANY(sku_tags) OR 'LOCKED' = ANY(sku_tags))
            ORDER BY id
            LIMIT 10
        `);
        
        if (unlockedResult.rows.length > 0) {
            console.log(`✅ Found ${unlockedResult.rows.length} SKUs with UNLOCKED/LOCKED tags:`);
            unlockedResult.rows.forEach((sku, index) => {
                console.log(`  ${index + 1}. ${sku.sku_code} - Tags: [${sku.sku_tags.join(', ')}]`);
            });
        } else {
            console.log('❌ No SKUs found with UNLOCKED/LOCKED tags');
        }
        
        client.release();
        await pool.end();
        
        console.log('\n✅ Device notes debugging completed!');
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

function extractNotesTokens(notes) {
    if (!notes) return [];
    const upperNotes = notes.toUpperCase();
    return upperNotes.split(/[\s,.-]+/).filter(token => token.length > 2);
}

function calculateNotesScore(notes, skuTags) {
    if (!notes || !skuTags) return 0;
    
    let score = 0;
    const upperNotes = notes.toUpperCase();
    const tokens = upperNotes.split(/[\s,.-]+/).filter(token => token.length > 2);
    
    console.log(`    🔍 Checking tokens: [${tokens.join(', ')}] against SKU tags: [${skuTags.join(', ')}]`);
    
    for (const token of tokens) {
        if (skuTags.includes(token)) {
            score += 5;
            console.log(`      ✅ Token "${token}" found in SKU tags (+5 points)`);
        } else {
            console.log(`      ❌ Token "${token}" NOT found in SKU tags`);
        }
        
        // Check abbreviations
        if (token === 'SLV' && skuTags.includes('SILVER')) {
            score += 5;
            console.log(`      ✅ Abbreviation "SLV" → "SILVER" (+5 points)`);
        }
        if (token === 'BLK' && skuTags.includes('BLACK')) {
            score += 5;
            console.log(`      ✅ Abbreviation "BLK" → "BLACK" (+5 points)`);
        }
        if (token === 'GRN' && skuTags.includes('GREEN')) {
            score += 5;
            console.log(`      ✅ Abbreviation "GRN" → "GREEN" (+5 points)`);
        }
        if (token === 'TMO' && skuTags.includes('T-MOBILE')) {
            score += 5;
            console.log(`      ✅ Abbreviation "TMO" → "T-MOBILE" (+5 points)`);
        }
        if (token === 'VG' && skuTags.includes('VERIZON')) {
            score += 5;
            console.log(`      ✅ Abbreviation "VG" → "VERIZON" (+5 points)`);
        }
        if (token === 'ATT' && skuTags.includes('AT&T')) {
            score += 5;
            console.log(`      ✅ Abbreviation "ATT" → "AT&T" (+5 points)`);
        }
        if (token === 'UNLOCKED' && skuTags.includes('UNLOCKED')) {
            score += 5;
            console.log(`      ✅ Token "UNLOCKED" found (+5 points)`);
        }
        if (token === 'LOCKED' && skuTags.includes('LOCKED')) {
            score += 5;
            console.log(`      ✅ Token "LOCKED" found (+5 points)`);
        }
    }
    
    return Math.min(score, 25);
}

function findMatchedTokens(notes, skuTags) {
    if (!notes || !skuTags) return [];
    
    const matched = [];
    const upperNotes = notes.toUpperCase();
    const tokens = upperNotes.split(/[\s,.-]+/).filter(token => token.length > 2);
    
    for (const token of tokens) {
        if (skuTags.includes(token)) {
            matched.push(token);
        }
    }
    
    return matched;
}

// Run the debug
debugDeviceNotes();

