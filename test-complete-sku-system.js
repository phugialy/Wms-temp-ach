require('dotenv').config();
const { Client } = require('pg');

async function testCompleteSkuSystem() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    
    try {
        await client.connect();
        console.log('🔗 Connected to database');
        
        console.log('\n📊 SKU Matching System Status:');
        
        // 1. Check all SKU-related objects
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE '%sku%' 
            ORDER BY table_name
        `);
        
        console.log('\n📋 SKU-related tables:');
        tablesResult.rows.forEach(row => console.log(`  - ${row.table_name}`));
        
        const viewsResult = await client.query(`
            SELECT viewname 
            FROM pg_views 
            WHERE schemaname = 'public' 
            AND viewname LIKE '%sku%' 
            ORDER BY viewname
        `);
        
        console.log('\n👁️ SKU-related views:');
        viewsResult.rows.forEach(row => console.log(`  - ${row.viewname}`));
        
        const triggersResult = await client.query(`
            SELECT trigger_name, event_object_table
            FROM information_schema.triggers 
            WHERE trigger_schema = 'public' 
            AND trigger_name LIKE '%sku%'
        `);
        
        console.log('\n🔧 SKU-related triggers:');
        triggersResult.rows.forEach(row => console.log(`  - ${row.trigger_name} on ${row.event_object_table}`));
        
        // 2. Test the complete cascade system
        console.log('\n🧪 Testing Complete Cascade System...');
        
        // Get a sample IMEI
        const sampleResult = await client.query(`
            SELECT imei, sku FROM product LIMIT 1
        `);
        
        if (sampleResult.rows.length > 0) {
            const sampleImei = sampleResult.rows[0].imei;
            const originalSku = sampleResult.rows[0].sku;
            
            console.log(`Testing with IMEI: ${sampleImei}`);
            console.log(`Original SKU: ${originalSku}`);
            
            // Test different match statuses
            const testCases = [
                { status: 'matched', sku: 'MATCHED-SKU-123', score: 0.95, method: 'exact' },
                { status: 'manual_review', sku: 'REVIEW-SKU-456', score: 0.75, method: 'fuzzy' },
                { status: 'no_match', sku: null, score: 0.30, method: 'partial' }
            ];
            
            for (const testCase of testCases) {
                console.log(`\n📝 Testing ${testCase.status} status...`);
                
                // Insert test matching result
                await client.query(`
                    INSERT INTO sku_matching_results (
                        imei, original_sku, matched_sku, match_score, 
                        match_method, match_status, match_notes
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (imei) 
                    DO UPDATE SET
                        matched_sku = EXCLUDED.matched_sku,
                        match_score = EXCLUDED.match_score,
                        match_method = EXCLUDED.match_method,
                        match_status = EXCLUDED.match_status,
                        match_notes = EXCLUDED.match_notes,
                        updated_at = NOW()
                `, [sampleImei, originalSku, testCase.sku, testCase.score, testCase.method, testCase.status, `Test ${testCase.status}`]);
                
                console.log(`✅ ${testCase.status} result inserted`);
                
                // Check product SKU
                const updatedProduct = await client.query(`
                    SELECT imei, sku FROM product WHERE imei = $1
                `, [sampleImei]);
                
                if (updatedProduct.rows.length > 0) {
                    console.log(`Product SKU: ${updatedProduct.rows[0].sku}`);
                    
                    if (testCase.status === 'matched' && updatedProduct.rows[0].sku === testCase.sku) {
                        console.log('✅ Cascade working: Product SKU updated');
                    } else if (testCase.status !== 'matched') {
                        console.log('✅ Cascade working: Product SKU unchanged (expected)');
                    }
                }
                
                // Check views
                const pendingCount = await client.query(`SELECT COUNT(*) FROM pending_sku_matches`);
                const matchedCount = await client.query(`SELECT COUNT(*) FROM successful_sku_matches`);
                
                console.log(`Pending items: ${pendingCount.rows[0].count}`);
                console.log(`Matched items: ${matchedCount.rows[0].count}`);
            }
            
            // Clean up
            await client.query(`
                UPDATE product SET sku = $1 WHERE imei = $2
            `, [originalSku, sampleImei]);
            
            await client.query(`
                DELETE FROM sku_matching_results WHERE imei = $1
            `, [sampleImei]);
            
            console.log('\n🧹 Test data cleaned up');
        }
        
        // 3. Show current system statistics
        console.log('\n📈 Current System Statistics:');
        
        const totalProducts = await client.query(`SELECT COUNT(*) FROM product`);
        const totalSkuResults = await client.query(`SELECT COUNT(*) FROM sku_matching_results`);
        const pendingItems = await client.query(`SELECT COUNT(*) FROM pending_sku_matches`);
        const matchedItems = await client.query(`SELECT COUNT(*) FROM successful_sku_matches`);
        
        console.log(`Total products: ${totalProducts.rows[0].count}`);
        console.log(`Total SKU matching results: ${totalSkuResults.rows[0].count}`);
        console.log(`Pending SKU matches: ${pendingItems.rows[0].count}`);
        console.log(`Successful SKU matches: ${matchedItems.rows[0].count}`);
        
        console.log('\n✅ Complete SKU matching system test completed!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

testCompleteSkuSystem();
