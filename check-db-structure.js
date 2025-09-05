const { Pool } = require('pg');
require('dotenv').config();

async function checkDatabaseStructure() {
    console.log('🔍 Checking database structure...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Check sku_master_tags table structure
        console.log('\n📋 sku_master_tags table structure:');
        const structureResult = await client.query(`
            SELECT column_name, is_nullable, data_type, column_default
            FROM information_schema.columns 
            WHERE table_name = 'sku_master_tags' 
            ORDER BY ordinal_position
        `);
        
        structureResult.rows.forEach(row => {
            console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
        });
        
        // Check if there are any existing records with null categories
        console.log('\n🔍 Checking for existing null categories:');
        const nullCheckResult = await client.query(`
            SELECT COUNT(*) as null_count
            FROM sku_master_tags 
            WHERE tag_category IS NULL
        `);
        
        console.log(`  Records with null tag_category: ${nullCheckResult.rows[0].null_count}`);
        
        // Check the actual data being inserted
        console.log('\n📊 Sample of recent sku_master_tags:');
        const sampleResult = await client.query(`
            SELECT * FROM sku_master_tags 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        sampleResult.rows.forEach((row, index) => {
            console.log(`  ${index + 1}. SKU ID: ${row.sku_master_id}, Tag ID: ${row.tag_id}, Position: ${row.tag_position}, Category: ${row.tag_category || 'NULL'}`);
        });
        
        // Check the tags table to see if tags exist
        console.log('\n🏷️  Sample of recent sku_tags:');
        const tagsResult = await client.query(`
            SELECT * FROM sku_tags 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        tagsResult.rows.forEach((row, index) => {
            console.log(`  ${index + 1}. ID: ${row.id}, Name: ${row.tag_name}, Category: ${row.tag_category}, Value: ${row.tag_value}`);
        });
        
        client.release();
        await pool.end();
        console.log('\n✅ Database structure check completed');
        
    } catch (error) {
        console.error('❌ Database check failed:', error.message);
    }
}

checkDatabaseStructure();

