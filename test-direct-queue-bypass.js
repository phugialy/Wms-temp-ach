const { Client } = require('pg');
require('dotenv').config();

async function testDirectQueueBypass() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL
    });

    try {
        await client.connect();
        console.log('🔌 Connected to database directly');

        // Test the exact same operation that the queue service is trying to do
        console.log('🧪 Testing direct queue insert (bypassing Supabase)...');
        
        const testData = {
            imei: "123456789012345",
            name: "Test Device",
            brand: "Samsung",
            model: "Test Model"
        };

        // This is exactly what the ImeiQueueService is trying to do
        const result = await client.query(`
                    INSERT INTO data_queue (raw_data, source, status)
        VALUES ($1, $2, $3)
        RETURNING id, status, created_at
    `, [JSON.stringify(testData), 'test', 'pending']);

        console.log('✅ Direct queue insert successful:', result.rows[0]);

        // Now test if we can retrieve it
        const selectResult = await client.query(`
            SELECT id, raw_data, status, created_at 
            FROM data_queue 
            WHERE id = $1
        `, [result.rows[0].id]);

        console.log('📄 Retrieved queue item:', selectResult.rows[0]);

        // Clean up
        await client.query('DELETE FROM data_queue WHERE id = $1', [result.rows[0].id]);
        console.log('🧹 Test record cleaned up');

        console.log('\n🎉 Direct PostgreSQL queue operations work perfectly!');
        console.log('💡 The issue is definitely Supabase PostgREST schema caching.');
        console.log('🔧 Solution: We can bypass Supabase for queue operations.');

    } catch (error) {
        console.error('❌ Direct queue operation failed:', error.message);
        console.error('Full error:', error);
    } finally {
        await client.end();
    }
}

testDirectQueueBypass();
