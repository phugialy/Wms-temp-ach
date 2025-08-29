const { Client } = require('pg');
require('dotenv').config();

async function checkSkuStructure() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log('\n🔍 CHECKING SKU STRUCTURE');
    console.log('==========================');

    // Check for SKUs with post-fix patterns
    const postFixPatterns = ['-VG', '-UV', '-ACCEPTABLE', '-UL', '-LN', '-NEW', '-TEST', '-EXCELLENT', '-GOOD', '-FAIR', '-LIKE'];
    
    console.log('\n📦 Checking SKUs with post-fix patterns:');
    
    for (const pattern of postFixPatterns) {
      const result = await client.query(`
        SELECT sku_code, is_unlocked, source_tab
        FROM sku_master 
        WHERE is_active = true
        AND sku_code LIKE $1
        ORDER BY sku_code
        LIMIT 5
      `, [`%${pattern}%`]);

      if (result.rows.length > 0) {
        console.log(`\n   Pattern: ${pattern}`);
        result.rows.forEach(sku => {
          console.log(`     - ${sku.sku_code} (Unlocked: ${sku.is_unlocked}, Source: ${sku.source_tab})`);
        });
      }
    }

    // Check for the specific problematic SKU
    console.log('\n🔍 Checking specific SKU: FOLD5-1TB-BLUE--UL');
    
    const specificResult = await client.query(`
      SELECT sku_code, is_unlocked, source_tab
      FROM sku_master 
      WHERE sku_code LIKE '%FOLD5%'
      ORDER BY sku_code
    `);

    console.log(`\n📊 Found ${specificResult.rows.length} Fold5 SKUs:`);
    specificResult.rows.forEach(sku => {
      console.log(`   - ${sku.sku_code} (Unlocked: ${sku.is_unlocked}, Source: ${sku.source_tab})`);
    });

    // Test the post-fix filtering query manually
    console.log('\n🧪 Testing post-fix filtering query:');
    
    const testQuery = `
      SELECT sku_code, is_unlocked, source_tab
      FROM sku_master 
      WHERE is_active = true
      AND sku_code LIKE 'FOLD%'
      AND sku_code LIKE '%-%-%-%-%'
      AND sku_code NOT LIKE '%-VG'
      AND sku_code NOT LIKE '%-UV'
      AND sku_code NOT LIKE '%-ACCEPTABLE'
      AND sku_code NOT LIKE '%-UL'
      AND sku_code NOT LIKE '%-LN'
      AND sku_code NOT LIKE '%-NEW'
      AND sku_code NOT LIKE '%-TEST'
      AND sku_code NOT LIKE '%-EXCELLENT'
      AND sku_code NOT LIKE '%-GOOD'
      AND sku_code NOT LIKE '%-FAIR'
      AND sku_code NOT LIKE '%-LIKE'
      ORDER BY sku_code
      LIMIT 10
    `;

    const filteredResult = await client.query(testQuery);
    console.log(`\n📊 Post-fix filtered SKUs (${filteredResult.rows.length}):`);
    filteredResult.rows.forEach(sku => {
      console.log(`   - ${sku.sku_code} (Unlocked: ${sku.is_unlocked})`);
    });

    // Check if the problematic SKU matches our patterns
    console.log('\n🔍 Testing pattern matching:');
    const testSku = 'FOLD5-1TB-BLUE--UL';
    
    postFixPatterns.forEach(pattern => {
      const matches = testSku.includes(pattern);
      console.log(`   "${testSku}" ${matches ? '❌ MATCHES' : '✅ NO MATCH'} pattern "${pattern}"`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkSkuStructure();
