const { Client } = require('pg');
require('dotenv').config();

async function debugDatabaseAndAPIs() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL
    });

    try {
        await client.connect();
        console.log('🔍 Debugging Database Structure and Data...\n');

        // 1. Check all tables
        console.log('1️⃣ Current Database Tables:');
        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        tables.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });

        // 2. Check Item table structure and data
        console.log('\n2️⃣ "Item" Table Analysis:');
        const itemStructure = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'Item' 
            AND table_schema = 'public'
            ORDER BY ordinal_position
        `);
        
        console.log('  Structure:');
        itemStructure.rows.forEach(row => {
            console.log(`    - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
        });

        const itemCount = await client.query('SELECT COUNT(*) as count FROM "Item"');
        console.log(`  Data Count: ${itemCount.rows[0].count} items`);

        if (itemCount.rows[0].count > 0) {
            const sampleItems = await client.query('SELECT * FROM "Item" LIMIT 3');
            console.log('  Sample Data:');
            sampleItems.rows.forEach((item, index) => {
                console.log(`    Item ${index + 1}: IMEI=${item.imei}, SKU=${item.sku}, Model=${item.model}, Location=${item.location}`);
            });
        }

        // 3. Check lowercase item table
        console.log('\n3️⃣ "item" Table Analysis:');
        const lowercaseItemCount = await client.query('SELECT COUNT(*) as count FROM item');
        console.log(`  Data Count: ${lowercaseItemCount.rows[0].count} items`);

        if (lowercaseItemCount.rows[0].count > 0) {
            const sampleLowercaseItems = await client.query('SELECT * FROM item LIMIT 3');
            console.log('  Sample Data:');
            sampleLowercaseItems.rows.forEach((item, index) => {
                console.log(`    Item ${index + 1}: IMEI=${item.imei}, Model=${item.model}, Location=${item.location}`);
            });
        }

        // 4. Check Location table
        console.log('\n4️⃣ "Location" Table Analysis:');
        const locationCount = await client.query('SELECT COUNT(*) as count FROM "Location"');
        console.log(`  Data Count: ${locationCount.rows[0].count} locations`);

        if (locationCount.rows[0].count > 0) {
            const locations = await client.query('SELECT name, description FROM "Location" ORDER BY name');
            console.log('  Available Locations:');
            locations.rows.forEach(loc => {
                console.log(`    - ${loc.name}: ${loc.description}`);
            });
        }

        // 5. Check product table
        console.log('\n5️⃣ "product" Table Analysis:');
        const productCount = await client.query('SELECT COUNT(*) as count FROM product');
        console.log(`  Data Count: ${productCount.rows[0].count} products`);

        // 6. Test the exact query that the frontend API would use
        console.log('\n6️⃣ Testing Frontend API Queries:');
        
        try {
            // Test inventory query (what admin dashboard would use)
            const inventoryQuery = await client.query(`
                SELECT 
                    i.id,
                    i.imei,
                    i.sku,
                    i.brand,
                    i.model,
                    i.carrier,
                    i.color,
                    i.storage,
                    i.working,
                    i."batteryHealth",
                    i.location,
                    i."createdAt",
                    i."updatedAt"
                FROM "Item" i
                WHERE i."isActive" = true
                ORDER BY i."createdAt" DESC
                LIMIT 10
            `);
            console.log(`  ✅ Inventory Query: ${inventoryQuery.rows.length} items returned`);
        } catch (error) {
            console.log(`  ❌ Inventory Query Failed: ${error.message}`);
        }

        try {
            // Test locations query
            const locationsQuery = await client.query(`
                SELECT id, name, description, "isActive"
                FROM "Location"
                WHERE "isActive" = true
                ORDER BY name
            `);
            console.log(`  ✅ Locations Query: ${locationsQuery.rows.length} locations returned`);
        } catch (error) {
            console.log(`  ❌ Locations Query Failed: ${error.message}`);
        }

        // 7. Check if there are any data sync issues
        console.log('\n7️⃣ Data Sync Analysis:');
        const syncCheck = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM item) as lowercase_count,
                (SELECT COUNT(*) FROM "Item") as uppercase_count,
                (SELECT COUNT(*) FROM product) as product_count
        `);
        
        const counts = syncCheck.rows[0];
        console.log(`  Lowercase item table: ${counts.lowercase_count} items`);
        console.log(`  Uppercase Item table: ${counts.uppercase_count} items`);
        console.log(`  Product table: ${counts.product_count} products`);
        
        if (counts.lowercase_count > 0 && counts.uppercase_count === 0) {
            console.log('  ⚠️  WARNING: Data exists in lowercase table but not synced to uppercase table!');
        }

        // 8. Check triggers
        console.log('\n8️⃣ Database Triggers:');
        const triggers = await client.query(`
            SELECT trigger_name, event_manipulation, event_object_table
            FROM information_schema.triggers
            WHERE trigger_schema = 'public'
            ORDER BY trigger_name
        `);
        
        if (triggers.rows.length > 0) {
            triggers.rows.forEach(trigger => {
                console.log(`  - ${trigger.trigger_name} on ${trigger.event_object_table} (${trigger.event_manipulation})`);
            });
        } else {
            console.log('  ❌ No triggers found - data sync may not be working');
        }

    } catch (error) {
        console.error('❌ Error during debugging:', error.message);
        console.error('Full error:', error);
    } finally {
        await client.end();
    }
}

debugDatabaseAndAPIs();

