const CompleteSkuMatchingService = require('./src/services/CompleteSkuMatchingService');
const { Pool } = require('pg');
require('dotenv').config();

async function debugCarrierLockedIssue() {
    console.log('🔍 DEBUGGING CARRIER LOCKED ISSUE...');
    
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
        
        // Test the specific IMEI with capacity mismatch
        console.log('\n📱 Testing IMEI 356317536612128 (512GB → 256GB issue):');
        const specificImei = await client.query(`
            SELECT 
                imei,
                original_sku,
                model,
                capacity,
                color,
                carrier,
                device_notes,
                sku_matched,
                match_score
            FROM sku_matching_view 
            WHERE imei = '356317536612128'
        `);
        
        if (specificImei.rows.length > 0) {
            const device = specificImei.rows[0];
            console.log(`  Device: ${device.model}, ${device.capacity}, ${device.color}`);
            console.log(`  Carrier: ${device.carrier}, Notes: ${device.device_notes || 'None'}`);
            console.log(`  Current Match: ${device.sku_matched} (Score: ${device.match_score})`);
            
            // Test current matching logic
            const imeiData = {
                model: device.model,
                capacity: device.capacity,
                color: device.color,
                carrier: device.carrier,
                postfix: null,
                device_notes: device.device_notes
            };
            
            console.log('\n🔍 Current matching logic:');
            const matches = await matchingService.matchImeiToSku(imeiData, {
                filterPostfix: true,
                minScore: 70,
                maxResults: 5
            });
            
            console.log(`  Found ${matches.length} matches:`);
            matches.forEach((match, index) => {
                console.log(`    ${index + 1}. ${match.sku.sku_code} (Score: ${match.totalScore}/120)`);
                console.log(`       Details: ${match.matchedCharacteristics.join(', ')}`);
                console.log(`       Carrier: ${match.sku.carrier || 'None'}`);
            });
        }
        
        // Test CARRIER LOCKED devices
        console.log('\n🔒 Testing CARRIER LOCKED devices:');
        const lockedDevices = await client.query(`
            SELECT 
                imei,
                original_sku,
                model,
                capacity,
                color,
                carrier,
                device_notes,
                sku_matched,
                match_score
            FROM sku_matching_view 
            WHERE device_notes ILIKE '%CARRIER LOCK%'
            LIMIT 3
        `);
        
        console.log(`Found ${lockedDevices.rows.length} CARRIER LOCKED devices`);
        
        for (const device of lockedDevices.rows) {
            console.log(`\n📱 Device: ${device.imei}`);
            console.log(`  Model: ${device.model}, Capacity: ${device.capacity}, Color: ${device.color}`);
            console.log(`  Carrier: ${device.carrier}, Notes: ${device.device_notes}`);
            console.log(`  Current Match: ${device.sku_matched} (Score: ${device.match_score})`);
            
            // Test current matching logic
            const imeiData = {
                model: device.model,
                capacity: device.capacity,
                color: device.color,
                carrier: device.carrier,
                postfix: null,
                device_notes: device.device_notes
            };
            
            console.log('\n🔍 Current matching logic:');
            const matches = await matchingService.matchImeiToSku(imeiData, {
                filterPostfix: true,
                minScore: 70,
                maxResults: 5
            });
            
            console.log(`  Found ${matches.length} matches:`);
            matches.forEach((match, index) => {
                console.log(`    ${index + 1}. ${match.sku.sku_code} (Score: ${match.totalScore}/120)`);
                console.log(`       Details: ${match.matchedCharacteristics.join(', ')}`);
                console.log(`       Carrier: ${match.sku.carrier || 'None'}`);
            });
            
            // Check what SKUs are available with carrier tags
            console.log('\n🔍 Available SKUs with carrier tags:');
            const carrierSkus = await client.query(`
                SELECT sku_code, carrier, sku_tags
                FROM sku_master 
                WHERE sku_tags @> ARRAY[$1] 
                AND sku_tags @> ARRAY[$2]
                AND sku_tags @> ARRAY[$3]
                AND carrier IS NOT NULL
                ORDER BY sku_code
            `, [
                matchingService.normalizeModel(device.model),
                matchingService.normalizeCapacity(device.capacity),
                matchingService.normalizeColor(device.color)
            ]);
            
            console.log(`  Found ${carrierSkus.rows.length} SKUs with carrier tags:`);
            carrierSkus.rows.forEach(sku => {
                console.log(`    - ${sku.sku_code} (Carrier: ${sku.carrier})`);
            });
        }
        
        // Cleanup
        await matchingService.close();
        client.release();
        await pool.end();
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the debug
debugCarrierLockedIssue();

