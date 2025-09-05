const { Pool } = require('pg');
require('dotenv').config();

async function createAbbreviationTable() {
    console.log('🔧 Creating abbreviation mappings table...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Check if table exists
        const tableExists = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'abbreviation_mappings'
            );
        `);
        
        if (!tableExists.rows[0].exists) {
            console.log('📝 Creating abbreviation_mappings table...');
            
            // Create the table
            await client.query(`
                CREATE TABLE abbreviation_mappings (
                    id SERIAL PRIMARY KEY,
                    abbreviation VARCHAR(50) NOT NULL,
                    full_value VARCHAR(100) NOT NULL,
                    category VARCHAR(20) NOT NULL,
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    
                    UNIQUE(abbreviation, category)
                );
            `);
            
            console.log('✅ Created abbreviation_mappings table');
            
            // Insert initial data
            console.log('📝 Inserting initial abbreviation data...');
            await client.query(`
                INSERT INTO abbreviation_mappings (abbreviation, full_value, category) VALUES
                ('GRN', 'GREEN', 'COLOR'),
                ('SLV', 'SILVER', 'COLOR'),
                ('BLK', 'BLACK', 'COLOR'),
                ('WHT', 'WHITE', 'COLOR'),
                ('GLD', 'GOLD', 'COLOR'),
                ('TMO', 'T-MOBILE', 'CARRIER'),
                ('VG', 'VERIZON', 'CARRIER'),
                ('ATT', 'AT&T', 'CARRIER'),
                ('SPR', 'SPRINT', 'CARRIER'),
                ('UNL', 'UNLOCKED', 'POSTFIX'),
                ('LKD', 'LOCKED', 'POSTFIX'),
                ('INT', 'INTERNATIONAL', 'POSTFIX')
                ON CONFLICT (abbreviation, category) DO NOTHING;
            `);
            
            console.log('✅ Inserted initial abbreviation data');
            
        } else {
            console.log('ℹ️  abbreviation_mappings table already exists');
        }
        
        // Verify the table
        console.log('\n📋 Verifying abbreviation_mappings table:');
        const structureResult = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'abbreviation_mappings' 
            ORDER BY ordinal_position
        `);
        
        structureResult.rows.forEach(row => {
            console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
        });
        
        // Show sample data
        console.log('\n📊 Sample abbreviation data:');
        const sampleData = await client.query(`
            SELECT abbreviation, full_value, category 
            FROM abbreviation_mappings 
            ORDER BY category, abbreviation 
            LIMIT 10
        `);
        
        sampleData.rows.forEach(row => {
            console.log(`  ${row.category}: ${row.abbreviation} → ${row.full_value}`);
        });
        
        client.release();
        await pool.end();
        
        console.log('\n✅ Abbreviation table setup completed!');
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
    }
}

// Run the setup
createAbbreviationTable();

