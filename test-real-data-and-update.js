const CompleteSkuMatchingService = require('./src/services/CompleteSkuMatchingService');
const { Pool } = require('pg');
require('dotenv').config();

async function testRealDataAndUpdate() {
    console.log('🧪 Testing Complete SKU Matching with REAL DATA and updating results...');
    
    try {
        // Initialize the matching service
        const matchingService = new CompleteSkuMatchingService();
        await matchingService.initialize();
        
        // Get database connection for updates
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
            idleTimeoutMillis: 0,
            connectionTimeoutMillis: 30000,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Get real IMEI data from the SKU matching view (limit to 10 for testing)
        console.log('\n📋 Fetching real IMEI data from SKU matching view...');
        const imeiResult = await client.query(`
            SELECT 
                imei,
                original_sku,
                model,
                capacity,
                color,
                carrier,
                notes as device_notes,
                data_completeness,
                working_status
            FROM sku_matching_view 
            WHERE data_completeness = 'complete'
            AND working_status = 'Working'
            AND match_status IS NULL
            LIMIT 10
        `);
        
        console.log(`📊 Found ${imeiResult.rows.length} real IMEI devices to process`);
        
        if (imeiResult.rows.length === 0) {
            console.log('⚠️  No devices found. Let me check what data is available...');
            
            // Check what data we have
            const checkResult = await client.query(`
                SELECT 
                    COUNT(*) as total_devices,
                    COUNT(CASE WHEN data_completeness = 'complete' THEN 1 END) as complete_devices,
                    COUNT(CASE WHEN working_status = 'Working' THEN 1 END) as working_devices,
                    COUNT(CASE WHEN match_status IS NULL THEN 1 END) as unprocessed_devices
                FROM sku_matching_view
            `);
            
            console.log('📊 Available data:', checkResult.rows[0]);
            
            // Get some sample data regardless of status
            const sampleResult = await client.query(`
                SELECT 
                    imei,
                    original_sku,
                    model,
                    capacity,
                    color,
                    carrier,
                    notes as device_notes,
                    data_completeness,
                    working_status
                FROM sku_matching_view 
                LIMIT 5
            `);
            
            console.log(`\n📋 Sample data (${sampleResult.rows.length} devices):`);
            sampleResult.rows.forEach((row, index) => {
                console.log(`  ${index + 1}. IMEI: ${row.imei}`);
                console.log(`     Model: ${row.model}, Capacity: ${row.capacity}, Color: ${row.color}`);
                console.log     `     Carrier: ${row.carrier}, Notes: ${row.device_notes || 'None'}`);
                console.log(`     Completeness: ${row.data_completeness}, Status: ${row.working_status}`);
            });
            
            await matchingService.close();
            client.release();
            await pool.end();
            return;
        }
        
        // Process each real IMEI device
        console.log(`\n🔍 Processing ${imeiResult.rows.length} real IMEI devices...`);
        
        let processedCount = 0;
        let matchedCount = 0;
        let noMatchCount = 0;
        
        for (let i = 0; i < imeiResult.rows.length; i++) {
            const device = imeiResult.rows[i];
            console.log(`\n📱 Processing device ${i + 1}/${imeiResult.rows.length}: ${device.imei}`);
            console.log(`  Model: ${device.model}, Capacity: ${device.capacity}, Color: ${device.color}`);
            console.log(`  Carrier: ${device.carrier}, Notes: ${device.device_notes || 'None'}`);
            
            try {
                // Prepare device data for matching
                const imeiData = {
                    model: device.model,
                    capacity: device.capacity,
                    color: device.color,
                    carrier: device.carrier,
                    postfix: null, // Will be extracted from device_notes if present
                    device_notes: device.device_notes
                };
                
                // Match using our service
                const matches = await matchingService.matchImeiToSku(imeiData, {
                    filterPostfix: true,  // Filter out postfix SKUs for bulk processing
                    minScore: 70,         // Only high-quality matches
                    maxResults: 1         // Just the best match
                });
                
                let matchResult = {
                    imei: device.imei,
                    original_sku: device.original_sku,
                    matched_sku: null,
                    match_score: 0,
                    match_method: 'no_match',
                    match_status: 'no_match',
                    match_notes: 'No high-quality matches found'
                };
                
                if (matches.length > 0) {
                    const bestMatch = matches[0];
                    matchResult = {
                        imei: device.imei,
                        original_sku: device.original_sku,
                        matched_sku: bestMatch.sku.sku_code,
                        match_score: bestMatch.totalScore,
                        match_method: bestMatch.method,
                        match_status: 'matched',
                        match_notes: `Matched: ${bestMatch.matchedCharacteristics.join(', ')}. Tiebreaker: ${bestMatch.tiebreakerDetails.join(', ')}`
                    };
                    
                    matchedCount++;
                    console.log(`  ✅ MATCHED: ${bestMatch.sku.sku_code} (Score: ${bestMatch.totalScore}/120)`);
                    console.log(`     Details: ${bestMatch.matchedCharacteristics.join(', ')}`);
                } else {
                    noMatchCount++;
                    console.log(`  ❌ NO MATCH: No high-quality matches found`);
                }
                
                // Insert/update the result in sku_matching_results table
                await client.query(`
                    INSERT INTO sku_matching_results (
                        imei, original_sku, matched_sku, match_score, 
                        match_method, match_status, match_notes, processed_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                    ON CONFLICT (imei) 
                    DO UPDATE SET
                        matched_sku = EXCLUDED.matched_sku,
                        match_score = EXCLUDED.match_score,
                        match_method = EXCLUDED.match_method,
                        match_status = EXCLUDED.match_status,
                        match_notes = EXCLUDED.match_notes,
                        updated_at = NOW()
                `, [
                    matchResult.imei,
                    matchResult.original_sku,
                    matchResult.matched_sku,
                    matchResult.match_score,
                    matchResult.match_method,
                    matchResult.match_status,
                    matchResult.match_notes
                ]);
                
                processedCount++;
                
            } catch (error) {
                console.error(`  ❌ Error processing ${device.imei}:`, error.message);
                
                // Insert error result
                await client.query(`
                    INSERT INTO sku_matching_results (
                        imei, original_sku, matched_sku, match_score, 
                        match_method, match_status, match_notes, processed_at, updated_at
                    ) VALUES ($1, $2, NULL, 0, 'error', 'error', $3, NOW(), NOW())
                    ON CONFLICT (imei) 
                    DO UPDATE SET
                        match_status = 'error',
                        match_notes = EXCLUDED.match_notes,
                        updated_at = NOW()
                `, [device.imei, device.original_sku, `Error: ${error.message}`]);
            }
        }
        
        // Show summary
        console.log(`\n📊 Processing Summary:`);
        console.log(`  Total processed: ${processedCount}`);
        console.log(`  Matched: ${matchedCount}`);
        console.log(`  No match: ${noMatchCount}`);
        console.log(`  Success rate: ${((matchedCount / processedCount) * 100).toFixed(1)}%`);
        
        // Show updated results from the view
        console.log(`\n🔍 Updated SKU Matching View Results:`);
        const viewResult = await client.query(`
            SELECT 
                imei,
                original_sku,
                sku_matched,
                match_score,
                match_method,
                match_status,
                model,
                capacity,
                color,
                carrier
            FROM sku_matching_view 
            WHERE imei IN (${imeiResult.rows.map((_, i) => `$${i + 1}`).join(', ')})
            ORDER BY match_score DESC NULLS LAST
        `, imeiResult.rows.map(row => row.imei));
        
        viewResult.rows.forEach((row, index) => {
            console.log(`\n  ${index + 1}. IMEI: ${row.imei}`);
            console.log(`     Original: ${row.original_sku} → Matched: ${row.sku_matched || 'None'}`);
            console.log(`     Score: ${row.match_score || 0}/120, Method: ${row.match_method}, Status: ${row.match_status}`);
            console.log(`     Device: ${row.model} ${row.capacity} ${row.color} ${row.carrier}`);
        });
        
        // Cleanup
        await matchingService.close();
        client.release();
        await pool.end();
        
        console.log('\n✅ Real data testing and update completed!');
        console.log('🎯 Check your SKU matching view to see the updated results!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the real data test
testRealDataAndUpdate();

