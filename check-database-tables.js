const { Client } = require('pg');
require('dotenv').config();

async function checkDatabaseTables() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL
    });

    try {
        await client.connect();
        console.log('🔍 Checking database tables...\n');

        // Get all tables
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);

        console.log('📋 Current database tables:');
        result.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });

        // Check if the problematic tables exist
        const problematicTables = ['Item', 'Location', 'item', 'location'];
        console.log('\n🔍 Checking problematic tables:');
        
        for (const tableName of problematicTables) {
            try {
                const checkResult = await client.query(`
                    SELECT COUNT(*) as count 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                `, [tableName]);
                
                const exists = checkResult.rows[0].count > 0;
                console.log(`  - ${tableName}: ${exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
            } catch (error) {
                console.log(`  - ${tableName}: ❌ ERROR - ${error.message}`);
            }
        }

        // Check what tables the frontend is trying to access
        console.log('\n🎯 Frontend is looking for:');
        console.log('  - "Item" table (capital I)');
        console.log('  - "Location" table (capital L)');
        
        console.log('\n💡 Solution: We need to either:');
        console.log('  1. Create the missing tables with correct names');
        console.log('  2. Update the API to use existing table names');
        console.log('  3. Create aliases/views for compatibility');

    } catch (error) {
        console.error('❌ Error checking database:', error.message);
    } finally {
        await client.end();
    }
}

checkDatabaseTables();

