const { Pool } = require('pg');
require('dotenv').config();

async function verifySkuTags() {
    console.log('🔍 Verifying generated SKU tags...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Check overall statistics
        console.log('\n📊 SKU Tags Statistics:');
        const statsResult = await client.query(`
            SELECT 
                COUNT(*) as total_skus,
                COUNT(sku_tags) as skus_with_tags,
                COUNT(*) FILTER (WHERE sku_tags IS NOT NULL AND array_length(sku_tags, 1) > 0) as skus_with_non_empty_tags,
                AVG(array_length(sku_tags, 1)) as avg_tags_per_sku,
                MAX(array_length(sku_tags, 1)) as max_tags_per_sku,
                MIN(array_length(sku_tags, 1)) as min_tags_per_sku
            FROM sku_master
        `);
        
        const stats = statsResult.rows[0];
        console.log(`  Total SKUs: ${stats.total_skus}`);
        console.log(`  SKUs with tags: ${stats.skus_with_tags}`);
        console.log(`  SKUs with non-empty tags: ${stats.skus_with_non_empty_tags}`);
        console.log(`  Average tags per SKU: ${Math.round(stats.avg_tags_per_sku || 0)}`);
        console.log(`  Max tags per SKU: ${stats.max_tags_per_sku || 0}`);
        console.log(`  Min tags per SKU: ${stats.min_tags_per_sku || 0}`);
        
        // Show sample SKUs with their tags
        console.log('\n📋 Sample SKUs with Tags:');
        const sampleResult = await client.query(`
            SELECT id, sku_code, sku_tags
            FROM sku_master 
            WHERE sku_tags IS NOT NULL AND array_length(sku_tags, 1) > 0
            ORDER BY id 
            LIMIT 10
        `);
        
        sampleResult.rows.forEach((sku, index) => {
            console.log(`  ${index + 1}. ID: ${sku.id} | SKU: ${sku.sku_code}`);
            console.log(`     Tags: [${sku.sku_tags.join(', ')}]`);
            console.log('');
        });
        
        // Check for any SKUs without tags
        console.log('\n⚠️  SKUs without tags:');
        const noTagsResult = await client.query(`
            SELECT id, sku_code
            FROM sku_master 
            WHERE sku_tags IS NULL OR array_length(sku_tags, 1) = 0
            ORDER BY id 
            LIMIT 5
        `);
        
        if (noTagsResult.rows.length > 0) {
            noTagsResult.rows.forEach((sku, index) => {
                console.log(`  ${index + 1}. ID: ${sku.id} | SKU: ${sku.sku_code}`);
            });
        } else {
            console.log('  ✅ All SKUs have tags!');
        }
        
        // Show tag distribution by length
        console.log('\n📈 Tag Distribution by Length:');
        const distributionResult = await client.query(`
            SELECT 
                array_length(sku_tags, 1) as tag_count,
                COUNT(*) as sku_count
            FROM sku_master 
            WHERE sku_tags IS NOT NULL
            GROUP BY array_length(sku_tags, 1)
            ORDER BY tag_count
        `);
        
        distributionResult.rows.forEach(row => {
            console.log(`  ${row.tag_count} tags: ${row.sku_count} SKUs`);
        });
        
        client.release();
        await pool.end();
        
        console.log('\n✅ SKU tags verification completed!');
        
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
    }
}

// Run the verification
verifySkuTags();

