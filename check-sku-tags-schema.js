const { Pool } = require('pg');
require('dotenv').config();

async function checkSkuTagsSchema() {
    console.log('🔍 Checking sku_tags table schema...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Check table structure
        console.log('\n📋 sku_tags table structure:');
        const structureResult = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'sku_tags' 
            ORDER BY ordinal_position
        `);
        
        structureResult.rows.forEach(row => {
            console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
        });
        
        // Check triggers
        console.log('\n🔧 Triggers on sku_tags:');
        const triggerResult = await client.query(`
            SELECT trigger_name, event_manipulation, action_statement
            FROM information_schema.triggers 
            WHERE event_object_table = 'sku_tags'
        `);
        
        if (triggerResult.rows.length > 0) {
            triggerResult.rows.forEach(row => {
                console.log(`  ${row.trigger_name}: ${row.event_manipulation} - ${row.action_statement}`);
            });
        } else {
            console.log('  No triggers found');
        }
        
        // Check sample data
        console.log('\n📊 Sample data from sku_tags:');
        const sampleResult = await client.query(`
            SELECT * FROM sku_tags LIMIT 3
        `);
        
        if (sampleResult.rows.length > 0) {
            console.log('  Columns:', Object.keys(sampleResult.rows[0]));
            sampleResult.rows.forEach((row, index) => {
                console.log(`  Row ${index + 1}:`, row);
            });
        } else {
            console.log('  No data found');
        }
        
        client.release();
        await pool.end();
        
    } catch (error) {
        console.error('❌ Check failed:', error.message);
    }
}

checkSkuTagsSchema();

