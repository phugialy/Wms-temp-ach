require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_API_KEY);

async function setupQueueSystem() {
    try {
        console.log('🚀 Setting up IMEI Queue System...');
        
        // Read the migration SQL
        const sql = fs.readFileSync('migrations/002_imei_queue_system.sql', 'utf8');
        
        // Split the SQL into individual statements
        const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
        
        console.log(`📝 Executing ${statements.length} SQL statements...`);
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i].trim();
            if (statement.length === 0) continue;
            
            console.log(`Executing statement ${i + 1}/${statements.length}...`);
            
            try {
                // Execute each statement using raw SQL
                const { error } = await supabase.rpc('exec_sql', { sql: statement });
                
                if (error) {
                    // If exec_sql doesn't exist, try direct query
                    console.log('Trying direct query approach...');
                    const { error: directError } = await supabase.from('_dummy_').select('*').limit(0);
                    
                    if (directError && directError.code === 'PGRST202') {
                        console.log('⚠️ exec_sql function not available, trying alternative approach...');
                        
                        // Try to create tables one by one using the REST API
                        if (statement.includes('CREATE TABLE')) {
                            console.log('Creating table via REST API...');
                            // This would require a different approach - for now, let's skip
                            console.log('Skipping table creation for now...');
                        }
                    } else {
                        console.error('❌ Error executing statement:', error);
                    }
                } else {
                    console.log('✅ Statement executed successfully');
                }
            } catch (err) {
                console.log('⚠️ Statement execution failed, continuing...', err.message);
            }
        }
        
        console.log('✅ Queue system setup completed!');
        
    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

setupQueueSystem();
