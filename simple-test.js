const { Pool } = require('pg');
require('dotenv').config();

async function simpleTest() {
    console.log('🧪 Simple Test of SKU Matching Logic...');
    
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
        
        // Get SKUs with tags
        const result = await client.query(`
            SELECT id, sku_code, sku_tags
            FROM sku_master 
            WHERE sku_tags IS NOT NULL AND array_length(sku_tags, 1) > 0
            ORDER BY id 
            LIMIT 10
        `);
        
        console.log(`📋 Found ${result.rows.length} SKUs to test against`);
        
        // Simple matching logic
        const matches = [];
        
        for (const sku of result.rows) {
            let score = 0;
            let matchedCharacteristics = [];
            
            // Check model
            if (testDevice.model && sku.sku_tags.includes(testDevice.model)) {
                score += 30;
                matchedCharacteristics.push(`MODEL: ${testDevice.model}`);
            }
            
            // Check capacity
            if (testDevice.capacity && sku.sku_tags.includes(testDevice.capacity)) {
                score += 25;
                matchedCharacteristics.push(`CAPACITY: ${testDevice.capacity}`);
            }
            
            // Check color
            if (testDevice.color && sku.sku_tags.includes(testDevice.color)) {
                score += 20;
                matchedCharacteristics.push(`COLOR: ${testDevice.color}`);
            }
            
            // Check carrier
            if (testDevice.carrier && sku.sku_tags.includes(testDevice.carrier)) {
                score += 15;
                matchedCharacteristics.push(`CARRIER: ${testDevice.carrier}`);
            }
            
            if (score > 0) {
                matches.push({
                    sku: sku.sku_code,
                    score,
                    matchedCharacteristics
                });
            }
        }
        
        // Sort by score
        matches.sort((a, b) => b.score - a.score);
        
        console.log(`\n📊 Found ${matches.length} matches:`);
        matches.forEach((match, index) => {
            console.log(`  ${index + 1}. SKU: ${match.sku} | Score: ${match.score}/100`);
            console.log(`     Matched: ${match.matchedCharacteristics.join(', ')}`);
        });
        
        client.release();
        await pool.end();
        
        console.log('\n✅ Simple test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
simpleTest();
