const { Pool } = require('pg');
require('dotenv').config();

async function analyzeDataQuality() {
    console.log('🔍 Analyzing SKU data quality...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // 1. Check NULL values in key columns
        console.log('\n📊 NULL Value Analysis:');
        const nullAnalysis = await client.query(`
            SELECT 
                COUNT(*) as total_skus,
                COUNT(brand) as brands_filled,
                COUNT(model) as models_filled,
                COUNT(capacity) as capacities_filled,
                COUNT(color) as colors_filled,
                COUNT(carrier) as carriers_filled,
                COUNT(post_fix) as post_fixes_filled,
                ROUND(((COUNT(brand)::float / COUNT(*)) * 100)::numeric, 1) as brand_completion,
                ROUND(((COUNT(model)::float / COUNT(*)) * 100)::numeric, 1) as model_completion,
                ROUND(((COUNT(capacity)::float / COUNT(*)) * 100)::numeric, 1) as capacity_completion,
                ROUND(((COUNT(color)::float / COUNT(*)) * 100)::numeric, 1) as color_completion,
                ROUND(((COUNT(carrier)::float / COUNT(*)) * 100)::numeric, 1) as carrier_completion
            FROM sku_master
        `);
        
        const stats = nullAnalysis.rows[0];
        console.log(`  Total SKUs: ${stats.total_skus}`);
        console.log(`  Brand completion: ${stats.brand_completion}% (${stats.brands_filled}/${stats.total_skus})`);
        console.log(`  Model completion: ${stats.model_completion}% (${stats.models_filled}/${stats.total_skus})`);
        console.log(`  Capacity completion: ${stats.capacity_completion}% (${stats.capacities_filled}/${stats.total_skus})`);
        console.log(`  Color completion: ${stats.color_completion}% (${stats.colors_filled}/${stats.total_skus})`);
        console.log(`  Carrier completion: ${stats.carrier_completion}% (${stats.carriers_filled}/${stats.total_skus})`);
        
        // 2. Sample problematic SKUs (where key fields are NULL)
        console.log('\n🚨 Sample Problematic SKUs (NULL key fields):');
        const problematicSkus = await client.query(`
            SELECT id, sku_code, brand, model, capacity, color, carrier, post_fix
            FROM sku_master 
            WHERE brand IS NULL OR model IS NULL OR capacity IS NULL
            ORDER BY id 
            LIMIT 10
        `);
        
        problematicSkus.rows.forEach((sku, index) => {
            console.log(`  ${index + 1}. ID: ${sku.id} | SKU: ${sku.sku_code}`);
            console.log(`     Brand: ${sku.brand || 'NULL'} | Model: ${sku.model || 'NULL'} | Capacity: ${sku.capacity || 'NULL'}`);
            console.log(`     Color: ${sku.color || 'NULL'} | Carrier: ${sku.carrier || 'NULL'} | Post-fix: ${sku.carrier || 'NULL'}`);
            console.log('');
        });
        
        // 3. Check for inconsistent data patterns
        console.log('\n🔍 Data Pattern Analysis:');
        
        // Brand inconsistencies
        const brandPatterns = await client.query(`
            SELECT brand, COUNT(*) as count
            FROM sku_master 
            WHERE brand IS NOT NULL 
            GROUP BY brand 
            ORDER BY count DESC 
            LIMIT 10
        `);
        
        console.log('  Top Brands:');
        brandPatterns.rows.forEach(row => {
            console.log(`    ${row.brand}: ${row.count} SKUs`);
        });
        
        // Model inconsistencies
        const modelPatterns = await client.query(`
            SELECT model, COUNT(*) as count
            FROM sku_master 
            WHERE model IS NOT NULL 
            GROUP BY model 
            ORDER BY count DESC 
            LIMIT 10
        `);
        
        console.log('\n  Top Models:');
        modelPatterns.rows.forEach(row => {
            console.log(`    ${row.model}: ${row.count} SKUs`);
        });
        
        // 4. Check for obvious data entry errors
        console.log('\n⚠️  Potential Data Entry Issues:');
        
        // Mixed case issues
        const caseIssues = await client.query(`
            SELECT COUNT(*) as count
            FROM sku_master 
            WHERE (brand IS NOT NULL AND brand != UPPER(brand) AND brand != LOWER(brand))
               OR (model IS NOT NULL AND model != UPPER(model) AND model != LOWER(model))
        `);
        console.log(`  Mixed case entries: ${caseIssues.rows[0].count}`);
        
        // Extra whitespace
        const whitespaceIssues = await client.query(`
            SELECT COUNT(*) as count
            FROM sku_master 
            WHERE (brand IS NOT NULL AND brand != TRIM(brand))
               OR (model IS NOT NULL AND model != TRIM(model))
        `);
        console.log(`  Whitespace issues: ${whitespaceIssues.rows[0].count}`);
        
        // 5. Sample of well-structured SKUs for comparison
        console.log('\n✅ Sample Well-Structured SKUs:');
        const goodSkus = await client.query(`
            SELECT id, sku_code, brand, model, capacity, color, carrier, post_fix
            FROM sku_master 
            WHERE brand IS NOT NULL 
              AND model IS NOT NULL 
              AND capacity IS NOT NULL
            ORDER BY id 
            LIMIT 5
        `);
        
        goodSkus.rows.forEach((sku, index) => {
            console.log(`  ${index + 1}. ID: ${sku.id} | SKU: ${sku.sku_code}`);
            console.log(`     Brand: ${sku.brand} | Model: ${sku.model} | Capacity: ${sku.capacity}`);
            console.log(`     Color: ${sku.color || 'N/A'} | Carrier: ${sku.carrier || 'N/A'}`);
            console.log('');
        });
        
        client.release();
        await pool.end();
        
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
    }
}

// Run the analysis
analyzeDataQuality();
