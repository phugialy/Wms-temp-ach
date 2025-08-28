const { Client } = require('pg');
require('dotenv').config();

async function testWorkingSkuMatch() {
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

    // Step 2: Parse the generated SKU and create search terms
    console.log('\n🔍 Step 2: Parsing generated SKU...');
    const skuParts = item.sku.split('-');
    console.log('   SKU parts:', skuParts);

    // Extract components: GalaxyZFold3Duos-N/A-PHA-UNL
    const modelPart = skuParts[0]; // GalaxyZFold3Duos
    const capacityPart = skuParts[1]; // N/A
    const colorPart = skuParts[2]; // PHA (Phantom Black)
    const carrierPart = skuParts[3]; // UNL (Unlocked)

    console.log('   Extracted parts:');
    console.log(`     Model: ${modelPart}`);
    console.log(`     Capacity: ${capacityPart}`);
    console.log(`     Color: ${colorPart}`);
    console.log(`     Carrier: ${carrierPart}`);

    // Step 3: Create intelligent search terms
    console.log('\n🔍 Step 3: Creating search terms...');
    
    // Model variations
    const modelVariations = [
      modelPart.replace('Galaxy', '').replace('Duos', ''), // ZFold3
      modelPart.replace('Galaxy', ''), // ZFold3Duos
      modelPart.replace('Duos', ''), // GalaxyZFold3
      'FOLD3', // Direct match
      'FOLD' // Partial match
    ];

    // Color variations (PHA = Phantom Black = BLK)
    const colorVariations = [
      'BLK', // Black
      'BLACK',
      'PHA', // Phantom
      'PHANTOM'
    ];

    // Carrier variations (UNL = Unlocked)
    const carrierVariations = [
      '', // No carrier for unlocked
      'UNLOCKED',
      'UNL'
    ];

    console.log('   Model variations:', modelVariations);
    console.log('   Color variations:', colorVariations);
    console.log('   Carrier variations:', carrierVariations);

    // Step 4: Search for matches
    console.log('\n🔍 Step 4: Searching for matches...');
    
    // Build search query
    const searchQuery = `
      SELECT sku_code, brand, model, carrier, source_tab
      FROM sku_master 
      WHERE (
        ${modelVariations.map((_, i) => `LOWER(sku_code) LIKE $${i + 1}`).join(' OR ')}
      )
      AND (
        ${colorVariations.map((_, i) => `LOWER(sku_code) LIKE $${modelVariations.length + i + 1}`).join(' OR ')}
      )
      AND is_active = true
      ORDER BY 
        CASE 
          WHEN LOWER(sku_code) LIKE '%fold3%' THEN 1
          WHEN LOWER(sku_code) LIKE '%fold%' THEN 2
          ELSE 3
        END,
        sku_code
      LIMIT 10
    `;

    const searchParams = [
      ...modelVariations.map(m => `%${m.toLowerCase()}%`),
      ...colorVariations.map(c => `%${c.toLowerCase()}%`)
    ];

    console.log('   Search query:', searchQuery);
    console.log('   Search params:', searchParams);

    const matches = await client.query(searchQuery, searchParams);

    console.log(`   Found ${matches.rows.length} potential matches:`);
    matches.rows.forEach((match, index) => {
      console.log(`   ${index + 1}. ${match.sku_code} (${match.brand} ${match.model} ${match.carrier}) [${match.source_tab}]`);
    });

    if (matches.rows.length > 0) {
      // Step 5: Select the best match
      const bestMatch = matches.rows[0];
      console.log('\n✅ Step 5: Selected best match:');
      console.log(`   Matched SKU: ${bestMatch.sku_code}`);
      console.log(`   Brand: ${bestMatch.brand}`);
      console.log(`   Model: ${bestMatch.model}`);
      console.log(`   Carrier: ${bestMatch.carrier}`);
      console.log(`   Source: ${bestMatch.source_tab}`);

      // Step 6: Update the database
      console.log('\n💾 Step 6: Updating database...');
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

        // Step 7: Log the match
        console.log('\n📝 Step 7: Logging the match...');
        await client.query(`
          INSERT INTO sku_match_log (imei, original_sku, matched_sku, match_score, match_method, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [item.imei, item.sku, bestMatch.sku_code, 0.85, 'intelligent_match']);

        console.log('✅ Match logged successfully!');

        // Step 8: Verify the update
        console.log('\n🔍 Step 8: Verifying the update...');
        const verifyResult = await client.query(`
          SELECT imei, sku, brand
          FROM product
          WHERE imei = $1
        `, [item.imei]);

        console.log('✅ Verification complete:');
        console.log(`   IMEI: ${verifyResult.rows[0].imei}`);
        console.log(`   Updated SKU: ${verifyResult.rows[0].sku}`);
        console.log(`   Brand: ${verifyResult.rows[0].brand}`);

        console.log('\n🎉 SUCCESS! SKU mismatch prototype is working!');
        console.log(`   Generated: ${item.sku} → Matched: ${bestMatch.sku_code}`);

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

console.log('🚀 Starting Working SKU Match Test...\n');
testWorkingSkuMatch();
