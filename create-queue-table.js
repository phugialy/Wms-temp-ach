const { Client } = require('pg');
require('dotenv').config();

async function createSkuMatchingQueue() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected successfully');

        // Read the SQL file
        const fs = require('fs');
        const sqlContent = fs.readFileSync('create-sku-matching-queue.sql', 'utf8');
        
        console.log('📝 Executing SQL to create sku_matching_queue table...');
        await client.query(sqlContent);
        
        console.log('✅ sku_matching_queue table created successfully!');
        
        // Verify the table was created
        console.log('🔍 Verifying table creation...');
        const result = await client.query(`
            SELECT 
                table_name,
                column_name,
                data_type,
                is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'sku_matching_queue'
            ORDER BY ordinal_position;
        `);
        
        console.log('📊 Table structure:');
        result.rows.forEach(row => {
            console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
        });
        
        // Check test data
        const testResult = await client.query('SELECT COUNT(*) as count FROM sku_matching_queue');
        console.log(`📈 Test entries created: ${testResult.rows[0].count}`);
        
        // Show queue status
        const statusResult = await client.query(`
            SELECT status, COUNT(*) as count 
            FROM sku_matching_queue 
            GROUP BY status
        `);
        
        console.log('📋 Queue status summary:');
        statusResult.rows.forEach(row => {
            console.log(`  - ${row.status}: ${row.count} entries`);
        });

    } catch (error) {
        console.error('❌ Error creating sku_matching_queue table:', error.message);
        throw error;
    } finally {
        await client.end();
        console.log('🔌 Database connection closed');
    }
}

// Run the function
createSkuMatchingQueue()
    .then(() => {
        console.log('🎉 Phase 1A completed successfully!');
        console.log('📋 Next: Phase 1B - Database Triggers');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Phase 1A failed:', error.message);
        process.exit(1);
    });

