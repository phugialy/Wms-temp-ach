const { Client } = require('pg');
require('dotenv').config();

async function createSkuMatchingTriggers() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected successfully');

        // Read the SQL file
        const fs = require('fs');
        const sqlContent = fs.readFileSync('create-sku-matching-triggers.sql', 'utf8');
        
        console.log('📝 Executing SQL to create SKU matching triggers...');
        await client.query(sqlContent);
        
        console.log('✅ SKU matching triggers created successfully!');
        
        // Verify triggers were created
        console.log('🔍 Verifying triggers...');
        const triggerResult = await client.query(`
            SELECT 
                trigger_name,
                event_manipulation,
                event_object_table,
                action_timing
            FROM information_schema.triggers 
            WHERE trigger_name LIKE '%sku_matching%'
            ORDER BY event_object_table, trigger_name;
        `);
        
        console.log('📊 Created triggers:');
        triggerResult.rows.forEach(row => {
            console.log(`  - ${row.trigger_name} on ${row.event_object_table} (${row.action_timing} ${row.event_manipulation})`);
        });
        
        // Check queue entries created by triggers
        const queueResult = await client.query(`
            SELECT 
                COUNT(*) as total_entries,
                COUNT(CASE WHEN source = 'trigger' THEN 1 END) as trigger_entries,
                COUNT(CASE WHEN source = 'manual' THEN 1 END) as manual_entries
            FROM sku_matching_queue
        `);
        
        console.log('📈 Queue entries summary:');
        console.log(`  - Total entries: ${queueResult.rows[0].total_entries}`);
        console.log(`  - Trigger entries: ${queueResult.rows[0].trigger_entries}`);
        console.log(`  - Manual entries: ${queueResult.rows[0].manual_entries}`);
        
        // Show recent trigger activity
        const recentResult = await client.query(`
            SELECT 
                imei,
                source,
                source_reference,
                priority,
                created_at
            FROM sku_matching_queue 
            WHERE source = 'trigger'
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        if (recentResult.rows.length > 0) {
            console.log('🔄 Recent trigger activity:');
            recentResult.rows.forEach(row => {
                console.log(`  - IMEI: ${row.imei}, Source: ${row.source_reference}, Priority: ${row.priority}`);
            });
        }
        
        // Test trigger functionality
        console.log('🧪 Testing trigger functionality...');
        
        // Test 1: Update an existing device's notes
        const testUpdateResult = await client.query(`
            UPDATE device_test 
            SET notes = 'CARRIER UNLOCKED, UPDATED FOR TESTING'
            WHERE imei = '999999999999999'
            RETURNING imei
        `);
        
        if (testUpdateResult.rows.length > 0) {
            console.log('✅ Test update completed - trigger should have fired');
        }
        
        // Check if new queue entry was created
        const newQueueResult = await client.query(`
            SELECT COUNT(*) as new_entries
            FROM sku_matching_queue 
            WHERE imei = '999999999999999' 
            AND source_reference = 'device_notes_update'
        `);
        
        console.log(`📊 New queue entries from test: ${newQueueResult.rows[0].new_entries}`);

    } catch (error) {
        console.error('❌ Error creating SKU matching triggers:', error.message);
        throw error;
    } finally {
        await client.end();
        console.log('🔌 Database connection closed');
    }
}

// Run the function
createSkuMatchingTriggers()
    .then(() => {
        console.log('🎉 Phase 1B completed successfully!');
        console.log('📋 Next: Phase 1C - Agent Worker Service');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Phase 1B failed:', error.message);
        process.exit(1);
    });

