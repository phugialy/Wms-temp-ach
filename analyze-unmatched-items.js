const { Client } = require('pg');
require('dotenv').config();

async function analyzeUnmatchedItems() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Get all unmatched items with detailed information
    const unmatchedItems = await client.query(`
      SELECT 
        smr.imei,
        smr.original_sku,
        smr.match_notes,
        p.brand,
        i.model,
        i.capacity,
        i.color,
        i.carrier,
        dt.notes as device_notes,
        p.sku as product_sku
      FROM sku_matching_results smr
      LEFT JOIN product p ON smr.imei = p.imei
      LEFT JOIN item i ON smr.imei = i.imei
      LEFT JOIN device_test dt ON smr.imei = dt.imei
      WHERE smr.matched_sku IS NULL
      ORDER BY smr.processed_at DESC
    `);

    console.log(`\n🔍 Analyzing ${unmatchedItems.rows.length} Unmatched Items:`);
    console.log('==========================================');

    unmatchedItems.rows.forEach((item, index) => {
      console.log(`\n${index + 1}. IMEI: ${item.imei}`);
      console.log(`   Original SKU: "${item.original_sku}"`);
      console.log(`   Product SKU: "${item.product_sku}"`);
      console.log(`   Brand: ${item.brand || 'NULL'}`);
      console.log(`   Model: ${item.model || 'NULL'}`);
      console.log(`   Capacity: ${item.capacity || 'NULL'}`);
      console.log(`   Color: ${item.color || 'NULL'}`);
      console.log(`   Carrier: ${item.carrier || 'NULL'}`);
      console.log(`   Device Notes: "${item.device_notes || 'NULL'}"`);
      console.log(`   Match Notes: "${item.match_notes || 'NULL'}"`);
      
      // Analyze potential issues
      const issues = [];
      if (!item.brand) issues.push('Missing brand');
      if (!item.model) issues.push('Missing model');
      if (!item.capacity) issues.push('Missing capacity');
      if (!item.color) issues.push('Missing color');
      if (!item.carrier) issues.push('Missing carrier');
      if (item.original_sku === item.product_sku) issues.push('Original SKU same as Product SKU');
      if (!item.match_notes) issues.push('No match notes (possible data issue)');
      
      if (issues.length > 0) {
        console.log(`   🔴 Potential Issues: ${issues.join(', ')}`);
      } else {
        console.log(`   🟡 No obvious data issues - may be missing from sku_master`);
      }
    });

    // Check if these SKUs exist in sku_master
    console.log('\n🔍 Checking if unmatched SKUs exist in sku_master:');
    console.log('==================================================');
    
    for (const item of unmatchedItems.rows) {
      if (item.original_sku && item.original_sku !== 'N/A') {
        const skuCheck = await client.query(`
          SELECT COUNT(*) as count, 
                 STRING_AGG(sku_code, ', ') as existing_skus
          FROM sku_master 
          WHERE sku_code LIKE $1 OR sku_code LIKE $2
        `, [`%${item.original_sku}%`, `%${item.original_sku.replace(/\s+/g, '%')}%`]);
        
        console.log(`\n   "${item.original_sku}": ${skuCheck.rows[0].count} similar SKUs found`);
        if (skuCheck.rows[0].count > 0) {
          console.log(`      Similar SKUs: ${skuCheck.rows[0].existing_skus}`);
        }
      }
    }

    // Check data completeness patterns
    console.log('\n📊 Data Completeness Analysis:');
    console.log('==============================');
    
    const completenessStats = await client.query(`
      SELECT 
        COUNT(*) as total_unmatched,
        COUNT(CASE WHEN brand IS NULL THEN 1 END) as missing_brand,
        COUNT(CASE WHEN model IS NULL THEN 1 END) as missing_model,
        COUNT(CASE WHEN capacity IS NULL THEN 1 END) as missing_capacity,
        COUNT(CASE WHEN color IS NULL THEN 1 END) as missing_color,
        COUNT(CASE WHEN carrier IS NULL THEN 1 END) as missing_carrier,
        COUNT(CASE WHEN dt.notes IS NULL THEN 1 END) as missing_notes
      FROM sku_matching_results smr
      LEFT JOIN product p ON smr.imei = p.imei
      LEFT JOIN item i ON smr.imei = i.imei
      LEFT JOIN device_test dt ON smr.imei = dt.imei
      WHERE smr.matched_sku IS NULL
    `);
    
    const stats = completenessStats.rows[0];
    console.log(`   Total Unmatched: ${stats.total_unmatched}`);
    console.log(`   Missing Brand: ${stats.missing_brand}`);
    console.log(`   Missing Model: ${stats.missing_model}`);
    console.log(`   Missing Capacity: ${stats.missing_capacity}`);
    console.log(`   Missing Color: ${stats.missing_color}`);
    console.log(`   Missing Carrier: ${stats.missing_carrier}`);
    console.log(`   Missing Device Notes: ${stats.missing_notes}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

analyzeUnmatchedItems();
