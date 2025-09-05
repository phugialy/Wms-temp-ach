const SkuMatchingAgent = require('./src/services/SkuMatchingAgent');
require('dotenv').config();

async function testSkuMatchingAgent() {
    const agent = new SkuMatchingAgent({
        batchSize: 5,
        pollingInterval: 2000,
        maxRetries: 2
    });

    try {
        console.log('🚀 Testing SkuMatchingAgent...');
        
        // Initialize the agent
        await agent.initialize();
        console.log('✅ Agent initialized successfully');
        
        // Get current queue status
        console.log('📊 Current queue status:');
        const pendingEntries = await agent.getPendingQueueEntries(10);
        console.log(`  - Pending entries: ${pendingEntries.length}`);
        
        if (pendingEntries.length > 0) {
            console.log('📋 Pending entries:');
            pendingEntries.forEach((entry, index) => {
                console.log(`  ${index + 1}. IMEI: ${entry.imei}, Priority: ${entry.priority}, Source: ${entry.source_reference}`);
            });
        }
        
        // Process a single batch
        console.log('🔄 Processing a single batch...');
        const batchResult = await agent.processBatch();
        
        console.log('📈 Batch processing results:');
        console.log(`  - Processed: ${batchResult.processed}`);
        console.log(`  - Errors: ${batchResult.errors}`);
        
        if (batchResult.results && batchResult.results.length > 0) {
            console.log('📋 Individual results:');
            batchResult.results.forEach((result, index) => {
                if (result.success) {
                    console.log(`  ${index + 1}. ✅ IMEI: ${result.imei} → SKU: ${result.matchedSku} (Score: ${result.matchScore})`);
                } else {
                    console.log(`  ${index + 1}. ❌ IMEI: ${result.imei} → Error: ${result.error}`);
                }
            });
        }
        
        // Get agent statistics
        const stats = agent.getStats();
        console.log('📊 Agent statistics:');
        console.log(`  - Total processed: ${stats.totalProcessed}`);
        console.log(`  - Total errors: ${stats.totalErrors}`);
        console.log(`  - Uptime: ${stats.uptimeFormatted}`);
        console.log(`  - Is running: ${stats.isRunning}`);
        
        // Test queue status after processing
        console.log('📊 Queue status after processing:');
        const updatedPendingEntries = await agent.getPendingQueueEntries(10);
        console.log(`  - Remaining pending entries: ${updatedPendingEntries.length}`);
        
        // Show completed entries
        const completedQuery = `
            SELECT 
                imei,
                source_reference,
                processing_attempts,
                processing_completed_at
            FROM sku_matching_queue 
            WHERE status = 'completed'
            ORDER BY processing_completed_at DESC
            LIMIT 5
        `;
        
        const completedResult = await agent.client.query(completedQuery);
        if (completedResult.rows.length > 0) {
            console.log('✅ Recently completed entries:');
            completedResult.rows.forEach((row, index) => {
                console.log(`  ${index + 1}. IMEI: ${row.imei}, Source: ${row.source_reference}, Attempts: ${row.processing_attempts}`);
            });
        }
        
        console.log('🎉 SkuMatchingAgent test completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        throw error;
    } finally {
        await agent.cleanup();
    }
}

// Run the test
testSkuMatchingAgent()
    .then(() => {
        console.log('🎉 Phase 1C completed successfully!');
        console.log('📋 Next: Phase 1D - Manual Override Tools');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Phase 1C failed:', error.message);
        process.exit(1);
    });

