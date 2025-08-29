const { Client } = require('pg');
require('dotenv').config();

async function checkSkuResults() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Check overall results
    const summaryResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN matched_sku IS NOT NULL THEN 1 END) as matched,
        COUNT(CASE WHEN matched_sku IS NULL THEN 1 END) as unmatched
      FROM sku_matching_results
    `);

    console.log('\n📊 SKU Matching Results Summary:');
    console.log(`   Total: ${summaryResult.rows[0].total}`);
    console.log(`   Matched: ${summaryResult.rows[0].matched}`);
    console.log(`   Unmatched: ${summaryResult.rows[0].unmatched}`);

    // Show some sample matches
    const sampleMatches = await client.query(`
      SELECT imei, original_sku, matched_sku, match_score, match_method, match_notes
      FROM sku_matching_results
      WHERE matched_sku IS NOT NULL
      ORDER BY processed_at DESC
      LIMIT 5
    `);

    console.log('\n✅ Sample Successful Matches:');
    sampleMatches.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.imei} → ${row.matched_sku} (${(row.match_score * 100).toFixed(1)}%)`);
    });

    // Show some unmatched items
    const unmatchedItems = await client.query(`
      SELECT imei, original_sku, match_notes
      FROM sku_matching_results
      WHERE matched_sku IS NULL
      ORDER BY processed_at DESC
      LIMIT 5
    `);

    console.log('\n❌ Sample Unmatched Items:');
    unmatchedItems.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.imei} (${row.original_sku}) - ${row.match_notes}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkSkuResults();
