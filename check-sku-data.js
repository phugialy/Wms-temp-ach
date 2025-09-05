const { Pool } = require('pg');
require('dotenv').config();

async function checkSkuData() {
    console.log('🔍 Checking actual data in sku_master table...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Check table structure
        console.log('\n📋 Table structure:');
        const structureResult = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'sku_master' 
            ORDER BY ordinal_position
        `);
        
        structureResult.rows.forEach(row => {
            console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
        });
        
        // Check sample data
        console.log('\n📊 Sample data (first 5 rows):');
        const sampleResult = await client.query(`
            SELECT id, sku_code, brand, model, capacity, color, carrier, post_fix
            FROM sku_master 
            ORDER BY id
            LIMIT 5
        `);
        
        sampleResult.rows.forEach((row, index) => {
            console.log(`\n  Row ${index + 1}:`);
            console.log(`    ID: ${row.id}`);
            console.log(`    SKU: ${row.sku_code}`);
            console.log(`    Brand: ${row.brand || 'NULL'}`);
            console.log(`    Model: ${row.model || 'NULL'}`);
            console.log(`    Capacity: ${row.capacity || 'NULL'}`);
            console.log(`    Color: ${row.color || 'NULL'}`);
            console.log(`    Carrier: ${row.carrier || 'NULL'}`);
            console.log(`    Post Fix: ${row.post_fix || 'NULL'}`);
        });
        
        // Check NULL counts
        console.log('\n📈 NULL value counts:');
        const nullCounts = await client.query(`
            SELECT 
                COUNT(*) as total_rows,
                COUNT(brand) as brand_not_null,
                COUNT(model) as model_not_null,
                COUNT(capacity) as capacity_not_null,
                COUNT(color) as color_not_null,
                COUNT(carrier) as carrier_not_null,
                COUNT(post_fix) as post_fix_not_null
            FROM sku_master
        `);
        
        const counts = nullCounts.rows[0];
        console.log(`  Total rows: ${counts.total_rows}`);
        console.log(`  Brand (not null): ${counts.brand_not_null}/${counts.total_rows}`);
        console.log(`  Model (not null): ${counts.model_not_null}/${counts.total_rows}`);
        console.log(`  Capacity (not null): ${counts.capacity_not_null}/${counts.total_rows}`);
        console.log(`  Color (not null): ${counts.color_not_null}/${counts.total_rows}`);
        console.log(`  Carrier (not null): ${counts.carrier_not_null}/${counts.total_rows}`);
        console.log(`  Post Fix (not null): ${counts.post_fix_not_null}/${counts.total_rows}`);
        
        client.release();
        await pool.end();
        
    } catch (error) {
        console.error('❌ Check failed:', error.message);
    }
}

checkSkuData();

