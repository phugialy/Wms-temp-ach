const { Pool } = require('pg');
require('dotenv').config();

async function thoroughCleanup() {
    console.log('🧹 Starting thorough database cleanup...');
    
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
            console.log('\n📋 Cleaning up sku_master_tags table...');
            const skuTagResult = await client.query('DELETE FROM sku_master_tags');
            console.log(`  ✅ Removed ${skuTagResult.rowCount} SKU-tag relationships`);
            
            console.log('\n🏷️  Cleaning up sku_tags table...');
            const tagResult = await client.query('DELETE FROM sku_tags');
            console.log(`  ✅ Removed ${tagResult.rowCount} tags`);
            
            console.log('\n❓ Cleaning up undefined_tag_review table...');
            const undefinedResult = await client.query('DELETE FROM undefined_tag_review');
            console.log(`  ✅ Removed ${undefinedResult.rowCount} undefined tag reviews`);
            
            console.log('\n📱 Resetting sku_master table...');
            const resetResult = await client.query('UPDATE sku_master SET device_type = NULL, tag_count = 0');
            console.log(`  ✅ Reset ${resetResult.rowCount} SKU records`);
            
            // Commit transaction
            await client.query('COMMIT');
            
            // Verify cleanup
            console.log('\n📊 Verifying cleanup...');
            const skuMasterCount = await client.query('SELECT COUNT(*) FROM sku_master');
            const skuTagsCount = await client.query('SELECT COUNT(*) FROM sku_tags');
            const skuMasterTagsCount = await client.query('SELECT COUNT(*) FROM sku_master_tags');
            const undefinedCount = await client.query('SELECT COUNT(*) FROM undefined_tag_review');
            
            console.log(`  sku_master: ${skuMasterCount.rows[0].count}`);
            console.log(`  sku_tags: ${skuTagsCount.rows[0].count}`);
            console.log(`  sku_master_tags: ${skuMasterTagsCount.rows[0].count}`);
            console.log(`  undefined_tag_review: ${undefinedCount.rows[0].count}`);
            
            console.log('\n✅ Thorough database cleanup completed successfully!');
            
        } catch (error) {
            // Rollback on error
            await client.query('ROLLBACK');
            throw error;
        }
        
        client.release();
        await pool.end();
        
    } catch (error) {
        console.error('❌ Thorough cleanup failed:', error.message);
    }
}

// Run the thorough cleanup
thoroughCleanup();

