const { Pool } = require('pg');
require('dotenv').config();

async function fixUnlockedAttentionFlag() {
    console.log('🔧 FIXING UNLOCKED CARRIER ATTENTION FLAGS...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
            idleTimeoutMillis: 0,
            connectionTimeoutMillis: 30000,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Find devices with "Unlocked" carrier, no device_notes, but requires_attention = true
        const devicesToFix = await client.query(`
            SELECT smr.imei, smr.matched_sku, smv.carrier, smv.device_notes
            FROM sku_matching_results smr
            LEFT JOIN sku_matching_view smv ON smr.imei = smv.imei
            WHERE smr.requires_attention = TRUE
            AND UPPER(smv.carrier) = 'UNLOCKED'
            AND (smv.device_notes IS NULL OR smv.device_notes = '')
        `);
        
        console.log(`📊 Found ${devicesToFix.rows.length} devices to fix:`);
        
        if (devicesToFix.rows.length > 0) {
            devicesToFix.rows.forEach((row, index) => {
                console.log(`  ${index + 1}. IMEI: ${row.imei}`);
                console.log(`     Carrier: ${row.carrier}, Notes: ${row.device_notes || 'None'}`);
                console.log(`     Matched: ${row.matched_sku}`);
            });
            
            // Update these devices to remove attention flag
            const updateResult = await client.query(`
                UPDATE sku_matching_results 
                SET requires_attention = FALSE, updated_at = NOW()
                WHERE imei IN (
                    SELECT smr.imei
                    FROM sku_matching_results smr
                    LEFT JOIN sku_matching_view smv ON smr.imei = smv.imei
                    WHERE smr.requires_attention = TRUE
                    AND UPPER(smv.carrier) = 'UNLOCKED'
                    AND (smv.device_notes IS NULL OR smv.device_notes = '')
                )
            `);
            
            console.log(`\n✅ Updated ${updateResult.rowCount} devices to remove attention flag`);
            
            // Verify the fix
            const verifyResult = await client.query(`
                SELECT COUNT(*) as remaining_attention
                FROM sku_matching_results smr
                LEFT JOIN sku_matching_view smv ON smr.imei = smv.imei
                WHERE smr.requires_attention = TRUE
                AND UPPER(smv.carrier) = 'UNLOCKED'
                AND (smv.device_notes IS NULL OR smv.device_notes = '')
            `);
            
            console.log(`📊 Remaining "Unlocked" devices with attention flag: ${verifyResult.rows[0].remaining_attention}`);
            
        } else {
            console.log('✅ No devices need fixing!');
        }
        
        // Show final attention status
        const finalAttentionResult = await client.query(`
            SELECT COUNT(*) as total_attention_required
            FROM attention_required_view
        `);
        
        console.log(`\n📊 Final total devices requiring attention: ${finalAttentionResult.rows[0].total_attention_required}`);
        
        client.release();
        await pool.end();
        
        console.log('\n✅ Fix completed successfully!');
        
    } catch (error) {
        console.error('❌ Fix failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the fix
fixUnlockedAttentionFlag();

