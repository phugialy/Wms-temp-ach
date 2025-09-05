const CompleteSkuMatchingService = require('./src/services/CompleteSkuMatchingService');
const { Pool } = require('pg');
require('dotenv').config();

async function testRealDataSafe() {
    console.log('🧪 Testing Complete SKU Matching with REAL DATA (SAFE MODE - NO DATABASE UPDATES)...');
    
    try {
        // Initialize the matching service
        const matchingService = new CompleteSkuMatchingService();
        await matchingService.initialize();
        
        // Get database connection for READ-ONLY operations
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
            idleTimeoutMillis: 0,
            connectionTimeoutMillis: 30000,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database (READ-ONLY mode)');
        
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
                device_notes,
                data_completeness,
                match_status,
                sku_matched,
                match_score
            FROM sku_matching_view 
            WHERE data_completeness = 'complete'
            LIMIT 10
        `);
        
        console.log(`📊 Found ${imeiResult.rows.length} real IMEI devices to analyze`);
        
        if (imeiResult.rows.length === 0) {
            console.log('⚠️  No complete working devices found. Let me check what data is available...');
            
            // Check what data we have
            const checkResult = await client.query(`
                SELECT 
                    COUNT(*) as total_devices,
                    COUNT(CASE WHEN data_completeness = 'complete' THEN 1 END) as complete_devices,
                    COUNT(CASE WHEN match_status IS NULL THEN 1 END) as unprocessed_devices,
                    COUNT(CASE WHEN match_status = 'matched' THEN 1 END) as already_matched
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
                    device_notes,
                    data_completeness,
                    match_status,
                    sku_matched,
                    match_score
                FROM sku_matching_view 
                LIMIT 5
            `);
            
            console.log(`\n📋 Sample data (${sampleResult.rows.length} devices):`);
            sampleResult.rows.forEach((row, index) => {
                console.log(`  ${index + 1}. IMEI: ${row.imei}`);
                console.log(`     Model: ${row.model}, Capacity: ${row.capacity}, Color: ${row.color}`);
                console.log(`     Carrier: ${row.carrier}, Notes: ${row.device_notes || 'None'}`);
                console.log(`     Completeness: ${row.data_completeness}`);
                console.log(`     Current Match: ${row.sku_matched || 'None'} (Score: ${row.match_score || 'N/A'})`);
            });
            
            await matchingService.close();
            client.release();
            await pool.end();
            return;
        }
        
        // Process each real IMEI device (READ-ONLY)
        console.log(`\n🔍 Analyzing ${imeiResult.rows.length} real IMEI devices with our new matching logic...`);
        
        let processedCount = 0;
        let matchedCount = 0;
        let noMatchCount = 0;
        let improvedCount = 0;
        let sameCount = 0;
        let worseCount = 0;
        
        const results = [];
        
        for (let i = 0; i < imeiResult.rows.length; i++) {
            const device = imeiResult.rows[i];
            console.log(`\n📱 Analyzing device ${i + 1}/${imeiResult.rows.length}: ${device.imei}`);
            console.log(`  Model: ${device.model}, Capacity: ${device.capacity}, Color: ${device.color}`);
            console.log(`  Carrier: ${device.carrier}, Notes: ${device.device_notes || 'None'}`);
            console.log(`  Current Match: ${device.sku_matched || 'None'} (Score: ${device.match_score || 'N/A'})`);
            
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
                
                // Match using our NEW service
                const matches = await matchingService.matchImeiToSku(imeiData, {
                    filterPostfix: true,  // Filter out postfix SKUs for bulk processing
                    minScore: 70,         // Only high-quality matches
                    maxResults: 3         // Show top 3 matches
                });
                
                const result = {
                    imei: device.imei,
                    original_sku: device.original_sku,
                    current_match: device.sku_matched,
                    current_score: device.match_score,
                    new_matches: matches,
                    analysis: 'no_match'
                };
                
                if (matches.length > 0) {
                    const bestMatch = matches[0];
                    result.new_best_match = bestMatch.sku.sku_code;
                    result.new_best_score = bestMatch.totalScore;
                    result.analysis = 'matched';
                    
                    matchedCount++;
                    console.log(`  ✅ NEW MATCH: ${bestMatch.sku.sku_code} (Score: ${bestMatch.totalScore}/120)`);
                    console.log(`     Details: ${bestMatch.matchedCharacteristics.join(', ')}`);
                    
                    // Compare with current match
                    if (device.sku_matched) {
                        if (bestMatch.totalScore > (device.match_score || 0)) {
                            improvedCount++;
                            result.analysis = 'improved';
                            console.log(`     📈 IMPROVEMENT: ${device.match_score || 0} → ${bestMatch.totalScore}`);
                        } else if (bestMatch.totalScore === (device.match_score || 0)) {
                            sameCount++;
                            result.analysis = 'same';
                            console.log(`     ➡️  SAME: ${device.match_score || 0} = ${bestMatch.totalScore}`);
                        } else {
                            worseCount++;
                            result.analysis = 'worse';
                            console.log(`     📉 WORSE: ${device.match_score || 0} → ${bestMatch.totalScore}`);
                        }
                    } else {
                        result.analysis = 'new_match';
                        console.log(`     🆕 NEW MATCH: No previous match found`);
                    }
                    
                    // Show additional matches
                    if (matches.length > 1) {
                        console.log(`     📋 Alternative matches:`);
                        matches.slice(1).forEach((match, index) => {
                            console.log(`       ${index + 2}. ${match.sku.sku_code} (Score: ${match.totalScore}/120)`);
                        });
                    }
                } else {
                    noMatchCount++;
                    result.analysis = 'no_match';
                    console.log(`  ❌ NO MATCH: No high-quality matches found`);
                }
                
                results.push(result);
                processedCount++;
                
            } catch (error) {
                console.error(`  ❌ Error analyzing ${device.imei}:`, error.message);
                results.push({
                    imei: device.imei,
                    original_sku: device.original_sku,
                    current_match: device.sku_matched,
                    current_score: device.match_score,
                    error: error.message,
                    analysis: 'error'
                });
            }
        }
        
        // Show comprehensive summary
        console.log(`\n📊 Analysis Summary:`);
        console.log(`  Total analyzed: ${processedCount}`);
        console.log(`  New matches found: ${matchedCount}`);
        console.log(`  No matches: ${noMatchCount}`);
        console.log(`  Success rate: ${((matchedCount / processedCount) * 100).toFixed(1)}%`);
        
        if (improvedCount > 0 || sameCount > 0 || worseCount > 0) {
            console.log(`\n🔄 Comparison with Current Matches:`);
            console.log(`  Improved: ${improvedCount}`);
            console.log(`  Same: ${sameCount}`);
            console.log(`  Worse: ${worseCount}`);
        }
        
        // Show detailed results
        console.log(`\n📋 Detailed Results:`);
        results.forEach((result, index) => {
            console.log(`\n  ${index + 1}. IMEI: ${result.imei}`);
            console.log(`     Current: ${result.current_match || 'None'} (${result.current_score || 'N/A'})`);
            if (result.new_best_match) {
                console.log(`     New Best: ${result.new_best_match} (${result.new_best_score}/120)`);
                console.log(`     Analysis: ${result.analysis.toUpperCase()}`);
            } else {
                console.log(`     Analysis: ${result.analysis.toUpperCase()}`);
            }
        });
        
        // Cleanup
        await matchingService.close();
        client.release();
        await pool.end();
        
        console.log('\n✅ Safe real data analysis completed!');
        console.log('🎯 This analysis shows how our new matching logic would perform without affecting your running system.');
        console.log('💡 If results look good, we can discuss a safe deployment strategy.');
        
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the safe real data analysis
testRealDataSafe();
