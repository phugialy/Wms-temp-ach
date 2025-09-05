const { Pool } = require('pg');
require('dotenv').config();

async function testSingleConnection() {
    console.log('Testing single connection approach with DATABASE_URL...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
            idleTimeoutMillis: 0,
            connectionTimeoutMillis: 30000,
        });
        
        const client = await pool.connect();
        console.log('✅ Single connection established');
        
        // Test multiple queries on same connection
        for (let i = 0; i < 5; i++) {
            const result = await client.query('SELECT $1 as test', [i + 1]);
            console.log(`Query ${i + 1}:`, result.rows[0]);
        }
        
        client.release();
        await pool.end();
        console.log('✅ All tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testSingleConnection();