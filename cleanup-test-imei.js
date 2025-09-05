const { Client } = require('pg');
require('dotenv').config();

async function cleanupTestImei() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL
    });

    try {
        await client.connect();
        console.log('🧹 Cleaning up test IMEI data...\n');

        const testImei = '999999999999999';
        
        // Check what data exists for this IMEI
        console.log('1️⃣ Checking existing data for test IMEI...');
        
        const checks = await Promise.all([
            client.query('SELECT COUNT(*) as count FROM product WHERE imei = $1', [testImei]),
            client.query('SELECT COUNT(*) as count FROM item WHERE imei = $1', [testImei]),
            client.query('SELECT COUNT(*) as count FROM "Item" WHERE imei = $1', [testImei]),
            client.query('SELECT COUNT(*) as count FROM "Inventory" WHERE item_id IN (SELECT id FROM "Item" WHERE imei = $1)', [testImei]),
            client.query('SELECT COUNT(*) as count FROM sku_matching_results WHERE imei = $1', [testImei]),
            client.query('SELECT COUNT(*) as count FROM sku_matching_queue WHERE imei = $1', [testImei]),
            client.query('SELECT COUNT(*) as count FROM device_test WHERE imei = $1', [testImei]),
            client.query('SELECT COUNT(*) as count FROM operator_actions WHERE imei = $1', [testImei]),
            client.query('SELECT COUNT(*) as count FROM movement_history WHERE imei = $1', [testImei])
        ]);

        const counts = {
            product: checks[0].rows[0].count,
            item: checks[1].rows[0].count,
            Item: checks[2].rows[0].count,
            Inventory: checks[3].rows[0].count,
            sku_matching_results: checks[4].rows[0].count,
            sku_matching_queue: checks[5].rows[0].count,
            device_test: checks[6].rows[0].count,
            operator_actions: checks[7].rows[0].count,
            movement_history: checks[8].rows[0].count
        };

        console.log('📊 Found data in:');
        Object.entries(counts).forEach(([table, count]) => {
            if (count > 0) {
                console.log(`  - ${table}: ${count} records`);
            }
        });

        if (Object.values(counts).every(count => count === 0)) {
            console.log('✅ No test data found - already clean!');
            return;
        }

        // Clean up in the correct order (respecting foreign key constraints)
        console.log('\n2️⃣ Cleaning up test data...');
        
        // Start with tables that have foreign keys to others
        const cleanupQueries = [
            { table: 'operator_actions', query: 'DELETE FROM operator_actions WHERE imei = $1' },
            { table: 'movement_history', query: 'DELETE FROM movement_history WHERE imei = $1' },
            { table: 'sku_matching_results', query: 'DELETE FROM sku_matching_results WHERE imei = $1' },
            { table: 'sku_matching_queue', query: 'DELETE FROM sku_matching_queue WHERE imei = $1' },
            { table: 'device_test', query: 'DELETE FROM device_test WHERE imei = $1' },
            { table: 'Inventory', query: 'DELETE FROM "Inventory" WHERE item_id IN (SELECT id FROM "Item" WHERE imei = $1)' },
            { table: 'Item', query: 'DELETE FROM "Item" WHERE imei = $1' },
            { table: 'item', query: 'DELETE FROM item WHERE imei = $1' },
            { table: 'product', query: 'DELETE FROM product WHERE imei = $1' }
        ];

        for (const { table, query } of cleanupQueries) {
            try {
                const result = await client.query(query, [testImei]);
                if (result.rowCount > 0) {
                    console.log(`  ✅ Cleaned ${result.rowCount} records from ${table}`);
                }
            } catch (error) {
                console.log(`  ⚠️  Could not clean ${table}: ${error.message}`);
            }
        }

        // Verify cleanup
        console.log('\n3️⃣ Verifying cleanup...');
        const finalChecks = await Promise.all([
            client.query('SELECT COUNT(*) as count FROM product WHERE imei = $1', [testImei]),
            client.query('SELECT COUNT(*) as count FROM item WHERE imei = $1', [testImei]),
            client.query('SELECT COUNT(*) as count FROM "Item" WHERE imei = $1', [testImei])
        ]);

        const finalCounts = {
            product: finalChecks[0].rows[0].count,
            item: finalChecks[1].rows[0].count,
            Item: finalChecks[2].rows[0].count
        };

        const totalRemaining = Object.values(finalCounts).reduce((sum, count) => sum + parseInt(count), 0);
        
        if (totalRemaining === 0) {
            console.log('✅ Test IMEI data completely removed!');
        } else {
            console.log(`⚠️  ${totalRemaining} records still remain in:`, Object.entries(finalCounts).filter(([_, count]) => count > 0));
        }

        // Show current database state
        console.log('\n4️⃣ Current database state:');
        const stateChecks = await Promise.all([
            client.query('SELECT COUNT(*) as count FROM product'),
            client.query('SELECT COUNT(*) as count FROM item'),
            client.query('SELECT COUNT(*) as count FROM "Item"'),
            client.query('SELECT COUNT(*) as count FROM "Inventory"')
        ]);

        console.log(`  - product table: ${stateChecks[0].rows[0].count} records`);
        console.log(`  - item table: ${stateChecks[1].rows[0].count} records`);
        console.log(`  - Item table: ${stateChecks[2].rows[0].count} records`);
        console.log(`  - Inventory table: ${stateChecks[3].rows[0].count} records`);

        console.log('\n🎉 Test data cleanup completed!');
        console.log('💡 Your database is now clean and ready for real data import.');

    } catch (error) {
        console.error('❌ Error during cleanup:', error.message);
        console.error('Full error:', error);
    } finally {
        await client.end();
    }
}

cleanupTestImei();

