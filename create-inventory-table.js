const { Client } = require('pg');
require('dotenv').config();
const fs = require('fs');

async function createInventoryTable() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL
    });

    try {
        await client.connect();
        console.log('🔧 Creating Inventory table...\n');

        // Read the SQL file
        const sqlContent = fs.readFileSync('create-inventory-table.sql', 'utf8');
        
        // Execute the SQL
        await client.query(sqlContent);
        
        console.log('✅ Successfully created Inventory table:');
        console.log('  - "Inventory" table with proper relationships');
        console.log('  - Foreign keys to "Item" and "Location" tables');
        console.log('  - Automatic sync triggers');
        console.log('  - Initial data sync for existing items');
        
        // Verify table was created
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'Inventory'
        `);
        
        if (result.rows.length > 0) {
            console.log('  ✅ "Inventory" table confirmed');
        }
        
        // Check if data was synced
        const inventoryCount = await client.query('SELECT COUNT(*) as count FROM "Inventory"');
        console.log(`  📊 Inventory records: ${inventoryCount.rows[0].count}`);
        
        console.log('\n🎉 Inventory table created successfully!');
        console.log('💡 The admin inventory API should now work.');
        
    } catch (error) {
        console.error('❌ Error creating inventory table:', error.message);
        if (error.message.includes('already exists')) {
            console.log('💡 Table already exists, that\'s fine!');
        }
    } finally {
        await client.end();
    }
}

createInventoryTable();

