require('dotenv').config();
const { Client } = require('pg');

async function testSimpleSkuSystem() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    
    try {
        await client.connect();
        console.log('🔗 Connected to database');
        
        // Check if sku_matching_results table exists
        const tableResult = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'sku_matching_results'
            );
        `);
        
        console.log('SKU matching results table exists:', tableResult.rows[0].exists);
        
        // Check if sku_matching_view exists
        const viewResult = await client.query(`
            SELECT EXISTS (
                SELECT FROM pg_views 
                WHERE schemaname = 'public' 
                AND viewname = 'sku_matching_view'
            );
        `);
        
        console.log('SKU matching view exists:', viewResult.rows[0].exists);
        
        // Check if triggers exist
        const triggerResult = await client.query(`
            SELECT trigger_name, event_object_table
            FROM information_schema.triggers 
            WHERE trigger_schema = 'public' 
            AND trigger_name LIKE '%sku%'
        `);
        
        console.log('SKU-related triggers:');
        triggerResult.rows.forEach(row => {
            console.log(`  - ${row.trigger_name} on ${row.event_object_table}`);
        });
        
        // Test basic functionality
        if (tableResult.rows[0].exists) {
            console.log('\n🧪 Testing basic functionality...');
            
            // Get a sample IMEI
            const sampleResult = await client.query(`
                SELECT imei, sku FROM product LIMIT 1
            `);
            
            if (sampleResult.rows.length > 0) {
                const sampleImei = sampleResult.rows[0].imei;
                const originalSku = sampleResult.rows[0].sku;
                
                console.log(`Testing with IMEI: ${sampleImei}, SKU: ${originalSku}`);
                
                // Try to insert a test matching result
                try {
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
                    `, [sampleImei, originalSku, 'TEST-SKU-123', 0.95, 'test', 'matched', 'Test cascade']);
                    
                    console.log('✅ Test matching result inserted successfully');
                    
                    // Check if product was updated
                    const updatedProduct = await client.query(`
                        SELECT imei, sku FROM product WHERE imei = $1
                    `, [sampleImei]);
                    
                    if (updatedProduct.rows.length > 0) {
                        console.log(`Product SKU after update: ${updatedProduct.rows[0].sku}`);
                        if (updatedProduct.rows[0].sku === 'TEST-SKU-123') {
                            console.log('✅ Cascade system working!');
                        } else {
                            console.log('❌ Cascade system not working');
                        }
                    }
                    
                    // Clean up
                    await client.query(`
                        UPDATE product SET sku = $1 WHERE imei = $2
                    `, [originalSku, sampleImei]);
                    
                    await client.query(`
                        DELETE FROM sku_matching_results WHERE imei = $1
                    `, [sampleImei]);
                    
                    console.log('🧹 Test data cleaned up');
                    
                } catch (error) {
                    console.error('❌ Error testing functionality:', error.message);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

testSimpleSkuSystem();
