const { Pool } = require('pg');
require('dotenv').config();

async function checkSkuMasterStructure() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });
    
    try {
        console.log('🔍 Checking sku_master table structure...');
        
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'sku_master' 
            ORDER BY ordinal_position
        `);
        
        console.log('\n📊 sku_master table columns:');
        result.rows.forEach(row => {
            console.log(`  ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
        });
        
        // Check if device_type and tag_count columns exist
        const hasDeviceType = result.rows.some(row => row.column_name === 'device_type');
        const hasTagCount = result.rows.some(row => row.column_name === 'tag_count');
        
        console.log('\n🔍 Phase 1 Migration Status:');
        console.log(`  device_type column: ${hasDeviceType ? '✅ EXISTS' : '❌ MISSING'}`);
        console.log(`  tag_count column: ${hasTagCount ? '✅ EXISTS' : '❌ MISSING'}`);
        
        if (!hasDeviceType || !hasTagCount) {
            console.log('\n⚠️  Some Phase 1 columns are missing. Please run the migration first.');
        }
        
    } catch (error) {
        console.error('❌ Error checking table structure:', error);
    } finally {
        await pool.end();
    }
}

checkSkuMasterStructure();

