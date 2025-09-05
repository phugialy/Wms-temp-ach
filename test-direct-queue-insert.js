const { Client } = require('pg');
require('dotenv').config();

async function testDirectInsert() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL
    });

    try {
        await client.connect();
        console.log('🔌 Connected to database directly');

        // Test inserting into data_queue
        const testData = {
            imei: "123456789012345",
            name: "Test Device",
            brand: "Samsung",
            model: "Test Model"
        };

        console.log('📝 Inserting test data into data_queue...');
        
        const result = await client.query(`
            INSERT INTO data_queue (raw_data, status, source)
            VALUES ($1, $2, $3)
            RETURNING id, status, created_at
        `, [JSON.stringify(testData), 'pending', 'test']);

        console.log('✅ Direct insert successful:', result.rows[0]);

        // Now test if we can retrieve it
        const selectResult = await client.query(`
            SELECT id, raw_data, status, source, created_at 
            FROM data_queue 
            WHERE id = $1
        `, [result.rows[0].id]);

        console.log('📄 Retrieved data:', selectResult.rows[0]);

        // Clean up the test record
        await client.query('DELETE FROM data_queue WHERE id = $1', [result.rows[0].id]);
        console.log('🧹 Test record cleaned up');

        console.log('\n🎉 Direct PostgreSQL operations work fine!');
        console.log('💡 The issue is likely with Supabase client schema caching.');

    } catch (error) {
        console.error('❌ Direct database operation failed:', error.message);
        console.error('Full error:', error);
    } finally {
        await client.end();
    }
}

testDirectInsert();


