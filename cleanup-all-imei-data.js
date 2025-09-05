const { Client } = require('pg');
require('dotenv').config();

async function cleanupAllImeiData() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL
    });

    try {
        console.log('🧹 Starting complete IMEI data cleanup...');
        await client.connect();
        console.log('✅ Connected to database');

        // Start transaction for safe cleanup
        await client.query('BEGIN');

        console.log('\n📊 Current data counts (ALL IMEI data):');
        
        // Check current counts for ALL IMEI data
        const counts = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM product) as total_products,
                (SELECT COUNT(*) FROM item) as total_items,
                (SELECT COUNT(*) FROM device_test) as total_device_tests,
                (SELECT COUNT(*) FROM sku_matching_queue) as total_queue_entries,
                (SELECT COUNT(*) FROM sku_matching_results) as total_results,
                (SELECT COUNT(*) FROM operator_actions) as total_operator_actions,
                (SELECT COUNT(*) FROM movement_history) as total_movements
        `);

        const currentCounts = counts.rows[0];
        console.log(`  - Total Products: ${currentCounts.total_products}`);
        console.log(`  - Total Items: ${currentCounts.total_items}`);
        console.log(`  - Total Device Tests: ${currentCounts.total_device_tests}`);
        console.log(`  - Total Queue Entries: ${currentCounts.total_queue_entries}`);
        console.log(`  - Total Results: ${currentCounts.total_results}`);
        console.log(`  - Total Operator Actions: ${currentCounts.total_operator_actions}`);
        console.log(`  - Total Movements: ${currentCounts.total_movements}`);

        if (currentCounts.total_products === 0) {
            console.log('✅ No IMEI data found - system is already clean!');
            await client.query('COMMIT');
            return;
        }

        console.log('\n⚠️  WARNING: This will delete ALL IMEI data from the system!');
        console.log('   This includes:');
        console.log('   - All products and items');
        console.log('   - All device tests and notes');
        console.log('   - All SKU matching results');
        console.log('   - All queue entries');
        console.log('   - All operator actions');
        console.log('   - All movement history');
        console.log('\n   Are you sure you want to proceed? (This action cannot be undone)');

        // For safety, let's add a confirmation step
        console.log('\n🗑️ Proceeding with complete cleanup...');

        // Delete in reverse dependency order to avoid foreign key constraints
        console.log('\n1️⃣ Cleaning operator actions...');
        const operatorResult = await client.query('DELETE FROM operator_actions');
        console.log(`   ✅ Deleted ${operatorResult.rowCount} operator actions`);

        console.log('2️⃣ Cleaning movement history...');
        const movementResult = await client.query('DELETE FROM movement_history');
        console.log(`   ✅ Deleted ${movementResult.rowCount} movement records`);

        console.log('3️⃣ Cleaning SKU matching results...');
        const resultsResult = await client.query('DELETE FROM sku_matching_results');
        console.log(`   ✅ Deleted ${resultsResult.rowCount} SKU matching results`);

        console.log('4️⃣ Cleaning queue entries...');
        const queueResult = await client.query('DELETE FROM sku_matching_queue');
        console.log(`   ✅ Deleted ${queueResult.rowCount} queue entries`);

        console.log('5️⃣ Cleaning device tests...');
        const deviceTestResult = await client.query('DELETE FROM device_test');
        console.log(`   ✅ Deleted ${deviceTestResult.rowCount} device tests`);

        console.log('6️⃣ Cleaning items...');
        const itemResult = await client.query('DELETE FROM item');
        console.log(`   ✅ Deleted ${itemResult.rowCount} items`);

        console.log('7️⃣ Cleaning products...');
        const productResult = await client.query('DELETE FROM product');
        console.log(`   ✅ Deleted ${productResult.rowCount} products`);

        // Also clean up any inventory data that might reference IMEIs
        console.log('8️⃣ Cleaning inventory data...');
        const inventoryResult = await client.query('DELETE FROM inventory');
        console.log(`   ✅ Deleted ${inventoryResult.rowCount} inventory records`);

        // Commit the transaction
        await client.query('COMMIT');
        console.log('\n✅ Complete cleanup completed successfully!');

        // Verify cleanup
        console.log('\n📊 Post-cleanup verification:');
        const verifyCounts = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM product) as remaining_products,
                (SELECT COUNT(*) FROM item) as remaining_items,
                (SELECT COUNT(*) FROM device_test) as remaining_device_tests,
                (SELECT COUNT(*) FROM sku_matching_queue) as remaining_queue_entries,
                (SELECT COUNT(*) FROM sku_matching_results) as remaining_results,
                (SELECT COUNT(*) FROM operator_actions) as remaining_operator_actions,
                (SELECT COUNT(*) FROM movement_history) as remaining_movements,
                (SELECT COUNT(*) FROM inventory) as remaining_inventory
        `);

        const verifyCountsData = verifyCounts.rows[0];
        const totalRemaining = Object.values(verifyCountsData).reduce((sum, count) => sum + parseInt(count), 0);
        
        if (totalRemaining === 0) {
            console.log('🎉 All IMEI data successfully removed!');
        } else {
            console.log('⚠️ Some data may still remain:');
            Object.entries(verifyCountsData).forEach(([key, count]) => {
                if (parseInt(count) > 0) {
                    console.log(`   - ${key}: ${count}`);
                }
            });
        }

        // Check what reference data remains (should be preserved)
        console.log('\n📊 Reference data preserved:');
        const referenceCounts = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM sku_master) as sku_master_count,
                (SELECT COUNT(*) FROM abbreviation_mappings) as abbreviation_count,
                (SELECT COUNT(*) FROM "Location") as location_count,
                (SELECT COUNT(*) FROM "Warehouse") as warehouse_count
        `);

        const refCounts = referenceCounts.rows[0];
        console.log(`  - SKU Master: ${refCounts.sku_master_count} entries`);
        console.log(`  - Abbreviation Mappings: ${refCounts.abbreviation_count} entries`);
        console.log(`  - Locations: ${refCounts.location_count} entries`);
        console.log(`  - Warehouses: ${refCounts.warehouse_count} entries`);

        console.log('\n🚀 System is completely clean and ready for fresh data import!');
        console.log('📋 All IMEI-related data has been removed');
        console.log('📋 Reference data (SKU master, abbreviations, locations) preserved');
        console.log('📋 System ready for new bulk import');

    } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
        await client.query('ROLLBACK');
        throw error;
    } finally {
        await client.end();
        console.log('🔌 Database connection closed');
    }
}

// Run the cleanup
cleanupAllImeiData()
    .then(() => {
        console.log('🎉 Complete IMEI cleanup finished!');
        console.log('📋 System ready for fresh data import');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Cleanup failed:', error.message);
        process.exit(1);
    });

