const { Client } = require('pg');
require('dotenv').config();

async function getRealImeis() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL
    });

    try {
        await client.connect();
        
        const result = await client.query(`
            SELECT imei, model, capacity, color, carrier, device_notes 
            FROM sku_matching_view 
            WHERE model IS NOT NULL 
            AND capacity IS NOT NULL 
            AND color IS NOT NULL 
            LIMIT 3
        `);
        
        console.log('Real IMEIs with complete data:');
        result.rows.forEach((row, i) => {
            console.log(`${i+1}. IMEI: ${row.imei}`);
            console.log(`   Model: ${row.model}, Capacity: ${row.capacity}, Color: ${row.color}`);
            console.log(`   Carrier: ${row.carrier}, Notes: ${row.device_notes || 'None'}`);
            console.log('');
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

getRealImeis();

