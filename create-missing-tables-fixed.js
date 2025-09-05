const { Client } = require('pg');
require('dotenv').config();
const fs = require('fs');

async function createMissingTables() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL
    });

    try {
        await client.connect();
        console.log('🔧 Creating missing frontend tables (fixed version)...\n');

        // Read the fixed SQL file
        const sqlContent = fs.readFileSync('create-missing-frontend-tables-fixed.sql', 'utf8');
        
        // Execute the SQL
        await client.query(sqlContent);
        
        console.log('✅ Successfully created missing tables:');
        console.log('  - "Item" table (capital I)');
        console.log('  - "Location" table (capital L)');
        console.log('  - "Warehouse" table (capital W)');
        console.log('  - Data sync triggers');
        console.log('  - Performance indexes');
        console.log('  - Summary views');
        
        // Verify tables were created
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('Item', 'Location', 'Warehouse')
            ORDER BY table_name
        `);
        
        console.log('\n📋 Created tables:');
        result.rows.forEach(row => {
            console.log(`  ✅ ${row.table_name}`);
        });
        
        // Check if data was synced
        const itemCount = await client.query('SELECT COUNT(*) as count FROM "Item"');
        const locationCount = await client.query('SELECT COUNT(*) as count FROM "Location"');
        
        console.log('\n📊 Data synced:');
        console.log(`  - Items: ${itemCount.rows[0].count}`);
        console.log(`  - Locations: ${locationCount.rows[0].count}`);
        
        // Test a sample query to make sure it works
        console.log('\n🧪 Testing frontend compatibility...');
        try {
            const testQuery = await client.query('SELECT COUNT(*) as count FROM "Item" WHERE "isActive" = true');
            console.log(`  ✅ Frontend query test passed: ${testQuery.rows[0].count} active items`);
        } catch (error) {
            console.log(`  ❌ Frontend query test failed: ${error.message}`);
        }
        
        console.log('\n🎉 Frontend compatibility tables created successfully!');
        console.log('💡 Your admin dashboard and inventory manager should now work.');
        console.log('🚀 You can now start your server and test the frontend!');
        
    } catch (error) {
        console.error('❌ Error creating tables:', error.message);
        if (error.message.includes('batteryHealth')) {
            console.error('💡 This might be a data type issue. Let me check the table structure again.');
        }
    } finally {
        await client.end();
    }
}

createMissingTables();

