const { Pool } = require('pg');
require('dotenv').config();

async function testSkuParsing() {
    console.log('🔍 Testing SKU parsing step by step...');
    
    try {
        // Test connection
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Test 1: Get SKU count
        const countResult = await client.query('SELECT COUNT(*) FROM sku_master');
        const totalSkus = parseInt(countResult.rows[0].count);
        console.log(`📋 Total SKUs: ${totalSkus}`);
        
        // Test 2: Get first few SKUs
        const skusResult = await client.query(`
            SELECT id, sku_code, brand, model, capacity, color, carrier, post_fix
            FROM sku_master 
            ORDER BY id 
            LIMIT 5
        `);
        
        console.log('📱 First 5 SKUs:');
        skusResult.rows.forEach((sku, index) => {
            console.log(`  ${index + 1}. ${sku.sku_code} (${sku.brand})`);
        });
        
        // Test 3: Check if tag tables exist
        const tagTablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('sku_tags', 'sku_master_tags')
        `);
        
        console.log('🏷️  Tag tables found:', tagTablesResult.rows.map(r => r.table_name));
        
        client.release();
        await pool.end();
        console.log('✅ Test completed successfully');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testSkuParsing();
