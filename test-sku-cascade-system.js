const { Client } = require('pg');

async function testSkuCascadeSystem() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    
    try {
        await client.connect();
        console.log('🔗 Connected to database');
        
        // 1. Check if SKU matching results table exists
        console.log('\n📋 Checking SKU-related tables...');
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE '%sku%' 
            ORDER BY table_name
        `);
        
        console.log('SKU-related tables:');
        tablesResult.rows.forEach(row => console.log(`  - ${row.table_name}`));
        
        // 2. Check SKU-related views
        console.log('\n👁️ Checking SKU-related views...');
        const viewsResult = await client.query(`
            SELECT viewname 
            FROM pg_views 
            WHERE schemaname = 'public' 
            AND viewname LIKE '%sku%' 
            ORDER BY viewname
        `);
        
        console.log('SKU-related views:');
        viewsResult.rows.forEach(row => console.log(`  - ${row.viewname}`));
        
        // 3. Check SKU-related functions
        console.log('\n⚙️ Checking SKU-related functions...');
        const functionsResult = await client.query(`
            SELECT routine_name 
            FROM information_schema.routines 
            WHERE routine_schema = 'public' 
            AND routine_name LIKE '%sku%' 
            ORDER BY routine_name
        `);
        
        console.log('SKU-related functions:');
        functionsResult.rows.forEach(row => console.log(`  - ${row.routine_name}`));
        
        // 4. Check triggers
        console.log('\n🔧 Checking SKU-related triggers...');
        const triggersResult = await client.query(`
            SELECT trigger_name, event_object_table, action_statement
            FROM information_schema.triggers 
            WHERE trigger_schema = 'public' 
            AND trigger_name LIKE '%sku%'
            ORDER BY trigger_name
        `);
        
        console.log('SKU-related triggers:');
        triggersResult.rows.forEach(row => console.log(`  - ${row.trigger_name} on ${row.event_object_table}`));
        
        // 5. Test the cascade system with a sample IMEI
        console.log('\n🧪 Testing cascade system...');
        
        // Get a sample IMEI from product table
        const sampleResult = await client.query(`
            SELECT imei, sku FROM product LIMIT 1
        `);
        
        if (sampleResult.rows.length > 0) {
            const sampleImei = sampleResult.rows[0].imei;
            const originalSku = sampleResult.rows[0].sku;
            
            console.log(`Testing with IMEI: ${sampleImei}, Original SKU: ${originalSku}`);
            
            // Insert a test matching result
            const testMatchedSku = 'TEST-MATCHED-SKU-123';
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
            `, [sampleImei, originalSku, testMatchedSku, 0.95, 'test', 'matched', 'Test cascade']);
            
            console.log('✅ Test matching result inserted');
            
            // Check if product SKU was updated
            const updatedProduct = await client.query(`
                SELECT imei, sku FROM product WHERE imei = $1
            `, [sampleImei]);
            
            if (updatedProduct.rows.length > 0) {
                console.log(`Product SKU updated: ${updatedProduct.rows[0].sku}`);
                
                if (updatedProduct.rows[0].sku === testMatchedSku) {
                    console.log('✅ Cascade system working: Product SKU updated automatically');
                } else {
                    console.log('❌ Cascade system not working: Product SKU not updated');
                }
            }
            
            // Check inventory view
            const inventoryView = await client.query(`
                SELECT imei, sku FROM inventory_view WHERE imei = $1
            `, [sampleImei]);
            
            if (inventoryView.rows.length > 0) {
                console.log(`Inventory view SKU: ${inventoryView.rows[0].sku}`);
                if (inventoryView.rows[0].sku === testMatchedSku) {
                    console.log('✅ Inventory view updated with new SKU');
                } else {
                    console.log('❌ Inventory view not updated');
                }
            }
            
            // Clean up test data
            await client.query(`
                UPDATE product SET sku = $1 WHERE imei = $2
            `, [originalSku, sampleImei]);
            
            await client.query(`
                DELETE FROM sku_matching_results WHERE imei = $1
            `, [sampleImei]);
            
            console.log('🧹 Test data cleaned up');
            
        } else {
            console.log('⚠️ No sample IMEI found in product table');
        }
        
        console.log('\n✅ SKU cascade system test completed');
        
    } catch (error) {
        console.error('❌ Error testing SKU cascade system:', error.message);
    } finally {
        await client.end();
    }
}

testSkuCascadeSystem();
