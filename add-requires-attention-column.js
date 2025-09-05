const { Pool } = require('pg');
require('dotenv').config();

async function addRequiresAttentionColumn() {
    console.log('🔄 ADDING requires_attention COLUMN TO sku_matching_results...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
            idleTimeoutMillis: 0,
            connectionTimeoutMillis: 30000,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Add requires_attention column
        await client.query(`
            ALTER TABLE sku_matching_results 
            ADD COLUMN IF NOT EXISTS requires_attention BOOLEAN DEFAULT FALSE
        `);
        
        console.log('✅ Added requires_attention column');
        
        // Create index for better performance on attention queries
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_sku_matching_results_requires_attention 
            ON sku_matching_results(requires_attention) 
            WHERE requires_attention = TRUE
        `);
        
        console.log('✅ Created index for requires_attention');
        
        // Verify the column was added
        const result = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'sku_matching_results' 
            AND column_name = 'requires_attention'
        `);
        
        if (result.rows.length > 0) {
            console.log('✅ Column verified:', result.rows[0]);
        } else {
            console.log('❌ Column not found');
        }
        
        client.release();
        await pool.end();
        
        console.log('\n✅ requires_attention column added successfully!');
        
    } catch (error) {
        console.error('❌ Add column failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the update
addRequiresAttentionColumn();

