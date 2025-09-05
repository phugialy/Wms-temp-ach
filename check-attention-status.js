const { Pool } = require('pg');
require('dotenv').config();

async function checkAttentionStatus() {
    console.log('🔍 CHECKING ATTENTION REQUIRED STATUS...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
            idleTimeoutMillis: 0,
            connectionTimeoutMillis: 30000,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Check total devices requiring attention
        const attentionResult = await client.query(`
            SELECT COUNT(*) as total_attention_required
            FROM attention_required_view
        `);
        
        console.log(`📊 Total devices requiring attention: ${attentionResult.rows[0].total_attention_required}`);
        
        // Check devices with requires_attention = true
        const requiresAttentionResult = await client.query(`
            SELECT COUNT(*) as total_requires_attention
            FROM sku_matching_results
            WHERE requires_attention = TRUE
        `);
        
        console.log(`📊 Total devices with requires_attention = TRUE: ${requiresAttentionResult.rows[0].total_requires_attention}`);
        
        // Show sample attention required devices if any
        if (attentionResult.rows[0].total_attention_required > 0) {
            const sampleResult = await client.query(`
                SELECT imei, original_sku, matched_sku, attention_reason, device_notes, carrier
                FROM attention_required_view
                LIMIT 10
            `);
            
            console.log('\n📝 Sample attention required devices:');
            sampleResult.rows.forEach((row, index) => {
                console.log(`  ${index + 1}. IMEI: ${row.imei}`);
                console.log(`     Original: ${row.original_sku} → Matched: ${row.matched_sku}`);
                console.log(`     Carrier: ${row.carrier}, Notes: ${row.device_notes || 'None'}`);
                console.log(`     Reason: ${row.attention_reason}`);
                console.log('');
            });
        } else {
            console.log('\n✅ No devices currently require attention!');
        }
        
        // Check recent matches to see the current logic in action
        const recentMatches = await client.query(`
            SELECT smr.imei, smr.matched_sku, smr.match_score, smr.requires_attention, 
                   smv.carrier, smv.device_notes
            FROM sku_matching_results smr
            LEFT JOIN sku_matching_view smv ON smr.imei = smv.imei
            ORDER BY smr.updated_at DESC
            LIMIT 10
        `);
        
        console.log('\n📋 Recent matches:');
        recentMatches.rows.forEach((row, index) => {
            console.log(`  ${index + 1}. IMEI: ${row.imei}`);
            console.log(`     Matched: ${row.matched_sku} (Score: ${row.match_score})`);
            console.log(`     Carrier: ${row.carrier}, Notes: ${row.device_notes || 'None'}`);
            console.log(`     Requires Attention: ${row.requires_attention ? 'YES ⚠️' : 'NO ✅'}`);
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
checkAttentionStatus();
