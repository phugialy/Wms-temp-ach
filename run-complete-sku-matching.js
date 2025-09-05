const CompleteSkuMatchingService = require('./src/services/CompleteSkuMatchingService');
const { Pool } = require('pg');
require('dotenv').config();

async function runCompleteSkuMatching() {
    console.log('🚀 RUNNING COMPLETE SKU MATCHING SYSTEM ON ALL DEVICES...');
    
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
        
        // Get ALL devices from sku_matching_view (not just incomplete ones)
        console.log('\n📋 Fetching ALL devices for SKU matching...');
        const devicesResult = await client.query(`
            SELECT 
                imei,
                original_sku,
                model,
                capacity,
                color,
                carrier,
                device_notes,
                data_completeness,
                sku_matched,
                match_score
            FROM sku_matching_view 
            WHERE data_completeness = 'complete'
            ORDER BY imei
        `);
        
        console.log(`📊 Found ${devicesResult.rows.length} complete devices to process`);
        
        if (devicesResult.rows.length === 0) {
            console.log('✅ No complete devices found to process!');
            await matchingService.close();
            client.release();
            await pool.end();
            return;
        }
        
        // Process each device
        console.log(`\n🔍 Processing ${devicesResult.rows.length} devices with improved matching logic...`);
        
        let processedCount = 0;
        let matchedCount = 0;
        let noMatchCount = 0;
        let improvedCount = 0;
        let sameCount = 0;
        let worseCount = 0;
        let errorCount = 0;
        let attentionRequiredCount = 0;
        
        const results = [];
        
        for (let i = 0; i < devicesResult.rows.length; i++) {
            const device = devicesResult.rows[i];
            console.log(`\n📱 Processing device ${i + 1}/${devicesResult.rows.length}: ${device.imei}`);
            console.log(`  Model: ${device.model}, Capacity: ${device.capacity}, Color: ${device.color}`);
            console.log(`  Carrier: ${device.carrier}, Notes: ${device.device_notes || 'None'}`);
            console.log(`  Current: ${device.sku_matched || 'None'} (Score: ${device.match_score || 'N/A'})`);
            
            try {
                // Prepare device data for matching
                const imeiData = {
                    model: device.model,
                    capacity: device.capacity,
                    color: device.color,
                    carrier: device.carrier,
                    postfix: null,
                    device_notes: device.device_notes
                };
                
                // Match using our improved service
                const result = await matchingService.matchImeiToSku(imeiData, {
                    filterPostfix: true,  // Filter out postfix SKUs for bulk processing
                    minScore: 70,         // Only high-quality matches
                    maxResults: 1         // Just the best match
                });
                
                const matches = result.matches;
                const requiresAttention = result.requiresAttention;
                
                let matchResult = {
                    imei: device.imei,
                    original_sku: device.original_sku,
                    matched_sku: null,
                    match_score: 0,
                    match_method: 'no_match',
                    match_status: 'no_match',
                    match_notes: 'No high-quality matches found',
                    requires_attention: requiresAttention
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
                        match_notes: `Matched: ${bestMatch.matchedCharacteristics.join(', ')}. Tiebreaker: ${bestMatch.tiebreakerDetails.join(', ')}`,
                        requires_attention: requiresAttention
                    };
                    
                    matchedCount++;
                    console.log(`  ✅ MATCHED: ${bestMatch.sku.sku_code} (Score: ${bestMatch.totalScore}/120)`);
                    console.log(`     Details: ${bestMatch.matchedCharacteristics.join(', ')}`);
                    console.log(`     Requires Attention: ${requiresAttention ? 'YES ⚠️' : 'NO ✅'}`);
                    
                    if (requiresAttention) {
                        attentionRequiredCount++;
                    }
                    
                    // Compare with current match
                    if (device.sku_matched && device.match_score) {
                        if (bestMatch.totalScore > device.match_score) {
                            improvedCount++;
                            console.log(`     📈 IMPROVEMENT: ${device.match_score} → ${bestMatch.totalScore}`);
                        } else if (bestMatch.totalScore === device.match_score) {
                            sameCount++;
                            console.log(`     ➡️  SAME: ${device.match_score} = ${bestMatch.totalScore}`);
                        } else {
                            worseCount++;
                            console.log(`     📉 WORSE: ${device.match_score} → ${bestMatch.totalScore}`);
                        }
                    } else {
                        console.log(`     🆕 NEW MATCH: No previous match found`);
                    }
                } else {
                    noMatchCount++;
                    console.log(`  ❌ NO MATCH: No high-quality matches found`);
                    console.log(`     Requires Attention: ${requiresAttention ? 'YES ⚠️' : 'NO ✅'}`);
                    
                    if (requiresAttention) {
                        attentionRequiredCount++;
                    }
                }
                
                // Update the sku_matching_results table
                await client.query(`
                    INSERT INTO sku_matching_results (
                        imei, original_sku, matched_sku, match_score, 
                        match_method, match_status, match_notes, requires_attention, processed_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                    ON CONFLICT (imei) 
                    DO UPDATE SET
                        matched_sku = EXCLUDED.matched_sku,
                        match_score = EXCLUDED.match_score,
                        match_method = EXCLUDED.match_method,
                        match_status = EXCLUDED.match_status,
                        match_notes = EXCLUDED.match_notes,
                        requires_attention = EXCLUDED.requires_attention,
                        updated_at = NOW()
                `, [
                    matchResult.imei,
                    matchResult.original_sku,
                    matchResult.matched_sku,
                    matchResult.match_score,
                    matchResult.match_method,
                    matchResult.match_status,
                    matchResult.match_notes,
                    matchResult.requires_attention
                ]);
                
                results.push(matchResult);
                processedCount++;
                
            } catch (error) {
                console.error(`  ❌ Error processing ${device.imei}:`, error.message);
                errorCount++;
                
                // Insert error result
                await client.query(`
                    INSERT INTO sku_matching_results (
                        imei, original_sku, matched_sku, match_score, 
                        match_method, match_status, match_notes, requires_attention, processed_at, updated_at
                    ) VALUES ($1, $2, NULL, 0, 'error', 'error', $3, FALSE, NOW(), NOW())
                    ON CONFLICT (imei) 
                    DO UPDATE SET
                        match_status = 'error',
                        match_notes = EXCLUDED.match_notes,
                        requires_attention = FALSE,
                        updated_at = NOW()
                `, [device.imei, device.original_sku, `Error: ${error.message}`]);
            }
        }
        
        // Show comprehensive summary
        console.log(`\n📊 COMPLETE SKU MATCHING SUMMARY:`);
        console.log(`  Total processed: ${processedCount}`);
        console.log(`  Successfully matched: ${matchedCount}`);
        console.log(`  No matches found: ${noMatchCount}`);
        console.log(`  Errors: ${errorCount}`);
        console.log(`  Success rate: ${((matchedCount / processedCount) * 100).toFixed(1)}%`);
        console.log(`  Devices requiring attention: ${attentionRequiredCount}`);
        
        if (improvedCount > 0 || sameCount > 0 || worseCount > 0) {
            console.log(`\n🔄 Comparison with Previous Matches:`);
            console.log(`  Improved: ${improvedCount}`);
            console.log(`  Same: ${sameCount}`);
            console.log(`  Worse: ${worseCount}`);
        }
        
        // Show some successful matches
        const successfulMatches = results.filter(r => r.match_status === 'matched');
        if (successfulMatches.length > 0) {
            console.log(`\n🏆 Top Successful Matches:`);
            successfulMatches.slice(0, 10).forEach((result, index) => {
                console.log(`  ${index + 1}. IMEI: ${result.imei}`);
                console.log(`     ${result.original_sku} → ${result.matched_sku} (Score: ${result.match_score}/120)`);
                console.log(`     Attention: ${result.requires_attention ? 'YES ⚠️' : 'NO ✅'}`);
            });
        }
        
        // Show attention required devices
        const attentionDevices = results.filter(r => r.requires_attention);
        if (attentionDevices.length > 0) {
            console.log(`\n⚠️  Devices Requiring Attention:`);
            attentionDevices.forEach((result, index) => {
                console.log(`  ${index + 1}. IMEI: ${result.imei}`);
                console.log(`     ${result.original_sku} → ${result.matched_sku || 'No match'} (Score: ${result.match_score}/120)`);
            });
        }
        
        // Cleanup
        await matchingService.close();
        client.release();
        await pool.end();
        
        console.log('\n✅ Complete SKU Matching system finished successfully!');
        console.log('🎯 Check your updated sku_matching_view to see all the new results!');
        console.log('💡 The improved system with attention flags is now live!');
        
    } catch (error) {
        console.error('❌ Complete matching failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the complete matching
runCompleteSkuMatching();

