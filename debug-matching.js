const { Pool } = require('pg');
require('dotenv').config();

async function debugMatching() {
    console.log('🔍 Debugging SKU Matching Logic...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Test device characteristics
        const testDevice = {
            model: 'FOLD3',
            capacity: '256GB',
            color: 'GREEN',
            carrier: 'T-MOBILE'
        };
        
        console.log(`🔍 Testing device: ${JSON.stringify(testDevice)}`);
        
        // Get SKUs with tags and show what we're working with
        const result = await client.query(`
            SELECT id, sku_code, sku_tags
            FROM sku_master 
            WHERE sku_tags IS NOT NULL AND array_length(sku_tags, 1) > 0
            ORDER BY id 
            LIMIT 20
        `);
        
        console.log(`📋 Found ${result.rows.length} SKUs to test against`);
        
        // Show first few SKUs and their tags
        console.log('\n📋 Sample SKUs and their tags:');
        result.rows.slice(0, 5).forEach((sku, index) => {
            console.log(`  ${index + 1}. SKU: ${sku.sku_code}`);
            console.log(`     Tags: [${sku.sku_tags.join(', ')}]`);
            console.log('');
        });
        
        // Test matching logic step by step
        console.log('\n🔍 Testing matching logic step by step:');
        
        for (const sku of result.rows.slice(0, 5)) {
            console.log(`\n📱 Testing against SKU: ${sku.sku_code}`);
            console.log(`   Tags: [${sku.sku_tags.join(', ')}]`);
            
            let score = 0;
            let matchedCharacteristics = [];
            
            // Check model
            if (testDevice.model && sku.sku_tags.includes(testDevice.model)) {
                score += 30;
                matchedCharacteristics.push(`MODEL: ${testDevice.model}`);
                console.log(`   ✅ MODEL match: ${testDevice.model}`);
            } else {
                console.log(`   ❌ MODEL no match: ${testDevice.model} not found in tags`);
            }
            
            // Check capacity
            if (testDevice.capacity && sku.sku_tags.includes(testDevice.capacity)) {
                score += 25;
                matchedCharacteristics.push(`CAPACITY: ${testDevice.capacity}`);
                console.log(`   ✅ CAPACITY match: ${testDevice.capacity}`);
            } else {
                console.log(`   ❌ CAPACITY no match: ${testDevice.capacity} not found in tags`);
            }
            
            // Check color
            if (testDevice.color && sku.sku_tags.includes(testDevice.color)) {
                score += 20;
                matchedCharacteristics.push(`COLOR: ${testDevice.color}`);
                console.log(`   ✅ COLOR match: ${testDevice.color}`);
            } else {
                console.log(`   ❌ COLOR no match: ${testDevice.color} not found in tags`);
            }
            
            // Check carrier
            if (testDevice.carrier && sku.sku_tags.includes(testDevice.carrier)) {
                score += 15;
                matchedCharacteristics.push(`CARRIER: ${testDevice.carrier}`);
                console.log(`   ✅ CARRIER match: ${testDevice.carrier}`);
            } else {
                console.log(`   ❌ CARRIER no match: ${testDevice.carrier} not found in tags`);
            }
            
            console.log(`   📊 Final Score: ${score}/100`);
            if (score > 0) {
                console.log(`   🎯 Matched: ${matchedCharacteristics.join(', ')}`);
            }
        }
        
        // Look for specific patterns
        console.log('\n🔍 Looking for specific patterns:');
        
        // Look for FOLD3
        const fold3Result = await client.query(`
            SELECT id, sku_code, sku_tags
            FROM sku_master 
            WHERE sku_tags IS NOT NULL 
            AND 'FOLD3' = ANY(sku_tags)
            LIMIT 5
        `);
        
        if (fold3Result.rows.length > 0) {
            console.log(`✅ Found ${fold3Result.rows.length} SKUs with FOLD3 tag:`);
            fold3Result.rows.forEach((sku, index) => {
                console.log(`  ${index + 1}. ${sku.sku_code} - Tags: [${sku.sku_tags.join(', ')}]`);
            });
        } else {
            console.log('❌ No SKUs found with FOLD3 tag');
        }
        
        // Look for GREEN
        const greenResult = await client.query(`
            SELECT id, sku_code, sku_tags
            FROM sku_master 
            WHERE sku_tags IS NOT NULL 
            AND 'GREEN' = ANY(sku_tags)
            LIMIT 5
        `);
        
        if (greenResult.rows.length > 0) {
            console.log(`✅ Found ${greenResult.rows.length} SKUs with GREEN tag:`);
            greenResult.rows.forEach((sku, index) => {
                console.log(`  ${index + 1}. ${sku.sku_code} - Tags: [${sku.sku_tags.join(', ')}]`);
            });
        } else {
            console.log('❌ No SKUs found with GREEN tag');
        }
        
        // Look for 256
        const capacityResult = await client.query(`
            SELECT id, sku_code, sku_tags
            FROM sku_master 
            WHERE sku_tags IS NOT NULL 
            AND '256' = ANY(sku_tags)
            LIMIT 5
        `);
        
        if (capacityResult.rows.length > 0) {
            console.log(`✅ Found ${capacityResult.rows.length} SKUs with 256 tag:`);
            capacityResult.rows.forEach((sku, index) => {
                console.log(`  ${index + 1}. ${sku.sku_code} - Tags: [${sku.sku_tags.join(', ')}]`);
            });
        } else {
            console.log('❌ No SKUs found with 256 tag');
        }
        
        client.release();
        await pool.end();
        
        console.log('\n✅ Debug completed!');
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

// Run the debug
debugMatching();

