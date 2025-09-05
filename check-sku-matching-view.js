const { Pool } = require('pg');
require('dotenv').config();

async function checkSkuMatchingView() {
    console.log('🔍 CHECKING SKU MATCHING VIEW STATUS...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
            idleTimeoutMillis: 0,
            connectionTimeoutMillis: 30000,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Check if sku_matching_view exists and its structure
        const viewExists = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'sku_matching_view'
            )
        `);
        
        console.log(`📊 sku_matching_view exists: ${viewExists.rows[0].exists}`);
        
        if (viewExists.rows[0].exists) {
            // Check the view structure
            const viewStructure = await client.query(`
                SELECT column_name, data_type
                FROM information_schema.columns 
                WHERE table_name = 'sku_matching_view'
                ORDER BY ordinal_position
            `);
            
            console.log(`\n📋 sku_matching_view structure:`);
            viewStructure.rows.forEach(row => {
                console.log(`  ${row.column_name}: ${row.data_type}`);
            });
            
            // Check total records in the view
            const viewCount = await client.query(`
                SELECT COUNT(*) as total_records
                FROM sku_matching_view
            `);
            
            console.log(`\n📊 Total records in sku_matching_view: ${viewCount.rows[0].total_records}`);
            
            // Check if the view has the new sku_matched and match_score columns
            const hasNewColumns = await client.query(`
                SELECT 
                    COUNT(CASE WHEN column_name = 'sku_matched' THEN 1 END) as has_sku_matched,
                    COUNT(CASE WHEN column_name = 'match_score' THEN 1 END) as has_match_score,
                    COUNT(CASE WHEN column_name = 'requires_attention' THEN 1 END) as has_requires_attention
                FROM information_schema.columns 
                WHERE table_name = 'sku_matching_view'
            `);
            
            console.log(`\n🔍 View column status:`);
            console.log(`  Has sku_matched: ${hasNewColumns.rows[0].has_sku_matched > 0 ? 'YES' : 'NO'}`);
            console.log(`  Has match_score: ${hasNewColumns.rows[0].has_match_score > 0 ? 'YES' : 'NO'}`);
            console.log(`  Has requires_attention: ${hasNewColumns.rows[0].has_requires_attention > 0 ? 'YES' : 'NO'}`);
            
            // Show sample data from the view
            const sampleData = await client.query(`
                SELECT imei, original_sku, sku_matched, match_score, requires_attention, 
                       model, capacity, color, carrier, device_notes
                FROM sku_matching_view
                ORDER BY updated_at DESC
                LIMIT 5
            `);
            
            console.log(`\n📝 Sample data from sku_matching_view:`);
            sampleData.rows.forEach((row, index) => {
                console.log(`  ${index + 1}. IMEI: ${row.imei}`);
                console.log(`     Original: ${row.original_sku} → Matched: ${row.sku_matched || 'None'}`);
                console.log(`     Score: ${row.match_score || 'None'}, Attention: ${row.requires_attention ? 'YES' : 'NO'}`);
                console.log(`     Device: ${row.model}, ${row.capacity}, ${row.color}, ${row.carrier}`);
                console.log(`     Notes: ${row.device_notes || 'None'}`);
                console.log('');
            });
            
        } else {
            console.log('❌ sku_matching_view does not exist!');
        }
        
        // Check sku_matching_results table
        const resultsCount = await client.query(`
            SELECT COUNT(*) as total_results
            FROM sku_matching_results
        `);
        
        console.log(`📊 Total records in sku_matching_results: ${resultsCount.rows[0].total_results}`);
        
        // Check if the view needs to be refreshed
        const viewDefinition = await client.query(`
            SELECT definition
            FROM pg_views 
            WHERE viewname = 'sku_matching_view'
        `);
        
        if (viewDefinition.rows.length > 0) {
            console.log(`\n🔍 View definition includes sku_matching_results: ${viewDefinition.rows[0].definition.includes('sku_matching_results') ? 'YES' : 'NO'}`);
        }
        
        client.release();
        await pool.end();
        
    } catch (error) {
        console.error('❌ Check failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the check
checkSkuMatchingView();

