const { Pool } = require('pg');
require('dotenv').config();

async function fixSkuTagsSchema() {
    console.log('🔧 Fixing sku_tags table schema...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Start transaction
        await client.query('BEGIN');
        
        try {
            // Check if updated_at column exists
            const columnExists = await client.query(`
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'sku_tags' AND column_name = 'updated_at'
            `);
            
            if (columnExists.rows.length === 0) {
                console.log('📝 Adding updated_at column to sku_tags table...');
                
                // Add updated_at column
                await client.query(`
                    ALTER TABLE sku_tags 
                    ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                `);
                
                console.log('✅ Added updated_at column');
                
                // Update existing records to have updated_at = created_at
                const updateResult = await client.query(`
                    UPDATE sku_tags 
                    SET updated_at = created_at 
                    WHERE updated_at IS NULL
                `);
                
                console.log(`✅ Updated ${updateResult.rowCount} existing records`);
                
            } else {
                console.log('ℹ️  updated_at column already exists');
            }
            
            // Verify the fix
            console.log('\n📋 Verifying sku_tags table structure:');
            const structureResult = await client.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = 'sku_tags' 
                ORDER BY ordinal_position
            `);
            
            structureResult.rows.forEach(row => {
                console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
            });
            
            // Commit transaction
            await client.query('COMMIT');
            console.log('\n✅ Schema fix completed successfully!');
            
        } catch (error) {
            // Rollback on error
            await client.query('ROLLBACK');
            throw error;
        }
        
        client.release();
        await pool.end();
        
    } catch (error) {
        console.error('❌ Schema fix failed:', error.message);
    }
}

// Run the fix
fixSkuTagsSchema();

