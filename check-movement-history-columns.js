require('dotenv').config();
const { Client } = require('pg');

async function checkMovementHistoryColumns() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    
    try {
        await client.connect();
        console.log('🔗 Connected to database');
        
        const result = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'movement_history' 
            ORDER BY ordinal_position
        `);
        
        console.log('\nMovement History table columns:');
        result.rows.forEach(row => {
            console.log(`  ${row.column_name} (${row.data_type})`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

checkMovementHistoryColumns();
