const { Client } = require('pg');
require('dotenv').config();

async function testSimpleSkuMatch() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    // Step 1: Get a sample generated SKU
    console.log('\n📋 Step 1: Getting a sample generated SKU...');
    const sampleItem = await client.query(`
      SELECT imei, sku, brand
      FROM product 
      WHERE sku LIKE '%-%-%-%'
      LIMIT 1
    `);

    if (sampleItem.rows.length === 0) {
      console.log('❌ No generated SKUs found');
      return;
    }

    const item = sampleItem.rows[0];
    console.log('✅ Found sample item:');
    console.log(`   IMEI: ${item.imei}`);
    console.log(`   Generated SKU: ${item.sku}`);
    console.log(`   Brand: ${item.brand}`);

    // Step 2: Parse the generated SKU to extract components
    console.log('\n🔍 Step 2: Parsing generated SKU...');
    const skuParts = item.sku.split('-');
    console.log('   SKU parts:', skuParts);

    // Step 3: Search for potential matches in SKU master
    console.log('\n🔍 Step 3: Searching for matches in SKU master...');
    
    // Try different matching strategies
    const searchTerms = [
      skuParts[0], // First part (e.g., "GalaxyZFold3Duos")
      skuParts[0].replace('Galaxy', '').replace('Duos', ''), // Cleaned version
      skuParts[0].toLowerCase(),
      skuParts[0].replace(/[A-Z]/g, '').toLowerCase() // Remove caps
    ];

    console.log('   Search terms:', searchTerms);

    // Search for matches
    const matches = await client.query(`
      SELECT sku_code, brand, model, carrier, source_tab
      FROM sku_master 
      WHERE (
        LOWER(sku_code) LIKE $1 OR
        LOWER(sku_code) LIKE $2 OR
        LOWER(brand) LIKE $3 OR
        LOWER(model) LIKE $4
      )
      AND is_active = true
      LIMIT 10
    `, [
      `%${searchTerms[0].toLowerCase()}%`,
      `%${searchTerms[1].toLowerCase()}%`,
      `%${searchTerms[0].toLowerCase()}%`,
      `%${searchTerms[0].toLowerCase()}%`
    ]);

    console.log(`   Found ${matches.rows.length} potential matches:`);
    matches.rows.forEach((match, index) => {
      console.log(`   ${index + 1}. ${match.sku_code} (${match.brand} ${match.model} ${match.carrier})`);
    });

    if (matches.rows.length > 0) {
      // Step 4: Select the best match (for now, just the first one)
      const bestMatch = matches.rows[0];
      console.log('\n✅ Step 4: Selected best match:');
      console.log(`   Matched SKU: ${bestMatch.sku_code}`);
      console.log(`   Brand: ${bestMatch.brand}`);
      console.log(`   Model: ${bestMatch.model}`);
      console.log(`   Carrier: ${bestMatch.carrier}`);
      console.log(`   Source: ${bestMatch.source_tab}`);

      // Step 5: Update the database
      console.log('\n💾 Step 5: Updating database...');
      const updateResult = await client.query(`
        UPDATE product 
        SET sku = $1, updated_at = NOW()
        WHERE imei = $2
        RETURNING imei, sku
      `, [bestMatch.sku_code, item.imei]);

      if (updateResult.rows.length > 0) {
        console.log('✅ Database updated successfully!');
        console.log(`   IMEI: ${updateResult.rows[0].imei}`);
        console.log(`   Old SKU: ${item.sku}`);
        console.log(`   New SKU: ${updateResult.rows[0].sku}`);

        // Step 6: Log the match (simple version)
        console.log('\n📝 Step 6: Logging the match...');
        await client.query(`
          INSERT INTO sku_match_log (imei, original_sku, matched_sku, match_score, match_method, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [item.imei, item.sku, bestMatch.sku_code, 0.8, 'simple_match']);

        console.log('✅ Match logged successfully!');

        // Step 7: Verify the update
        console.log('\n🔍 Step 7: Verifying the update...');
        const verifyResult = await client.query(`
          SELECT imei, sku, brand
          FROM product
          WHERE imei = $1
        `, [item.imei]);

        console.log('✅ Verification complete:');
        console.log(`   IMEI: ${verifyResult.rows[0].imei}`);
        console.log(`   Updated SKU: ${verifyResult.rows[0].sku}`);
        console.log(`   Brand: ${verifyResult.rows[0].brand}`);

      } else {
        console.log('❌ Failed to update database');
      }
    } else {
      console.log('❌ No matches found in SKU master');
      console.log('   This means the generated SKU could not be matched to the master SKU list');
    }

  } catch (error) {
    console.error('❌ Error during SKU match test:', error);
  } finally {
    await client.end();
    console.log('\n🔗 Database connection closed');
  }
}

console.log('🚀 Starting Simple SKU Match Test...\n');
testSimpleSkuMatch();
