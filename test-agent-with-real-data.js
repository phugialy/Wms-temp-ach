const { Client } = require('pg');
const SkuMatchingAgent = require('./src/services/SkuMatchingAgent');
require('dotenv').config();

async function testAgentWithRealData() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        
        // Add a real IMEI to the queue
        const realImei = '352707358605214'; // Galaxy Z Fold3 Duos, 512GB, Phantom Black, T-Mobile, CARRIER UNLOCKED
        
        console.log(`📝 Adding real IMEI ${realImei} to queue...`);
        await client.query(`
            INSERT INTO sku_matching_queue (imei, status, priority, source, source_reference)
            VALUES ($1, 'pending', 1, 'manual', 'test_real_data')
            ON CONFLICT (imei, status) DO UPDATE SET
                priority = LEAST(sku_matching_queue.priority, EXCLUDED.priority),
                updated_at = NOW()
            WHERE sku_matching_queue.status = 'pending'
        `, [realImei]);
        
        console.log('✅ Real IMEI added to queue');
        
        // Now test the agent
        const agent = new SkuMatchingAgent({
            batchSize: 1,
            pollingInterval: 1000,
            maxRetries: 1
        });

        console.log('🚀 Testing SkuMatchingAgent with real data...');
        await agent.initialize();
        
        // Process the queue
        const batchResult = await agent.processBatch();
        
        console.log('📈 Batch processing results:');
        console.log(`  - Processed: ${batchResult.processed}`);
        console.log(`  - Errors: ${batchResult.errors}`);
        
        if (batchResult.results && batchResult.results.length > 0) {
            console.log('📋 Results:');
            batchResult.results.forEach((result, index) => {
                if (result.success) {
                    console.log(`  ${index + 1}. ✅ IMEI: ${result.imei}`);
                    console.log(`     → Matched SKU: ${result.matchedSku}`);
                    console.log(`     → Match Score: ${result.matchScore}`);
                    console.log(`     → Requires Attention: ${result.requiresAttention}`);
                } else {
                    console.log(`  ${index + 1}. ❌ IMEI: ${result.imei}`);
                    console.log(`     → Error: ${result.error}`);
                }
            });
        }
        
        // Check the queue status
        const queueResult = await client.query(`
            SELECT status, COUNT(*) as count
            FROM sku_matching_queue
            GROUP BY status
        `);
        
        console.log('📊 Queue status after processing:');
        queueResult.rows.forEach(row => {
            console.log(`  - ${row.status}: ${row.count} entries`);
        });
        
        // Check if the result was saved to sku_matching_results
        const resultsQuery = await client.query(`
            SELECT imei, matched_sku, match_score, match_status, requires_attention
            FROM sku_matching_results
            WHERE imei = $1
        `, [realImei]);
        
        if (resultsQuery.rows.length > 0) {
            const result = resultsQuery.rows[0];
            console.log('✅ Result saved to sku_matching_results:');
            console.log(`  - IMEI: ${result.imei}`);
            console.log(`  - Matched SKU: ${result.matched_sku}`);
            console.log(`  - Match Score: ${result.match_score}`);
            console.log(`  - Match Status: ${result.match_status}`);
            console.log(`  - Requires Attention: ${result.requires_attention}`);
        } else {
            console.log('❌ No result found in sku_matching_results');
        }
        
        await agent.cleanup();
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}

// Run the test
testAgentWithRealData()
    .then(() => {
        console.log('🎉 Agent test with real data completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Test failed:', error.message);
        process.exit(1);
    });

