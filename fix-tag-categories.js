const { Pool } = require('pg');
require('dotenv').config();

async function fixTagCategories() {
    console.log('🔧 Fixing obvious tag categorization errors...');
    
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
            // 1. Fix obvious color tags that were misclassified
            console.log('\n🎨 Fixing color tags...');
            
            const colorFixes = [
                { from: 'SLV', to: 'SILVER', category: 'COLOR' },
                { from: 'SG', to: 'SILVER', category: 'COLOR' },
                { from: 'BLK', to: 'BLACK', category: 'COLOR' },
                { from: 'WHT', to: 'WHITE', category: 'COLOR' },
                { from: 'GRN', to: 'GREEN', category: 'COLOR' },
                { from: 'BLU', to: 'BLUE', category: 'COLOR' },
                { from: 'RED', to: 'RED', category: 'COLOR' },
                { from: 'GLD', to: 'GOLD', category: 'COLOR' },
                { from: 'ROSE', to: 'ROSE', category: 'COLOR' },
                { from: 'PURPLE', to: 'PURPLE', category: 'COLOR' },
                { from: 'ORANGE', to: 'ORANGE', category: 'COLOR' }
            ];
            
            for (const fix of colorFixes) {
                // Check if the misclassified tag exists
                const existingTag = await client.query(`
                    SELECT id, tag_category FROM sku_tags 
                    WHERE tag_name = $1 AND tag_category != $2
                `, [fix.from, fix.category]);
                
                if (existingTag.rows.length > 0) {
                    console.log(`  🔄 Fixing ${fix.from} from ${existingTag.rows[0].tag_category} to ${fix.category}`);
                    
                    // Update the tag category
                    await client.query(`
                        UPDATE sku_tags 
                        SET tag_category = $1, tag_value = $2
                        WHERE tag_name = $3
                    `, [fix.category, fix.to, fix.from]);
                    
                    // Update all related sku_master_tags
                    await client.query(`
                        UPDATE sku_master_tags 
                        SET tag_category = $1
                        WHERE tag_id = $2
                    `, [fix.category, existingTag.rows[0].id]);
                    
                    console.log(`    ✅ Updated ${fix.from} tag and relationships`);
                }
            }
            
            // 2. Fix obvious carrier tags
            console.log('\n📡 Fixing carrier tags...');
            
            const carrierFixes = [
                { from: 'VG', to: 'VERIZON', category: 'CARRIER' },
                { from: 'TMO', to: 'T-MOBILE', category: 'CARRIER' },
                { from: 'ATT', to: 'AT&T', category: 'CARRIER' },
                { from: 'SPR', to: 'SPRINT', category: 'CARRIER' },
                { from: 'USC', to: 'US CELLULAR', category: 'CARRIER' }
            ];
            
            for (const fix of carrierFixes) {
                const existingTag = await client.query(`
                    SELECT id, tag_category FROM sku_tags 
                    WHERE tag_name = $1 AND tag_category != $2
                `, [fix.from, fix.category]);
                
                if (existingTag.rows.length > 0) {
                    console.log(`  🔄 Fixing ${fix.from} from ${existingTag.rows[0].tag_category} to ${fix.category}`);
                    
                    await client.query(`
                        UPDATE sku_tags 
                        SET tag_category = $1, tag_value = $2
                        WHERE tag_name = $3
                    `, [fix.category, fix.to, fix.from]);
                    
                    await client.query(`
                        UPDATE sku_master_tags 
                        SET tag_category = $1
                        WHERE tag_id = $2
                    `, [fix.category, existingTag.rows[0].id]);
                    
                    console.log(`    ✅ Updated ${fix.from} tag and relationships`);
                }
            }
            
            // 3. Fix capacity tags
            console.log('\n💾 Fixing capacity tags...');
            
            const capacityFixes = [
                { from: '128', to: '128GB', category: 'CAPACITY' },
                { from: '256', to: '256GB', category: 'CAPACITY' },
                { from: '512', to: '512GB', category: 'CAPACITY' },
                { from: '1024', to: '1TB', category: 'CAPACITY' },
                { from: '2048', to: '2TB', category: 'CAPACITY' }
            ];
            
            for (const fix of capacityFixes) {
                const existingTag = await client.query(`
                    SELECT id, tag_category FROM sku_tags 
                    WHERE tag_name = $1 AND tag_category != $2
                `, [fix.from, fix.category]);
                
                if (existingTag.rows.length > 0) {
                    console.log(`  🔄 Fixing ${fix.from} from ${existingTag.rows[0].tag_category} to ${fix.category}`);
                    
                    await client.query(`
                        UPDATE sku_tags 
                        SET tag_category = $1, tag_value = $2
                        WHERE tag_name = $3
                    `, [fix.category, fix.to, fix.from]);
                    
                    await client.query(`
                        UPDATE sku_master_tags 
                        SET tag_category = $1
                        WHERE tag_id = $2
                    `, [fix.category, existingTag.rows[0].id]);
                    
                    console.log(`    ✅ Updated ${fix.from} tag and relationships`);
                }
            }
            
            // 4. Show current tag distribution
            console.log('\n📊 Current Tag Distribution by Category:');
            const tagDistribution = await client.query(`
                SELECT tag_category, COUNT(*) as count
                FROM sku_tags 
                GROUP BY tag_category 
                ORDER BY count DESC
            `);
            
            tagDistribution.rows.forEach(row => {
                console.log(`  ${row.tag_category}: ${row.count} tags`);
            });
            
            // Commit transaction
            await client.query('COMMIT');
            console.log('\n✅ Tag category fixes completed successfully!');
            
        } catch (error) {
            // Rollback on error
            await client.query('ROLLBACK');
            throw error;
        }
        
        client.release();
        await pool.end();
        
    } catch (error) {
        console.error('❌ Tag category fix failed:', error.message);
    }
}

// Run the fix
fixTagCategories();

