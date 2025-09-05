const { Pool } = require('pg');
require('dotenv').config();

async function addRequiresAttentionToView() {
    console.log('🔄 ADDING requires_attention COLUMN TO sku_matching_view...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
            idleTimeoutMillis: 0,
            connectionTimeoutMillis: 30000,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // First, let's get the current view definition
        const currentView = await client.query(`
            SELECT definition
            FROM pg_views 
            WHERE viewname = 'sku_matching_view'
        `);
        
        if (currentView.rows.length === 0) {
            console.log('❌ sku_matching_view not found');
            return;
        }
        
        console.log('📋 Current view definition found');
        
        // Drop the view and recreate it with the new column
        await client.query(`DROP VIEW IF EXISTS sku_matching_view`);
        console.log('✅ Dropped existing view');
        
        // Recreate the view with requires_attention column added
        await client.query(`
            CREATE VIEW sku_matching_view AS
            SELECT 
                p.imei,
                p.sku AS original_sku,
                smr.matched_sku AS sku_matched,
                smr.match_score,
                smr.match_method,
                smr.match_status,
                smr.match_notes,
                smr.requires_attention,
                smr.processed_at AS match_processed_at,
                p.brand,
                i.model,
                i.carrier,
                i.capacity,
                i.color,
                dt.notes AS device_notes,
                CASE
                    WHEN ((i.model IS NOT NULL) AND (i.capacity IS NOT NULL) AND (i.color IS NOT NULL)) THEN 'complete'::text
                    WHEN ((i.model IS NOT NULL) AND (i.capacity IS NOT NULL)) THEN 'partial'::text
                    ELSE 'incomplete'::text
                END AS data_completeness,
                GREATEST(p.date_in, COALESCE(mh.movement_date, p.date_in)) AS last_activity
            FROM ((((product p
                LEFT JOIN item i ON (((p.imei)::text = (i.imei)::text)))
                LEFT JOIN device_test dt ON (((p.imei)::text = (dt.imei)::text)))
                LEFT JOIN movement_history mh ON (((p.imei)::text = (mh.imei)::text)))
                LEFT JOIN sku_matching_results smr ON (((p.imei)::text = (smr.imei)::text)))
            WHERE (((mh.movement_date = ( SELECT max(mh2.movement_date) AS max
                FROM movement_history mh2
                WHERE ((mh2.imei)::text = (p.imei)::text))) OR (mh.movement_date IS NULL)) AND ((dt.notes IS NULL) OR ((dt.notes !~~* '%FAIL%'::text) AND (dt.notes !~~* '%FAILED%'::text))))
        `);
        
        console.log('✅ Recreated view with requires_attention column');
        
        // Verify the column was added
        const columnCheck = await client.query(`
            SELECT column_name, data_type
            FROM information_schema.columns 
            WHERE table_name = 'sku_matching_view' 
            AND column_name = 'requires_attention'
        `);
        
        if (columnCheck.rows.length > 0) {
            console.log('✅ requires_attention column verified in view');
        } else {
            console.log('❌ requires_attention column not found in view');
        }
        
        // Test the updated view
        const testResult = await client.query(`
            SELECT imei, sku_matched, match_score, requires_attention, 
                   model, capacity, color, carrier, device_notes
            FROM sku_matching_view
            WHERE requires_attention = TRUE
            LIMIT 3
        `);
        
        console.log(`\n📊 Devices requiring attention in updated view: ${testResult.rows.length}`);
        
        if (testResult.rows.length > 0) {
            console.log('\n📝 Sample attention required devices:');
            testResult.rows.forEach((row, index) => {
                console.log(`  ${index + 1}. IMEI: ${row.imei}`);
                console.log(`     Matched: ${row.sku_matched}, Score: ${row.match_score}`);
                console.log(`     Device: ${row.model}, ${row.capacity}, ${row.color}, ${row.carrier}`);
                console.log(`     Notes: ${row.device_notes || 'None'}`);
                console.log('');
            });
        }
        
        // Show total count
        const totalCount = await client.query(`
            SELECT COUNT(*) as total_records
            FROM sku_matching_view
        `);
        
        console.log(`📊 Total records in updated view: ${totalCount.rows[0].total_records}`);
        
        client.release();
        await pool.end();
        
        console.log('\n✅ sku_matching_view updated successfully with requires_attention column!');
        
    } catch (error) {
        console.error('❌ Update failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the update
addRequiresAttentionToView();

