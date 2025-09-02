const { Client } = require('pg');
require('dotenv').config();

async function investigateMissingPatterns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log('\n🔍 INVESTIGATING MISSING PATTERNS...');
    console.log('Total SKUs: 1,375');
    console.log('Carriers detected: 1,362 (Missing: 13)');
    console.log('Colors detected: 949 (Missing: 426)');

    // 1. Find SKUs with NO carrier pattern
    console.log('\n📱 SKUs with NO CARRIER pattern (13 missing):');
    const noCarrierSkus = await client.query(`
      SELECT id, sku_code
      FROM sku_master 
      WHERE is_active = true
      AND sku_code NOT LIKE '%-TMO%'
      AND sku_code NOT LIKE '%-ATT%'
      AND sku_code NOT LIKE '%-VRZ%'
      AND sku_code NOT LIKE '%-SPECTRUM%'
      AND sku_code NOT LIKE '%-SPR%'
      AND sku_code NOT LIKE '%-WIFI%'
      AND sku_code NOT LIKE '%-4G%'
      AND sku_code NOT LIKE '%-5G%'
      AND sku_code NOT LIKE '%-UNLOCKED%'
      AND sku_code NOT LIKE '%-CARRIER%'
      AND sku_code NOT LIKE '%-LTE%'
      ORDER BY sku_code
    `);

    console.log(`Found ${noCarrierSkus.rows.length} SKUs with no carrier pattern:`);
    noCarrierSkus.rows.forEach(sku => {
      console.log(`   ${sku.sku_code}`);
    });

    // 2. Find SKUs with NO color pattern
    console.log('\n🎨 SKUs with NO COLOR pattern (426 missing):');
    const noColorSkus = await client.query(`
      SELECT id, sku_code
      FROM sku_master 
      WHERE is_active = true
      AND sku_code NOT LIKE '%-BLK%'
      AND sku_code NOT LIKE '%-BLACK%'
      AND sku_code NOT LIKE '%-WHT%'
      AND sku_code NOT LIKE '%-WHITE%'
      AND sku_code NOT LIKE '%-GLD%'
      AND sku_code NOT LIKE '%-GOLD%'
      AND sku_code NOT LIKE '%-SLV%'
      AND sku_code NOT LIKE '%-SILVER%'
      AND sku_code NOT LIKE '%-GRN%'
      AND sku_code NOT LIKE '%-GREEN%'
      AND sku_code NOT LIKE '%-BLU%'
      AND sku_code NOT LIKE '%-BLUE%'
      AND sku_code NOT LIKE '%-PNK%'
      AND sku_code NOT LIKE '%-PINK%'
      AND sku_code NOT LIKE '%-PUR%'
      AND sku_code NOT LIKE '%-PURPLE%'
      AND sku_code NOT LIKE '%-GRY%'
      AND sku_code NOT LIKE '%-GRAY%'
      AND sku_code NOT LIKE '%-SG%'
      AND sku_code NOT LIKE '%-SPACE_GRAY%'
      AND sku_code NOT LIKE '%-ROSE%'
      AND sku_code NOT LIKE '%-RED%'
      AND sku_code NOT LIKE '%-ORANGE%'
      AND sku_code NOT LIKE '%-YELLOW%'
      AND sku_code NOT LIKE '%-BROWN%'
      AND sku_code NOT LIKE '%-TAN%'
      AND sku_code NOT LIKE '%-CREAM%'
      AND sku_code NOT LIKE '%-STARLIGHT%'
      ORDER BY sku_code
    `);

    console.log(`Found ${noColorSkus.rows.length} SKUs with no color pattern:`);
    noColorSkus.rows.slice(0, 20).forEach(sku => { // Show first 20
      console.log(`   ${sku.sku_code}`);
    });
    if (noColorSkus.rows.length > 20) {
      console.log(`   ... and ${noColorSkus.rows.length - 20} more`);
    }

    // 3. Look for abbreviated/alternative patterns
    console.log('\n🔍 Looking for ABBREVIATED/ALTERNATIVE patterns...');

    // Check for abbreviated carriers
    console.log('\n📱 Potential abbreviated carriers:');
    const abbreviatedCarriers = await client.query(`
      SELECT DISTINCT 
        CASE 
          WHEN sku_code LIKE '%-T%' AND sku_code NOT LIKE '%-TMO%' AND sku_code NOT LIKE '%-TEST%' THEN 'T (potential TMO)'
          WHEN sku_code LIKE '%-A%' AND sku_code NOT LIKE '%-ATT%' AND sku_code NOT LIKE '%-AIR%' THEN 'A (potential ATT)'
          WHEN sku_code LIKE '%-V%' AND sku_code NOT LIKE '%-VRZ%' AND sku_code NOT LIKE '%-VG%' THEN 'V (potential VRZ)'
          WHEN sku_code LIKE '%-S%' AND sku_code NOT LIKE '%-SPR%' AND sku_code NOT LIKE '%-SPECTRUM%' AND sku_code NOT LIKE '%-SG%' THEN 'S (potential SPR/SPECTRUM)'
          WHEN sku_code LIKE '%-W%' AND sku_code NOT LIKE '%-WIFI%' AND sku_code NOT LIKE '%-WHT%' AND sku_code NOT LIKE '%-WHITE%' THEN 'W (potential WIFI)'
          WHEN sku_code LIKE '%-U%' AND sku_code NOT LIKE '%-UNLOCKED%' AND sku_code NOT LIKE '%-UL%' THEN 'U (potential UNLOCKED)'
          WHEN sku_code LIKE '%-C%' AND sku_code NOT LIKE '%-CARRIER%' AND sku_code NOT LIKE '%-CREAM%' THEN 'C (potential CARRIER)'
          WHEN sku_code LIKE '%-L%' AND sku_code NOT LIKE '%-LTE%' AND sku_code NOT LIKE '%-LL%' THEN 'L (potential LTE)'
          ELSE 'OTHER'
        END as potential_abbreviation,
        COUNT(*) as count
      FROM sku_master 
      WHERE is_active = true
      AND (
        (sku_code LIKE '%-T%' AND sku_code NOT LIKE '%-TMO%' AND sku_code NOT LIKE '%-TEST%') OR
        (sku_code LIKE '%-A%' AND sku_code NOT LIKE '%-ATT%' AND sku_code NOT LIKE '%-AIR%') OR
        (sku_code LIKE '%-V%' AND sku_code NOT LIKE '%-VRZ%' AND sku_code NOT LIKE '%-VG%') OR
        (sku_code LIKE '%-S%' AND sku_code NOT LIKE '%-SPR%' AND sku_code NOT LIKE '%-SPECTRUM%' AND sku_code NOT LIKE '%-SG%') OR
        (sku_code LIKE '%-W%' AND sku_code NOT LIKE '%-WIFI%' AND sku_code NOT LIKE '%-WHT%' AND sku_code NOT LIKE '%-WHITE%') OR
        (sku_code LIKE '%-U%' AND sku_code NOT LIKE '%-UNLOCKED%' AND sku_code NOT LIKE '%-UL%') OR
        (sku_code LIKE '%-C%' AND sku_code NOT LIKE '%-CARRIER%' AND sku_code NOT LIKE '%-CREAM%') OR
        (sku_code LIKE '%-L%' AND sku_code NOT LIKE '%-LTE%' AND sku_code NOT LIKE '%-LL%')
      )
      GROUP BY 
        CASE 
          WHEN sku_code LIKE '%-T%' AND sku_code NOT LIKE '%-TMO%' AND sku_code NOT LIKE '%-TEST%' THEN 'T (potential TMO)'
          WHEN sku_code LIKE '%-A%' AND sku_code NOT LIKE '%-ATT%' AND sku_code NOT LIKE '%-AIR%' THEN 'A (potential ATT)'
          WHEN sku_code LIKE '%-V%' AND sku_code NOT LIKE '%-VRZ%' AND sku_code NOT LIKE '%-VG%' THEN 'V (potential VRZ)'
          WHEN sku_code LIKE '%-S%' AND sku_code NOT LIKE '%-SPR%' AND sku_code NOT LIKE '%-SPECTRUM%' AND sku_code NOT LIKE '%-SG%' THEN 'S (potential SPR/SPECTRUM)'
          WHEN sku_code LIKE '%-W%' AND sku_code NOT LIKE '%-WIFI%' AND sku_code NOT LIKE '%-WHT%' AND sku_code NOT LIKE '%-WHITE%' THEN 'W (potential WIFI)'
          WHEN sku_code LIKE '%-U%' AND sku_code NOT LIKE '%-UNLOCKED%' AND sku_code NOT LIKE '%-UL%' THEN 'U (potential UNLOCKED)'
          WHEN sku_code LIKE '%-C%' AND sku_code NOT LIKE '%-CARRIER%' AND sku_code NOT LIKE '%-CREAM%' THEN 'C (potential CARRIER)'
          WHEN sku_code LIKE '%-L%' AND sku_code NOT LIKE '%-LTE%' AND sku_code NOT LIKE '%-LL%' THEN 'L (potential LTE)'
          ELSE 'OTHER'
        END
      ORDER BY count DESC
    `);

    abbreviatedCarriers.rows.forEach(row => {
      if (row.potential_abbreviation !== 'OTHER') {
        console.log(`   ${row.potential_abbreviation}: ${row.count} SKUs`);
      }
    });

    // Check for abbreviated colors
    console.log('\n🎨 Potential abbreviated colors:');
    const abbreviatedColors = await client.query(`
      SELECT DISTINCT 
        CASE 
          WHEN sku_code LIKE '%-B%' AND sku_code NOT LIKE '%-BLK%' AND sku_code NOT LIKE '%-BLACK%' AND sku_code NOT LIKE '%-BLU%' AND sku_code NOT LIKE '%-BLUE%' AND sku_code NOT LIKE '%-BROWN%' THEN 'B (potential BLK/BLUE)'
          WHEN sku_code LIKE '%-W%' AND sku_code NOT LIKE '%-WHT%' AND sku_code NOT LIKE '%-WHITE%' AND sku_code NOT LIKE '%-WIFI%' THEN 'W (potential WHT/WHITE)'
          WHEN sku_code LIKE '%-G%' AND sku_code NOT LIKE '%-GLD%' AND sku_code NOT LIKE '%-GOLD%' AND sku_code NOT LIKE '%-GRN%' AND sku_code NOT LIKE '%-GREEN%' AND sku_code NOT LIKE '%-GRY%' AND sku_code NOT LIKE '%-GRAY%' THEN 'G (potential GLD/GRN/GRY)'
          WHEN sku_code LIKE '%-S%' AND sku_code NOT LIKE '%-SLV%' AND sku_code NOT LIKE '%-SILVER%' AND sku_code NOT LIKE '%-SG%' AND sku_code NOT LIKE '%-SPACE_GRAY%' AND sku_code NOT LIKE '%-SPR%' AND sku_code NOT LIKE '%-SPECTRUM%' THEN 'S (potential SLV/SG)'
          WHEN sku_code LIKE '%-P%' AND sku_code NOT LIKE '%-PNK%' AND sku_code NOT LIKE '%-PINK%' AND sku_code NOT LIKE '%-PUR%' AND sku_code NOT LIKE '%-PURPLE%' THEN 'P (potential PNK/PUR)'
          WHEN sku_code LIKE '%-R%' AND sku_code NOT LIKE '%-ROSE%' AND sku_code NOT LIKE '%-RED%' THEN 'R (potential ROSE/RED)'
          WHEN sku_code LIKE '%-Y%' AND sku_code NOT LIKE '%-YELLOW%' THEN 'Y (potential YELLOW)'
          WHEN sku_code LIKE '%-O%' AND sku_code NOT LIKE '%-ORANGE%' THEN 'O (potential ORANGE)'
          WHEN sku_code LIKE '%-T%' AND sku_code NOT LIKE '%-TAN%' AND sku_code NOT LIKE '%-TMO%' AND sku_code NOT LIKE '%-TEST%' THEN 'T (potential TAN)'
          WHEN sku_code LIKE '%-C%' AND sku_code NOT LIKE '%-CREAM%' AND sku_code NOT LIKE '%-CARRIER%' THEN 'C (potential CREAM)'
          ELSE 'OTHER'
        END as potential_abbreviation,
        COUNT(*) as count
      FROM sku_master 
      WHERE is_active = true
      AND (
        (sku_code LIKE '%-B%' AND sku_code NOT LIKE '%-BLK%' AND sku_code NOT LIKE '%-BLACK%' AND sku_code NOT LIKE '%-BLU%' AND sku_code NOT LIKE '%-BLUE%' AND sku_code NOT LIKE '%-BROWN%') OR
        (sku_code LIKE '%-W%' AND sku_code NOT LIKE '%-WHT%' AND sku_code NOT LIKE '%-WHITE%' AND sku_code NOT LIKE '%-WIFI%') OR
        (sku_code LIKE '%-G%' AND sku_code NOT LIKE '%-GLD%' AND sku_code NOT LIKE '%-GOLD%' AND sku_code NOT LIKE '%-GRN%' AND sku_code NOT LIKE '%-GREEN%' AND sku_code NOT LIKE '%-GRY%' AND sku_code NOT LIKE '%-GRAY%') OR
        (sku_code LIKE '%-S%' AND sku_code NOT LIKE '%-SLV%' AND sku_code NOT LIKE '%-SILVER%' AND sku_code NOT LIKE '%-SG%' AND sku_code NOT LIKE '%-SPACE_GRAY%' AND sku_code NOT LIKE '%-SPR%' AND sku_code NOT LIKE '%-SPECTRUM%') OR
        (sku_code LIKE '%-P%' AND sku_code NOT LIKE '%-PNK%' AND sku_code NOT LIKE '%-PINK%' AND sku_code NOT LIKE '%-PUR%' AND sku_code NOT LIKE '%-PURPLE%') OR
        (sku_code LIKE '%-R%' AND sku_code NOT LIKE '%-ROSE%' AND sku_code NOT LIKE '%-RED%') OR
        (sku_code LIKE '%-Y%' AND sku_code NOT LIKE '%-YELLOW%') OR
        (sku_code LIKE '%-O%' AND sku_code NOT LIKE '%-ORANGE%') OR
        (sku_code LIKE '%-T%' AND sku_code NOT LIKE '%-TAN%' AND sku_code NOT LIKE '%-TMO%' AND sku_code NOT LIKE '%-TEST%') OR
        (sku_code LIKE '%-C%' AND sku_code NOT LIKE '%-CREAM%' AND sku_code NOT LIKE '%-CARRIER%')
      )
      GROUP BY 
        CASE 
          WHEN sku_code LIKE '%-B%' AND sku_code NOT LIKE '%-BLK%' AND sku_code NOT LIKE '%-BLACK%' AND sku_code NOT LIKE '%-BLU%' AND sku_code NOT LIKE '%-BLUE%' AND sku_code NOT LIKE '%-BROWN%' THEN 'B (potential BLK/BLUE)'
          WHEN sku_code LIKE '%-W%' AND sku_code NOT LIKE '%-WHT%' AND sku_code NOT LIKE '%-WHITE%' AND sku_code NOT LIKE '%-WIFI%' THEN 'W (potential WHT/WHITE)'
          WHEN sku_code LIKE '%-G%' AND sku_code NOT LIKE '%-GLD%' AND sku_code NOT LIKE '%-GOLD%' AND sku_code NOT LIKE '%-GRN%' AND sku_code NOT LIKE '%-GREEN%' AND sku_code NOT LIKE '%-GRY%' AND sku_code NOT LIKE '%-GRAY%' THEN 'G (potential GLD/GRN/GRY)'
          WHEN sku_code LIKE '%-S%' AND sku_code NOT LIKE '%-SLV%' AND sku_code NOT LIKE '%-SILVER%' AND sku_code NOT LIKE '%-SG%' AND sku_code NOT LIKE '%-SPACE_GRAY%' AND sku_code NOT LIKE '%-SPR%' AND sku_code NOT LIKE '%-SPECTRUM%' THEN 'S (potential SLV/SG)'
          WHEN sku_code LIKE '%-P%' AND sku_code NOT LIKE '%-PNK%' AND sku_code NOT LIKE '%-PINK%' AND sku_code NOT LIKE '%-PUR%' AND sku_code NOT LIKE '%-PURPLE%' THEN 'P (potential PNK/PUR)'
          WHEN sku_code LIKE '%-R%' AND sku_code NOT LIKE '%-ROSE%' AND sku_code NOT LIKE '%-RED%' THEN 'R (potential ROSE/RED)'
          WHEN sku_code LIKE '%-Y%' AND sku_code NOT LIKE '%-YELLOW%' THEN 'Y (potential YELLOW)'
          WHEN sku_code LIKE '%-O%' AND sku_code NOT LIKE '%-ORANGE%' THEN 'O (potential ORANGE)'
          WHEN sku_code LIKE '%-T%' AND sku_code NOT LIKE '%-TAN%' AND sku_code NOT LIKE '%-TMO%' AND sku_code NOT LIKE '%-TEST%' THEN 'T (potential TAN)'
          WHEN sku_code LIKE '%-C%' AND sku_code NOT LIKE '%-CREAM%' AND sku_code NOT LIKE '%-CARRIER%' THEN 'C (potential CREAM)'
          ELSE 'OTHER'
        END
      ORDER BY count DESC
    `);

    abbreviatedColors.rows.forEach(row => {
      if (row.potential_abbreviation !== 'OTHER') {
        console.log(`   ${row.potential_abbreviation}: ${row.count} SKUs`);
      }
    });

    // 4. Show examples of SKUs with potential abbreviations
    console.log('\n🔍 Examples of SKUs with potential abbreviated carriers:');
    const abbreviatedCarrierExamples = await client.query(`
      SELECT sku_code
      FROM sku_master 
      WHERE is_active = true
      AND (
        (sku_code LIKE '%-T%' AND sku_code NOT LIKE '%-TMO%' AND sku_code NOT LIKE '%-TEST%') OR
        (sku_code LIKE '%-A%' AND sku_code NOT LIKE '%-ATT%' AND sku_code NOT LIKE '%-AIR%') OR
        (sku_code LIKE '%-V%' AND sku_code NOT LIKE '%-VRZ%' AND sku_code NOT LIKE '%-VG%') OR
        (sku_code LIKE '%-S%' AND sku_code NOT LIKE '%-SPR%' AND sku_code NOT LIKE '%-SPECTRUM%' AND sku_code NOT LIKE '%-SG%') OR
        (sku_code LIKE '%-W%' AND sku_code NOT LIKE '%-WIFI%' AND sku_code NOT LIKE '%-WHT%' AND sku_code NOT LIKE '%-WHITE%') OR
        (sku_code LIKE '%-U%' AND sku_code NOT LIKE '%-UNLOCKED%' AND sku_code NOT LIKE '%-UL%') OR
        (sku_code LIKE '%-C%' AND sku_code NOT LIKE '%-CARRIER%' AND sku_code NOT LIKE '%-CREAM%') OR
        (sku_code LIKE '%-L%' AND sku_code NOT LIKE '%-LTE%' AND sku_code NOT LIKE '%-LL%')
      )
      LIMIT 15
    `);

    abbreviatedCarrierExamples.rows.forEach(sku => {
      console.log(`   ${sku.sku_code}`);
    });

    // 5. Show examples of SKUs with potential abbreviated colors
    console.log('\n🔍 Examples of SKUs with potential abbreviated colors:');
    const abbreviatedColorExamples = await client.query(`
      SELECT sku_code
      FROM sku_master 
      WHERE is_active = true
      AND (
        (sku_code LIKE '%-B%' AND sku_code NOT LIKE '%-BLK%' AND sku_code NOT LIKE '%-BLACK%' AND sku_code NOT LIKE '%-BLU%' AND sku_code NOT LIKE '%-BLUE%' AND sku_code NOT LIKE '%-BROWN%') OR
        (sku_code LIKE '%-W%' AND sku_code NOT LIKE '%-WHT%' AND sku_code NOT LIKE '%-WHITE%' AND sku_code NOT LIKE '%-WIFI%') OR
        (sku_code LIKE '%-G%' AND sku_code NOT LIKE '%-GLD%' AND sku_code NOT LIKE '%-GOLD%' AND sku_code NOT LIKE '%-GRN%' AND sku_code NOT LIKE '%-GREEN%' AND sku_code NOT LIKE '%-GRY%' AND sku_code NOT LIKE '%-GRAY%') OR
        (sku_code LIKE '%-S%' AND sku_code NOT LIKE '%-SLV%' AND sku_code NOT LIKE '%-SILVER%' AND sku_code NOT LIKE '%-SG%' AND sku_code NOT LIKE '%-SPACE_GRAY%' AND sku_code NOT LIKE '%-SPR%' AND sku_code NOT LIKE '%-SPECTRUM%') OR
        (sku_code LIKE '%-P%' AND sku_code NOT LIKE '%-PNK%' AND sku_code NOT LIKE '%-PINK%' AND sku_code NOT LIKE '%-PUR%' AND sku_code NOT LIKE '%-PURPLE%') OR
        (sku_code LIKE '%-R%' AND sku_code NOT LIKE '%-ROSE%' AND sku_code NOT LIKE '%-RED%') OR
        (sku_code LIKE '%-Y%' AND sku_code NOT LIKE '%-YELLOW%') OR
        (sku_code LIKE '%-O%' AND sku_code NOT LIKE '%-ORANGE%') OR
        (sku_code LIKE '%-T%' AND sku_code NOT LIKE '%-TAN%' AND sku_code NOT LIKE '%-TMO%' AND sku_code NOT LIKE '%-TEST%') OR
        (sku_code LIKE '%-C%' AND sku_code NOT LIKE '%-CREAM%' AND sku_code NOT LIKE '%-CARRIER%')
      )
      LIMIT 15
    `);

    abbreviatedColorExamples.rows.forEach(sku => {
      console.log(`   ${sku.sku_code}`);
    });

    // 6. Summary and recommendations
    console.log('\n📊 SUMMARY & RECOMMENDATIONS:');
    console.log('❓ Missing 13 carriers: Likely abbreviated patterns (T, A, V, S, W, U, C, L)');
    console.log('❓ Missing 426 colors: Likely abbreviated patterns (B, W, G, S, P, R, Y, O, T, C)');
    console.log('💡 SOLUTION: Update tag categorization to handle abbreviated patterns');
    console.log('💡 EXAMPLE: "T" → "TMO", "B" → "BLK", "G" → "GLD/GRN/GRY"');

  } catch (error) {
    console.error('❌ Error during investigation:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the investigation
investigateMissingPatterns();
