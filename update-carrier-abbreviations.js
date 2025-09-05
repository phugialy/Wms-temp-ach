const { Pool } = require('pg');
require('dotenv').config();

async function updateCarrierAbbreviations() {
    console.log('🔄 UPDATING CARRIER ABBREVIATIONS...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
            idleTimeoutMillis: 0,
            connectionTimeoutMillis: 30000,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Comprehensive carrier abbreviations
        const carrierAbbreviations = [
            // AT&T variations
            { abbreviation: 'ATT', full_form: 'AT&T' },
            { abbreviation: 'AT&T', full_form: 'AT&T' },
            
            // T-Mobile variations  
            { abbreviation: 'TMO', full_form: 'T-Mobile' },
            { abbreviation: 'TMobile', full_form: 'T-Mobile' },
            { abbreviation: 'T-Mobile', full_form: 'T-Mobile' },
            
            // Verizon variations
            { abbreviation: 'VRZ', full_form: 'Verizon' },
            { abbreviation: 'VZ', full_form: 'Verizon' },
            { abbreviation: 'VERIZON', full_form: 'Verizon' },
            
            // Xfinity variations
            { abbreviation: 'XFI', full_form: 'Xfinity' },
            { abbreviation: 'XFINITY', full_form: 'Xfinity' },
            
            // Spectrum
            { abbreviation: 'SPECTRUM', full_form: 'Spectrum' },
            
            // Tracfone
            { abbreviation: 'TRACFONE', full_form: 'Tracfone' },
            
            // Sprint (legacy)
            { abbreviation: 'SPRINT', full_form: 'Sprint' }
        ];
        
        console.log(`\n📝 Inserting ${carrierAbbreviations.length} carrier abbreviations...`);
        
        for (const mapping of carrierAbbreviations) {
            try {
                await client.query(`
                    INSERT INTO abbreviation_mappings (category, abbreviation, full_value, is_active, created_at, updated_at)
                    VALUES ('carrier', $1, $2, true, NOW(), NOW())
                    ON CONFLICT (category, abbreviation) 
                    DO UPDATE SET 
                        full_value = EXCLUDED.full_value,
                        is_active = true,
                        updated_at = NOW()
                `, [mapping.abbreviation, mapping.full_form]);
                
                console.log(`  ✅ ${mapping.abbreviation} → ${mapping.full_form}`);
            } catch (error) {
                console.error(`  ❌ Failed to insert ${mapping.abbreviation}:`, error.message);
            }
        }
        
        // Verify the insertions
        const result = await client.query(`
            SELECT * FROM abbreviation_mappings 
            WHERE category = 'carrier'
            ORDER BY abbreviation
        `);
        
        console.log(`\n📋 Final Carrier Abbreviations (${result.rows.length}):`);
        result.rows.forEach(row => {
            console.log(`  ${row.abbreviation} → ${row.full_value}`);
        });
        
        client.release();
        await pool.end();
        
        console.log('\n✅ Carrier abbreviations updated successfully!');
        
    } catch (error) {
        console.error('❌ Update failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the update
updateCarrierAbbreviations();
