const { Pool } = require('pg');
require('dotenv').config();

async function createAttentionRequiredView() {
    console.log('🔄 CREATING attention_required_view...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
            idleTimeoutMillis: 0,
            connectionTimeoutMillis: 30000,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Create the attention required view
        await client.query(`
            CREATE OR REPLACE VIEW attention_required_view AS
            SELECT 
                smr.imei,
                smr.original_sku,
                smr.matched_sku,
                smr.match_score,
                smr.match_method,
                smr.match_status,
                smr.match_notes,
                smr.requires_attention,
                smr.processed_at,
                smr.updated_at,
                smv.model,
                smv.capacity,
                smv.color,
                smv.carrier,
                smv.device_notes,
                smv.data_completeness,
                CASE 
                    WHEN smv.device_notes IS NULL THEN 'No device notes'
                    WHEN UPPER(smv.device_notes) NOT LIKE '%CARRIER%' THEN 'No carrier status in notes'
                    ELSE 'Ambiguous carrier status'
                END as attention_reason
            FROM sku_matching_results smr
            LEFT JOIN sku_matching_view smv ON smr.imei = smv.imei
            WHERE smr.requires_attention = TRUE
            ORDER BY smr.updated_at DESC
        `);
        
        console.log('✅ Created attention_required_view');
        
        // Test the view
        const testResult = await client.query(`
            SELECT COUNT(*) as total_attention_required
            FROM attention_required_view
        `);
        
        console.log(`📊 Total devices requiring attention: ${testResult.rows[0].total_attention_required}`);
        
        // Show sample data if any
        if (testResult.rows[0].total_attention_required > 0) {
            const sampleResult = await client.query(`
                SELECT imei, original_sku, matched_sku, attention_reason, device_notes
                FROM attention_required_view
                LIMIT 5
            `);
            
            console.log('\n📝 Sample attention required devices:');
            sampleResult.rows.forEach(row => {
                console.log(`  IMEI: ${row.imei}`);
                console.log(`    Original: ${row.original_sku} → Matched: ${row.matched_sku}`);
                console.log(`    Reason: ${row.attention_reason}`);
                console.log(`    Notes: ${row.device_notes || 'None'}`);
                console.log('');
            });
        }
        
        client.release();
        await pool.end();
        
        console.log('\n✅ attention_required_view created successfully!');
        
    } catch (error) {
        console.error('❌ Create view failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the creation
createAttentionRequiredView();

