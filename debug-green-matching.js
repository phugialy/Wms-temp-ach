const CompleteSkuMatchingService = require('./src/services/CompleteSkuMatchingService');
const { Pool } = require('pg');
require('dotenv').config();

async function debugGreenMatching() {
    console.log('🔍 Debugging GREEN color matching issue...');
    
    try {
        // Initialize the matching service
        const matchingService = new CompleteSkuMatchingService();
        await matchingService.initialize();
        
        // Get database connection
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
            idleTimeoutMillis: 0,
            connectionTimeoutMillis: 30000,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Test the specific problematic device
        const testDevice = {
            model: 'Galaxy Z Fold3 Duos',
            capacity: '256GB',
            color: 'Phantom Green',
            carrier: 'Unlocked',
            postfix: null,
            device_notes: null
        };
        
        console.log('\n📱 Testing device:');
        console.log(`  Model: ${testDevice.model}`);
        console.log(`  Capacity: ${testDevice.capacity}`);
        console.log(`  Color: ${testDevice.color}`);
        console.log(`  Carrier: ${testDevice.carrier}`);
        
        // Step 1: Check what SKUs exist with GREEN
        console.log('\n🔍 Step 1: Checking SKUs with GREEN...');
        const greenSkus = await client.query(`
            SELECT sku_code, sku_tags
            FROM sku_master 
            WHERE sku_tags IS NOT NULL 
            AND array_length(sku_tags, 1) > 0
            AND 'GREEN' = ANY(sku_tags)
            ORDER BY sku_code
        `);
        
        console.log(`📋 Found ${greenSkus.rows.length} SKUs with GREEN tag:`);
        greenSkus.rows.forEach(sku => {
            console.log(`  • ${sku.sku_code} → Tags: [${sku.sku_tags.join(', ')}]`);
        });
        
        // Step 2: Check what SKUs exist with GRN
        console.log('\n🔍 Step 2: Checking SKUs with GRN...');
        const grnSkus = await client.query(`
            SELECT sku_code, sku_tags
            FROM sku_master 
            WHERE sku_tags IS NOT NULL 
            AND array_length(sku_tags, 1) > 0
            AND 'GRN' = ANY(sku_tags)
            ORDER BY sku_code
        `);
        
        console.log(`📋 Found ${grnSkus.rows.length} SKUs with GRN tag:`);
        grnSkus.rows.forEach(sku => {
            console.log(`  • ${sku.sku_code} → Tags: [${sku.sku_tags.join(', ')}]`);
        });
        
        // Step 3: Check FOLD3 SKUs specifically
        console.log('\n🔍 Step 3: Checking FOLD3 SKUs...');
        const fold3Skus = await client.query(`
            SELECT sku_code, sku_tags
            FROM sku_master 
            WHERE sku_tags IS NOT NULL 
            AND array_length(sku_tags, 1) > 0
            AND 'FOLD3' = ANY(sku_tags)
            ORDER BY sku_code
        `);
        
        console.log(`📋 Found ${fold3Skus.rows.length} FOLD3 SKUs:`);
        fold3Skus.rows.slice(0, 10).forEach(sku => {
            console.log(`  • ${sku.sku_code} → Tags: [${sku.sku_tags.join(', ')}]`);
        });
        
        // Step 4: Test our normalization
        console.log('\n🔍 Step 4: Testing color normalization...');
        const normalizedColor = matchingService.normalizeColor('Phantom Green');
        console.log(`  "Phantom Green" → "${normalizedColor}"`);
        
        // Step 5: Test the matching with different options
        console.log('\n🔍 Step 5: Testing matching with different options...');
        
        // Test with filterPostfix=false (include all SKUs)
        console.log('\n  📋 Testing with filterPostfix=false (include all SKUs):');
        const matchesAll = await matchingService.matchImeiToSku(testDevice, {
            filterPostfix: false,
            minScore: 50,  // Lower threshold
            maxResults: 5
        });
        
        console.log(`    Found ${matchesAll.length} matches:`);
        matchesAll.forEach((match, index) => {
            console.log(`    ${index + 1}. ${match.sku.sku_code} (Score: ${match.totalScore}/120)`);
            console.log(`       Tags: [${match.sku.sku_tags.join(', ')}]`);
            console.log(`       Matched: ${match.matchedCharacteristics.join(', ')}`);
        });
        
        // Test with filterPostfix=true (current setting)
        console.log('\n  📋 Testing with filterPostfix=true (filter postfix SKUs):');
        const matchesFiltered = await matchingService.matchImeiToSku(testDevice, {
            filterPostfix: true,
            minScore: 50,  // Lower threshold
            maxResults: 5
        });
        
        console.log(`    Found ${matchesFiltered.length} matches:`);
        matchesFiltered.forEach((match, index) => {
            console.log(`    ${index + 1}. ${match.sku.sku_code} (Score: ${match.totalScore}/120)`);
            console.log(`       Tags: [${match.sku.sku_tags.join(', ')}]`);
            console.log(`       Matched: ${match.matchedCharacteristics.join(', ')}`);
        });
        
        // Step 6: Check if FOLD3-256-GREEN exists
        console.log('\n🔍 Step 6: Checking if FOLD3-256-GREEN exists...');
        const specificSku = await client.query(`
            SELECT sku_code, sku_tags
            FROM sku_master 
            WHERE sku_code = 'FOLD3-256-GREEN'
        `);
        
        if (specificSku.rows.length > 0) {
            console.log(`  ✅ FOUND: ${specificSku.rows[0].sku_code}`);
            console.log(`     Tags: [${specificSku.rows[0].sku_tags.join(', ')}]`);
            
            // Test why it's not matching
            console.log('\n  🔍 Testing why FOLD3-256-GREEN is not matching...');
            const testMatch = matchingService.calculateMatchScore(testDevice, specificSku.rows[0].sku_tags);
            console.log(`     Match result:`, testMatch);
        } else {
            console.log(`  ❌ NOT FOUND: FOLD3-256-GREEN does not exist in database`);
        }
        
        // Cleanup
        await matchingService.close();
        client.release();
        await pool.end();
        
        console.log('\n✅ Green matching debug completed!');
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the debug
debugGreenMatching();

