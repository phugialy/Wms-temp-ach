require('dotenv').config();
const { Client } = require('pg');

async function checkItemColumns() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    
    try {
        await client.connect();
        console.log('🔗 Connected to database');
        
        const result = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'item' 
            ORDER BY ordinal_position
        `);
        
        console.log('\nItem table columns:');
        result.rows.forEach(row => {
            console.log(`  ${row.column_name} (${row.data_type})`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

checkItemColumns();
