const { Client } = require('pg');
require('dotenv').config();

async function createOperatorTables() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected successfully');

        // Read the SQL file
        const fs = require('fs');
        const sqlContent = fs.readFileSync('create-operator-tables.sql', 'utf8');
        
        console.log('📝 Executing SQL to create operator tables...');
        await client.query(sqlContent);
        
        console.log('✅ Operator tables created successfully!');
        
        // Verify the tables were created
        console.log('🔍 Verifying table creation...');
        const result = await client.query(`
            SELECT 
                table_name,
                column_name,
                data_type,
                is_nullable
            FROM information_schema.columns 
            WHERE table_name IN ('operator_actions', 'location_transitions')
            ORDER BY table_name, ordinal_position;
        `);
        
        console.log('📊 Table structure:');
        let currentTable = '';
        result.rows.forEach(row => {
            if (row.table_name !== currentTable) {
                console.log(`\n  📋 ${row.table_name}:`);
                currentTable = row.table_name;
            }
            console.log(`    - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
        });
        
        // Check test data
        const testResult = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM operator_actions) as operator_actions_count,
                (SELECT COUNT(*) FROM location_transitions) as location_transitions_count
        `);
        
        console.log('\n📈 Test data created:');
        console.log(`  - operator_actions: ${testResult.rows[0].operator_actions_count} entries`);
        console.log(`  - location_transitions: ${testResult.rows[0].location_transitions_count} entries`);

    } catch (error) {
        console.error('❌ Error creating operator tables:', error.message);
        throw error;
    } finally {
        await client.end();
        console.log('🔌 Database connection closed');
    }
}

// Run the function
createOperatorTables()
    .then(() => {
        console.log('🎉 Operator tables created successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Failed to create operator tables:', error.message);
        process.exit(1);
    });

