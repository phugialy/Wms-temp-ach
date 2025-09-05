const { Pool } = require('pg');
require('dotenv').config();

async function checkAbbreviationSchema() {
    console.log('🔍 CHECKING ABBREVIATION_MAPPINGS SCHEMA...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
            idleTimeoutMillis: 0,
            connectionTimeoutMillis: 30000,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Check table schema
        const schemaResult = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'abbreviation_mappings'
            ORDER BY ordinal_position
        `);
        
        console.log(`\n📋 abbreviation_mappings table schema:`);
        schemaResult.rows.forEach(row => {
            console.log(`  ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
        });
        
        // Check if table exists and has data
        const countResult = await client.query(`
            SELECT COUNT(*) as count FROM abbreviation_mappings
        `);
        
        console.log(`\n📊 Total records in abbreviation_mappings: ${countResult.rows[0].count}`);
        
        // Show sample data if any
        if (countResult.rows[0].count > 0) {
            const sampleResult = await client.query(`
                SELECT * FROM abbreviation_mappings LIMIT 5
            `);
            
            console.log(`\n📝 Sample data:`);
            sampleResult.rows.forEach(row => {
                console.log(`  ${JSON.stringify(row)}`);
            });
        }
        
        client.release();
        await pool.end();
        
    } catch (error) {
        console.error('❌ Check failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the check
checkAbbreviationSchema();

