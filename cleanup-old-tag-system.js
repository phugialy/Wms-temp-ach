const { Pool } = require('pg');
require('dotenv').config();

async function cleanupOldTagSystem() {
    console.log('🧹 Cleaning up old tag system completely...');
    
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
            console.log('\n📋 Step 1: Removing all tag relationships...');
            const skuTagResult = await client.query('DELETE FROM sku_master_tags');
            console.log(`  ✅ Removed ${skuTagResult.rowCount} SKU-tag relationships`);
            
            console.log('\n🏷️  Step 2: Removing all tags...');
            const tagResult = await client.query('DELETE FROM sku_tags');
            console.log(`  ✅ Removed ${tagResult.rowCount} tags`);
            
            console.log('\n❓ Step 3: Removing undefined tag reviews...');
            const undefinedResult = await client.query('DELETE FROM undefined_tag_review');
            console.log(`  ✅ Removed ${undefinedResult.rowCount} undefined tag reviews`);
            
            console.log('\n📱 Step 4: Resetting sku_master table...');
            const resetResult = await client.query(`
                UPDATE sku_master 
                SET device_type = NULL, 
                    tag_count = 0,
                    updated_at = CURRENT_TIMESTAMP
            `);
            console.log(`  ✅ Reset ${resetResult.rowCount} SKU records`);
            
            // Commit transaction
            await client.query('COMMIT');
            
            // Verify cleanup
            console.log('\n📊 Verifying cleanup...');
            const skuMasterCount = await client.query('SELECT COUNT(*) FROM sku_master');
            const skuTagsCount = await client.query('SELECT COUNT(*) FROM sku_tags');
            const skuMasterTagsCount = await client.query('SELECT COUNT(*) FROM sku_master_tags');
            const undefinedCount = await client.query('SELECT COUNT(*) FROM undefined_tag_review');
            
            console.log(`  sku_master: ${skuMasterCount.rows[0].count} records`);
            console.log(`  sku_tags: ${skuTagsCount.rows[0].count} records`);
            console.log(`  sku_master_tags: ${skuMasterTagsCount.rows[0].count} records`);
            console.log(`  undefined_tag_review: ${undefinedCount.rows[0].count} records`);
            
            console.log('\n✅ Old tag system cleanup completed successfully!');
            console.log('🚀 Ready for new implementation!');
            
        } catch (error) {
            // Rollback on error
            await client.query('ROLLBACK');
            throw error;
        }
        
        client.release();
        await pool.end();
        
    } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
    }
}

// Run the cleanup
cleanupOldTagSystem();

