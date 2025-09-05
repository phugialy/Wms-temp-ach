const { Pool } = require('pg');
require('dotenv').config();

async function analyzePostfixes() {
    console.log('🔍 Analyzing POSTFIX patterns in SKU database...');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
            idleTimeoutMillis: 0,
            connectionTimeoutMillis: 30000,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Get all SKUs with their postfix patterns
        const result = await client.query(`
            SELECT sku_code, sku_tags
            FROM sku_master 
            WHERE sku_tags IS NOT NULL AND array_length(sku_tags, 1) > 0
            ORDER BY sku_code
        `);
        
        console.log(`📋 Analyzing ${result.rows.length} SKUs...`);
        
        // Analyze postfix patterns
        const postfixPatterns = new Map();
        const skuWithPostfix = [];
        const skuWithoutPostfix = [];
        
        result.rows.forEach(row => {
            const skuCode = row.sku_code;
            const tags = row.sku_tags;
            
            // Split SKU into segments
            const segments = skuCode.split('-');
            
            if (segments.length > 3) {
                // Has postfix(es)
                const postfixes = segments.slice(3); // Everything after the 3rd segment
                skuWithPostfix.push({
                    sku: skuCode,
                    postfixes: postfixes,
                    tags: tags
                });
                
                // Count each postfix
                postfixes.forEach(postfix => {
                    const count = postfixPatterns.get(postfix) || 0;
                    postfixPatterns.set(postfix, count + 1);
                });
            } else {
                // No postfix
                skuWithoutPostfix.push({
                    sku: skuCode,
                    tags: tags
                });
            }
        });
        
        // Sort postfixes by frequency
        const sortedPostfixes = Array.from(postfixPatterns.entries())
            .sort((a, b) => b[1] - a[1]);
        
        console.log(`\n📊 POSTFIX Analysis Results:`);
        console.log(`  SKUs with postfix: ${skuWithPostfix.length}`);
        console.log(`  SKUs without postfix: ${skuWithoutPostfix.length}`);
        console.log(`  Total unique postfixes: ${postfixPatterns.size}`);
        
        console.log(`\n🏷️  Most Common Postfixes:`);
        sortedPostfixes.slice(0, 20).forEach(([postfix, count], index) => {
            console.log(`  ${index + 1}. ${postfix} (${count} occurrences)`);
        });
        
        // Check our current filter coverage
        const currentFilters = ['VG', 'UV', 'ACCEPTABLE', 'UL', 'LN', 'NEW', 'TMO', 'ATT'];
        const coveredPostfixes = new Set();
        const missedPostfixes = new Set();
        
        sortedPostfixes.forEach(([postfix, count]) => {
            if (currentFilters.includes(postfix)) {
                coveredPostfixes.add(postfix);
            } else {
                missedPostfixes.add(postfix);
            }
        });
        
        console.log(`\n✅ POSTFIX Filter Coverage:`);
        console.log(`  Covered by current filters: ${coveredPostfixes.size}`);
        console.log(`  Missed by current filters: ${missedPostfixes.size}`);
        
        if (missedPostfixes.size > 0) {
            console.log(`\n❌ MISSED Postfixes (not in current filter):`);
            Array.from(missedPostfixes).slice(0, 10).forEach(postfix => {
                const count = postfixPatterns.get(postfix);
                console.log(`  • ${postfix} (${count} occurrences)`);
            });
        }
        
        // Show some examples of SKUs with postfix
        console.log(`\n📋 Examples of SKUs with postfix:`);
        skuWithPostfix.slice(0, 10).forEach(sku => {
            console.log(`  • ${sku.sku} → Postfixes: [${sku.postfixes.join(', ')}]`);
        });
        
        // Show some examples of SKUs without postfix
        console.log(`\n📋 Examples of SKUs without postfix:`);
        skuWithoutPostfix.slice(0, 10).forEach(sku => {
            console.log(`  • ${sku.sku}`);
        });
        
        client.release();
        await pool.end();
        console.log('\n✅ Postfix analysis completed!');
        
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
    }
}

// Run the postfix analysis
analyzePostfixes();

