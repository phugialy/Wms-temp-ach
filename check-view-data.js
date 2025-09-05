const { Pool } = require('pg');
require('dotenv').config();

async function checkViewData() {
    console.log('🔍 CHECKING SKU MATCHING VIEW DATA...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
            idleTimeoutMillis: 0,
            connectionTimeoutMillis: 30000,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Check sample data from the view (without requires_attention column)
        const sampleData = await client.query(`
            SELECT imei, original_sku, sku_matched, match_score, 
                   model, capacity, color, carrier, device_notes
            FROM sku_matching_view
            ORDER BY match_processed_at DESC
            LIMIT 10
        `);
        
        console.log(`\n📝 Sample data from sku_matching_view:`);
        sampleData.rows.forEach((row, index) => {
            console.log(`  ${index + 1}. IMEI: ${row.imei}`);
            console.log(`     Original: ${row.original_sku} → Matched: ${row.sku_matched || 'None'}`);
            console.log(`     Score: ${row.match_score || 'None'}`);
            console.log(`     Device: ${row.model}, ${row.capacity}, ${row.color}, ${row.carrier}`);
            console.log(`     Notes: ${row.device_notes || 'None'}`);
            console.log('');
        });
        
        // Check if the view is getting data from sku_matching_results
        const viewDefinition = await client.query(`
            SELECT definition
            FROM pg_views 
            WHERE viewname = 'sku_matching_view'
        `);
        
        if (viewDefinition.rows.length > 0) {
            console.log(`\n🔍 View definition:`);
            console.log(viewDefinition.rows[0].definition);
        }
        
        // Check recent updates in sku_matching_results
        const recentResults = await client.query(`
            SELECT imei, matched_sku, match_score, requires_attention, updated_at
            FROM sku_matching_results
            ORDER BY updated_at DESC
            LIMIT 5
        `);
        
        console.log(`\n📊 Recent sku_matching_results updates:`);
        recentResults.rows.forEach((row, index) => {
            console.log(`  ${index + 1}. IMEI: ${row.imei}`);
            console.log(`     Matched: ${row.matched_sku}, Score: ${row.match_score}`);
            console.log(`     Requires Attention: ${row.requires_attention ? 'YES' : 'NO'}`);
            console.log(`     Updated: ${row.updated_at}`);
            console.log('');
        });
        
        client.release();
        await pool.end();
        
    } catch (error) {
        console.error('❌ Check failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the check
checkViewData();

