const { Client } = require('pg');
require('dotenv').config();

async function testDataInsertion() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL
    });

    try {
        await client.connect();
        console.log('🧪 Testing Data Insertion Flow...\n');

        // Test 1: Insert into lowercase tables (your current system)
        console.log('1️⃣ Testing lowercase table insertion...');
        
        const testImei = '999999999999999';
        const testSku = 'TEST-256-BLK';
        
        // Insert into product table
        await client.query(`
            INSERT INTO product (imei, sku, brand, date_in)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (imei) DO UPDATE SET
                sku = EXCLUDED.sku,
                brand = EXCLUDED.brand,
                updated_at = NOW()
        `, [testImei, testSku, 'Samsung']);

        // Insert into item table
        await client.query(`
            INSERT INTO item (imei, model, carrier, capacity, color, working, location)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (imei) DO UPDATE SET
                model = EXCLUDED.model,
                carrier = EXCLUDED.carrier,
                capacity = EXCLUDED.capacity,
                color = EXCLUDED.color,
                working = EXCLUDED.working,
                location = EXCLUDED.location,
                updated_at = NOW()
        `, [testImei, 'FOLD3', 'UNLOCKED', '256', 'BLACK', 'YES', 'DNCL-Inspection']);

        console.log(`  ✅ Inserted test data: IMEI ${testImei}`);

        // Test 2: Check if data synced to uppercase tables
        console.log('\n2️⃣ Checking data sync to uppercase tables...');
        
        const uppercaseItem = await client.query('SELECT * FROM "Item" WHERE imei = $1', [testImei]);
        console.log(`  Uppercase Item table: ${uppercaseItem.rows.length} items found`);
        
        if (uppercaseItem.rows.length > 0) {
            const item = uppercaseItem.rows[0];
            console.log(`    - SKU: ${item.sku}`);
            console.log(`    - Model: ${item.model}`);
            console.log(`    - Location: ${item.location}`);
            console.log(`    - Working: ${item.working}`);
        }

        // Test 3: Check lowercase tables
        console.log('\n3️⃣ Checking lowercase tables...');
        
        const lowercaseItem = await client.query('SELECT * FROM item WHERE imei = $1', [testImei]);
        const product = await client.query('SELECT * FROM product WHERE imei = $1', [testImei]);
        
        console.log(`  Lowercase item table: ${lowercaseItem.rows.length} items`);
        console.log(`  Product table: ${product.rows.length} products`);

        // Test 4: Test the exact query that frontend would use
        console.log('\n4️⃣ Testing frontend API query...');
        
        try {
            const frontendQuery = await client.query(`
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
            `);
            
            console.log(`  ✅ Frontend query successful: ${frontendQuery.rows.length} items returned`);
            
            if (frontendQuery.rows.length > 0) {
                const item = frontendQuery.rows[0];
                console.log(`    Sample item: ${item.imei} - ${item.sku} - ${item.model}`);
            }
        } catch (error) {
            console.log(`  ❌ Frontend query failed: ${error.message}`);
        }

        // Test 5: Test locations query
        console.log('\n5️⃣ Testing locations query...');
        
        try {
            const locationsQuery = await client.query(`
                SELECT id, name, description, "isActive"
                FROM "Location"
                WHERE "isActive" = true
                ORDER BY name
            `);
            
            console.log(`  ✅ Locations query successful: ${locationsQuery.rows.length} locations`);
        } catch (error) {
            console.log(`  ❌ Locations query failed: ${error.message}`);
        }

        console.log('\n🎉 Data insertion test completed!');
        console.log('\n📊 Summary:');
        console.log(`  - Test IMEI: ${testImei}`);
        console.log(`  - Test SKU: ${testSku}`);
        console.log(`  - Data inserted into lowercase tables`);
        console.log(`  - Data should sync to uppercase tables via triggers`);
        console.log(`  - Frontend queries should now work`);

    } catch (error) {
        console.error('❌ Error during data insertion test:', error.message);
        console.error('Full error:', error);
    } finally {
        await client.end();
    }
}

testDataInsertion();

