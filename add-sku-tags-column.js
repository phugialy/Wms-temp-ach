const { Pool } = require('pg');
require('dotenv').config();

async function addSkuTagsColumn() {
    console.log('🔧 Adding sku_tags column to sku_master...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Check if column exists
        const columnExists = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'sku_master' AND column_name = 'sku_tags'
        `);
        
        if (columnExists.rows.length === 0) {
            console.log('📝 Adding sku_tags column...');
            
            // Add sku_tags column
            await client.query(`
                ALTER TABLE sku_master ADD COLUMN sku_tags TEXT[]
            `);
            
            console.log('✅ Added sku_tags column');
        } else {
            console.log('ℹ️  sku_tags column already exists');
        }
        
        // Verify the change
        console.log('\n📋 Verifying sku_master table structure:');
        const structureResult = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'sku_master' 
            ORDER BY ordinal_position
        `);
        
        structureResult.rows.forEach(row => {
            console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
        });
        
        client.release();
        await pool.end();
        
        console.log('\n✅ sku_tags column setup completed!');
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
    }
}

// Run the setup
addSkuTagsColumn();

