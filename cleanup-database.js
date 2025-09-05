const { Pool } = require('pg');
require('dotenv').config();

async function cleanupDatabase() {
    console.log('🧹 Starting database cleanup...');
    
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
            // 1. Clean up sku_master_tags table
            console.log('\n📋 Cleaning up sku_master_tags table...');
            const skuTagsCount = await client.query('SELECT COUNT(*) FROM sku_master_tags');
            console.log(`  Current records: ${skuTagsCount.rows[0].count}`);
            
            // Remove any records with null tag_category
            const nullCleanup = await client.query(`
                DELETE FROM sku_master_tags 
                WHERE tag_category IS NULL
            `);
            console.log(`  Removed ${nullCleanup.rowCount} records with null tag_category`);
            
            // Remove any orphaned records (tags that don't exist in sku_tags)
            const orphanedCleanup = await client.query(`
                DELETE FROM sku_master_tags 
                WHERE tag_id NOT IN (SELECT id FROM sku_tags)
            `);
            console.log(`  Removed ${orphanedCleanup.rowCount} orphaned records`);
            
            // 2. Clean up sku_tags table
            console.log('\n🏷️  Cleaning up sku_tags table...');
            const tagsCount = await client.query('SELECT COUNT(*) FROM sku_tags');
            console.log(`  Current records: ${tagsCount.rows[0].count}`);
            
            // Remove any tags with null categories
            const nullTagsCleanup = await client.query(`
                DELETE FROM sku_tags 
                WHERE tag_category IS NULL
            `);
            console.log(`  Removed ${nullTagsCleanup.rowCount} tags with null category`);
            
            // 3. Reset sku_master device_type and tag_count
            console.log('\n📱 Resetting sku_master table...');
            const resetResult = await client.query(`
                UPDATE sku_master 
                SET device_type = NULL, tag_count = 0
            `);
            console.log(`  Reset ${resetResult.rowCount} SKU records`);
            
            // 4. Clean up undefined_tag_review table
            console.log('\n❓ Cleaning up undefined_tag_review table...');
            const undefinedCount = await client.query('SELECT COUNT(*) FROM undefined_tag_review');
            console.log(`  Current records: ${undefinedCount.rows[0].count}`);
            
            // 5. Show final counts
            console.log('\n📊 Final table counts:');
            const finalSkuTags = await client.query('SELECT COUNT(*) FROM sku_master_tags');
            const finalTags = await client.query('SELECT COUNT(*) FROM sku_tags');
            const finalSkus = await client.query('SELECT COUNT(*) FROM sku_master');
            
            console.log(`  sku_master: ${finalSkus.rows[0].count}`);
            console.log(`  sku_tags: ${finalTags.rows[0].count}`);
            console.log(`  sku_master_tags: ${finalSkuTags.rows[0].count}`);
            
            // Commit transaction
            await client.query('COMMIT');
            console.log('\n✅ Database cleanup completed successfully!');
            
        } catch (error) {
            // Rollback on error
            await client.query('ROLLBACK');
            throw error;
        }
        
        client.release();
        await pool.end();
        
    } catch (error) {
        console.error('❌ Database cleanup failed:', error.message);
    }
}

cleanupDatabase();

