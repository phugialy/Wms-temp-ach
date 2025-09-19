const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    const pool = new Pool({
        connectionString: process.env.DIRECT_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔄 Running migration: 039_create_capacity_breakdown_function.sql');
        
        const migrationPath = path.join(__dirname, '..', 'migrations', '039_create_capacity_breakdown_function.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        await pool.query(migrationSQL);
        console.log('✅ Migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
    } finally {
        await pool.end();
    }
}

runMigration();


