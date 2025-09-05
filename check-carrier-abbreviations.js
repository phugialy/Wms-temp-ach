const { Pool } = require('pg');
require('dotenv').config();

async function checkCarrierAbbreviations() {
    console.log('🔍 CHECKING CURRENT CARRIER ABBREVIATIONS...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
            idleTimeoutMillis: 0,
            connectionTimeoutMillis: 30000,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Check current abbreviation mappings
        const result = await client.query(`
            SELECT * FROM abbreviation_mappings 
            WHERE category = 'carrier'
            ORDER BY abbreviation
        `);
        
        console.log(`\n📋 Current Carrier Abbreviations (${result.rows.length}):`);
        result.rows.forEach(row => {
            console.log(`  ${row.abbreviation} → ${row.full_form}`);
        });
        
        // Check what carrier values exist in sku_master
        const carrierResult = await client.query(`
            SELECT DISTINCT carrier, COUNT(*) as count
            FROM sku_master 
            WHERE carrier IS NOT NULL AND carrier != ''
            GROUP BY carrier
            ORDER BY count DESC
        `);
        
        console.log(`\n📊 Carrier values in sku_master (${carrierResult.rows.length}):`);
        carrierResult.rows.forEach(row => {
            console.log(`  "${row.carrier}" (${row.count} SKUs)`);
        });
        
        // Check what carrier tags exist in sku_tags
        const tagResult = await client.query(`
            SELECT tag, COUNT(*) as count
            FROM (
                SELECT unnest(sku_tags) as tag
                FROM sku_master 
                WHERE sku_tags IS NOT NULL
            ) t
            WHERE tag IN ('ATT', 'TMO', 'VRZ', 'VZ', 'XFI', 'SPECTRUM', 'TRACFONE', 'XFINITY')
            GROUP BY tag
            ORDER BY count DESC
        `);
        
        console.log(`\n🏷️  Carrier tags in sku_tags (${tagResult.rows.length}):`);
        tagResult.rows.forEach(row => {
            console.log(`  "${row.tag}" (${row.count} SKUs)`);
        });
        
        client.release();
        await pool.end();
        
    } catch (error) {
        console.error('❌ Check failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the check
checkCarrierAbbreviations();
