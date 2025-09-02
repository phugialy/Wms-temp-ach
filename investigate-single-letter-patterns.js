const { Client } = require('pg');
require('dotenv').config();

async function investigateSingleLetterPatterns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log('\n🔍 INVESTIGATING SINGLE LETTER PATTERNS IN SKU_MASTER...');
    
    // Find all SKUs that end with a single letter
    const singleLetterEndings = await client.query(`
      SELECT 
        sku_code,
        CASE 
          WHEN sku_code ~ '^.*-[A-Z]$' THEN 'ENDS_WITH_SINGLE_LETTER'
          WHEN sku_code ~ '^[A-Z]-.*$' THEN 'STARTS_WITH_SINGLE_LETTER'
          ELSE 'NO_SINGLE_LETTER'
        END as pattern_type,
        CASE 
          WHEN sku_code ~ '^.*-[A-Z]$' THEN RIGHT(sku_code, 1)
          WHEN sku_code ~ '^[A-Z]-.*$' THEN LEFT(sku_code, 1)
          ELSE NULL
        END as single_letter
      FROM sku_master 
      WHERE is_active = true 
        AND (sku_code ~ '^.*-[A-Z]$' OR sku_code ~ '^[A-Z]-.*$')
      ORDER BY sku_code
    `);

    console.log(`\n📊 Found ${singleLetterEndings.rows.length} SKUs with single letter patterns`);

    // Group by single letter
    const letterGroups = new Map();
    singleLetterEndings.rows.forEach(row => {
      const letter = row.single_letter;
      if (!letterGroups.has(letter)) {
        letterGroups.set(letter, []);
      }
      letterGroups.get(letter).push({
        sku_code: row.sku_code,
        pattern_type: row.pattern_type
      });
    });

    // Analyze each letter
    console.log('\n🔍 ANALYSIS BY SINGLE LETTER:');
    for (const [letter, skus] of letterGroups) {
      console.log(`\n📱 Letter '${letter}' (${skus.length} SKUs):`);
      
      // Group by pattern type
      const byPattern = {};
      skus.forEach(sku => {
        if (!byPattern[sku.pattern_type]) {
          byPattern[sku.pattern_type] = [];
        }
        byPattern[sku.pattern_type].push(sku.sku_code);
      });

      // Show examples for each pattern
      Object.entries(byPattern).forEach(([pattern, codes]) => {
        console.log(`  ${pattern}:`);
        codes.slice(0, 5).forEach(code => console.log(`    - ${code}`));
        if (codes.length > 5) {
          console.log(`    ... and ${codes.length - 5} more`);
        }
      });

      // Check if this letter appears in longer words
      const longerWords = await client.query(`
        SELECT sku_code 
        FROM sku_master 
        WHERE is_active = true 
          AND sku_code ~ '.*${letter}[A-Z]+.*'
          AND sku_code ~ '.*[A-Z]+${letter}.*'
        ORDER BY sku_code
        LIMIT 10
      `);

      if (longerWords.rows.length > 0) {
        console.log(`  🔍 Found ${longerWords.rows.length} SKUs with longer words containing '${letter}':`);
        longerWords.rows.forEach(row => {
          console.log(`    - ${row.sku_code}`);
        });
      } else {
        console.log(`  ✅ No longer words found containing '${letter}' - likely unique identifier`);
      }
    }

    // Look for potential abbreviations
    console.log('\n🔍 POTENTIAL ABBREVIATION ANALYSIS:');
    const commonAbbreviations = {
      'S': ['SPECTRUM', 'SPR', 'SPRINT'],
      'A': ['ATT', 'AT&T'],
      'T': ['TMO', 'T-MOBILE'],
      'V': ['VRZ', 'VERIZON'],
      'P': ['PINK', 'PURPLE'],
      'B': ['BLUE', 'BLACK'],
      'G': ['GREEN', 'GOLD'],
      'W': ['WHITE', 'WIFI']
    };

    for (const [letter, possibleWords] of Object.entries(commonAbbreviations)) {
      if (letterGroups.has(letter)) {
        console.log(`\n📱 Letter '${letter}' - Possible abbreviations: [${possibleWords.join(', ')}]`);
        
        // Check if any of these longer words exist in the database
        const existingWords = await client.query(`
          SELECT sku_code 
          FROM sku_master 
          WHERE is_active = true 
            AND (
              ${possibleWords.map(word => `sku_code LIKE '%${word}%'`).join(' OR ')}
            )
          ORDER BY sku_code
          LIMIT 5
        `);

        if (existingWords.rows.length > 0) {
          console.log(`  ✅ Found ${existingWords.rows.length} SKUs with potential full words:`);
          existingWords.rows.forEach(row => {
            console.log(`    - ${row.sku_code}`);
          });
        } else {
          console.log(`  ❌ No SKUs found with potential full words - '${letter}' might be unique`);
        }
      }
    }

    console.log('\n💡 RECOMMENDATIONS:');
    console.log('1. Single letters that appear in longer words = likely abbreviations');
    console.log('2. Single letters with NO longer words = likely unique identifiers');
    console.log('3. Check if single letters create duplicate SKUs when expanded');
    console.log('4. Some single letters might be manufacturer codes or variant IDs');

  } catch (error) {
    console.error('❌ Error during investigation:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the investigation
investigateSingleLetterPatterns();
