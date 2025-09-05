const { Client } = require('pg');
require('dotenv').config();

async function forceSchemaRefresh() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL
    });

    try {
        await client.connect();
        console.log('🔌 Connected to database');

        // Method 1: Force PostgREST to refresh schema cache
        console.log('🔄 Attempting to force schema cache refresh...');
        
        // Create a dummy table and drop it to trigger schema refresh
        await client.query(`
            CREATE TABLE IF NOT EXISTS _schema_refresh_trigger (
                id SERIAL PRIMARY KEY,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        await client.query('DROP TABLE _schema_refresh_trigger');
        console.log('✅ Schema refresh trigger executed');

        // Method 2: Verify data_queue table is accessible
        console.log('🔍 Verifying data_queue table access...');
        const result = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'data_queue' 
            AND table_schema = 'public'
            ORDER BY ordinal_position
        `);
        
        console.log('📋 data_queue table structure:');
        result.rows.forEach(row => {
            console.log(`  - ${row.column_name}: ${row.data_type}`);
        });

        // Method 3: Test direct insert to verify table works
        console.log('🧪 Testing direct insert to data_queue...');
        const testData = {
            imei: "999999999999999",
            name: "Schema Test Device",
            test: true
        };

        const insertResult = await client.query(`
            INSERT INTO data_queue (raw_data, status, source)
            VALUES ($1, $2, $3)
            RETURNING id, status, created_at
        `, [JSON.stringify(testData), 'pending', 'schema-test']);

        console.log('✅ Direct insert successful:', insertResult.rows[0]);

        // Clean up test record
        await client.query('DELETE FROM data_queue WHERE id = $1', [insertResult.rows[0].id]);
        console.log('🧹 Test record cleaned up');

        console.log('\n🎉 Schema refresh completed!');
        console.log('💡 The data_queue table is accessible and working.');
        console.log('🔄 Supabase should now recognize the correct table name.');

    } catch (error) {
        console.error('❌ Schema refresh failed:', error.message);
        console.error('Full error:', error);
    } finally {
        await client.end();
    }
}

forceSchemaRefresh();


