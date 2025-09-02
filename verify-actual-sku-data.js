const { Client } = require('pg');
require('dotenv').config();

async function verifyActualSkuData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log('\n🔍 Verifying ACTUAL data in sku_master table...\n');

    // Check what carriers actually exist
    console.log('📱 ACTUAL CARRIER patterns found in sku_code:');
    const actualCarriers = await client.query(`
      SELECT DISTINCT 
        CASE 
          WHEN sku_code LIKE '%-TMO%' THEN 'TMO'
          WHEN sku_code LIKE '%-ATT%' THEN 'ATT'
          WHEN sku_code LIKE '%-VRZ%' THEN 'VRZ'
          WHEN sku_code LIKE '%-SPECTRUM%' THEN 'SPECTRUM'
          WHEN sku_code LIKE '%-SPR%' THEN 'SPR'
          WHEN sku_code LIKE '%-WIFI%' THEN 'WIFI'
          WHEN sku_code LIKE '%-4G%' THEN '4G'
          WHEN sku_code LIKE '%-5G%' THEN '5G'
          WHEN sku_code LIKE '%-UNLOCKED%' THEN 'UNLOCKED'
          WHEN sku_code LIKE '%-CARRIER%' THEN 'CARRIER'
          WHEN sku_code LIKE '%-CDMA%' THEN 'CDMA'
          WHEN sku_code LIKE '%-GSM%' THEN 'GSM'
          WHEN sku_code LIKE '%-LTE%' THEN 'LTE'
          WHEN sku_code LIKE '%-GLOBAL%' THEN 'GLOBAL'
          WHEN sku_code LIKE '%-INTERNATIONAL%' THEN 'INTERNATIONAL'
          ELSE 'NO_CARRIER'
        END as detected_carrier,
        COUNT(*) as count
      FROM sku_master 
      WHERE is_active = true
      GROUP BY 
        CASE 
          WHEN sku_code LIKE '%-TMO%' THEN 'TMO'
          WHEN sku_code LIKE '%-ATT%' THEN 'ATT'
          WHEN sku_code LIKE '%-VRZ%' THEN 'VRZ'
          WHEN sku_code LIKE '%-SPECTRUM%' THEN 'SPECTRUM'
          WHEN sku_code LIKE '%-SPR%' THEN 'SPR'
          WHEN sku_code LIKE '%-WIFI%' THEN 'WIFI'
          WHEN sku_code LIKE '%-4G%' THEN '4G'
          WHEN sku_code LIKE '%-5G%' THEN '5G'
          WHEN sku_code LIKE '%-UNLOCKED%' THEN 'UNLOCKED'
          WHEN sku_code LIKE '%-CARRIER%' THEN 'CARRIER'
          WHEN sku_code LIKE '%-CDMA%' THEN 'CDMA'
          WHEN sku_code LIKE '%-GSM%' THEN 'GSM'
          WHEN sku_code LIKE '%-LTE%' THEN 'LTE'
          WHEN sku_code LIKE '%-GLOBAL%' THEN 'GLOBAL'
          WHEN sku_code LIKE '%-INTERNATIONAL%' THEN 'INTERNATIONAL'
          ELSE 'NO_CARRIER'
        END
      ORDER BY count DESC
    `);

    actualCarriers.rows.forEach(row => {
      console.log(`   ${row.detected_carrier}: ${row.count} SKUs`);
    });

    // Check what colors actually exist
    console.log('\n🎨 ACTUAL COLOR patterns found in sku_code:');
    const actualColors = await client.query(`
      SELECT DISTINCT 
        CASE 
          WHEN sku_code LIKE '%-BLK%' OR sku_code LIKE '%-BLACK%' THEN 'BLACK'
          WHEN sku_code LIKE '%-WHT%' OR sku_code LIKE '%-WHITE%' THEN 'WHITE'
          WHEN sku_code LIKE '%-GLD%' OR sku_code LIKE '%-GOLD%' THEN 'GOLD'
          WHEN sku_code LIKE '%-SLV%' OR sku_code LIKE '%-SILVER%' THEN 'SILVER'
          WHEN sku_code LIKE '%-GRN%' OR sku_code LIKE '%-GREEN%' THEN 'GREEN'
          WHEN sku_code LIKE '%-BLU%' OR sku_code LIKE '%-BLUE%' THEN 'BLUE'
          WHEN sku_code LIKE '%-PNK%' OR sku_code LIKE '%-PINK%' THEN 'PINK'
          WHEN sku_code LIKE '%-PUR%' OR sku_code LIKE '%-PURPLE%' THEN 'PURPLE'
          WHEN sku_code LIKE '%-GRY%' OR sku_code LIKE '%-GRAY%' THEN 'GRAY'
          WHEN sku_code LIKE '%-SG%' OR sku_code LIKE '%-SPACE_GRAY%' THEN 'SPACE_GRAY'
          WHEN sku_code LIKE '%-ROSE%' THEN 'ROSE'
          WHEN sku_code LIKE '%-RED%' THEN 'RED'
          WHEN sku_code LIKE '%-ORANGE%' THEN 'ORANGE'
          WHEN sku_code LIKE '%-YELLOW%' THEN 'YELLOW'
          WHEN sku_code LIKE '%-BROWN%' THEN 'BROWN'
          WHEN sku_code LIKE '%-TAN%' THEN 'TAN'
          WHEN sku_code LIKE '%-CREAM%' THEN 'CREAM'
          WHEN sku_code LIKE '%-PHANTOM%' THEN 'PHANTOM'
          WHEN sku_code LIKE '%-MIDNIGHT%' THEN 'MIDNIGHT'
          WHEN sku_code LIKE '%-STARLIGHT%' THEN 'STARLIGHT'
          WHEN sku_code LIKE '%-ALPINE%' THEN 'ALPINE'
          WHEN sku_code LIKE '%-SIERRA%' THEN 'SIERRA'
          ELSE 'UNKNOWN_COLOR'
        END as detected_color,
        COUNT(*) as count
      FROM sku_master 
      WHERE is_active = true
      GROUP BY 
        CASE 
          WHEN sku_code LIKE '%-BLK%' OR sku_code LIKE '%-BLACK%' THEN 'BLACK'
          WHEN sku_code LIKE '%-WHT%' OR sku_code LIKE '%-WHITE%' THEN 'WHITE'
          WHEN sku_code LIKE '%-GLD%' OR sku_code LIKE '%-GOLD%' THEN 'GOLD'
          WHEN sku_code LIKE '%-SLV%' OR sku_code LIKE '%-SILVER%' THEN 'SILVER'
          WHEN sku_code LIKE '%-GRN%' OR sku_code LIKE '%-GREEN%' THEN 'GREEN'
          WHEN sku_code LIKE '%-BLU%' OR sku_code LIKE '%-BLUE%' THEN 'BLUE'
          WHEN sku_code LIKE '%-PNK%' OR sku_code LIKE '%-PINK%' THEN 'PINK'
          WHEN sku_code LIKE '%-PUR%' OR sku_code LIKE '%-PURPLE%' THEN 'PURPLE'
          WHEN sku_code LIKE '%-GRY%' OR sku_code LIKE '%-GRAY%' THEN 'GRAY'
          WHEN sku_code LIKE '%-SG%' OR sku_code LIKE '%-SPACE_GRAY%' THEN 'SPACE_GRAY'
          WHEN sku_code LIKE '%-ROSE%' THEN 'ROSE'
          WHEN sku_code LIKE '%-RED%' THEN 'RED'
          WHEN sku_code LIKE '%-ORANGE%' THEN 'ORANGE'
          WHEN sku_code LIKE '%-YELLOW%' THEN 'YELLOW'
          WHEN sku_code LIKE '%-BROWN%' THEN 'BROWN'
          WHEN sku_code LIKE '%-TAN%' THEN 'TAN'
          WHEN sku_code LIKE '%-CREAM%' THEN 'CREAM'
          WHEN sku_code LIKE '%-PHANTOM%' THEN 'PHANTOM'
          WHEN sku_code LIKE '%-MIDNIGHT%' THEN 'MIDNIGHT'
          WHEN sku_code LIKE '%-STARLIGHT%' THEN 'STARLIGHT'
          WHEN sku_code LIKE '%-ALPINE%' THEN 'ALPINE'
          WHEN sku_code LIKE '%-SIERRA%' THEN 'SIERRA'
          ELSE 'UNKNOWN_COLOR'
        END
      ORDER BY count DESC
    `);

    actualColors.rows.forEach(row => {
      console.log(`   ${row.detected_color}: ${row.count} SKUs`);
    });

    // Show examples of SKUs that might have these patterns
    console.log('\n🔍 Examples of SKUs with potential CDMA/GSM/LTE patterns:');
    const cdmaExamples = await client.query(`
      SELECT sku_code
      FROM sku_master 
      WHERE is_active = true 
      AND (
        sku_code LIKE '%CDMA%' OR
        sku_code LIKE '%GSM%' OR
        sku_code LIKE '%LTE%' OR
        sku_code LIKE '%GLOBAL%' OR
        sku_code LIKE '%INTERNATIONAL%'
      )
      LIMIT 10
    `);

    if (cdmaExamples.rows.length > 0) {
      cdmaExamples.rows.forEach(sku => {
        console.log(`   ${sku.sku_code}`);
      });
    } else {
      console.log('   ❌ No SKUs found with CDMA/GSM/LTE/GLOBAL/INTERNATIONAL patterns');
    }

    // Show examples of SKUs with potential PHANTOM/MIDNIGHT/STARLIGHT patterns
    console.log('\n🔍 Examples of SKUs with potential PHANTOM/MIDNIGHT/STARLIGHT patterns:');
    const phantomExamples = await client.query(`
      SELECT sku_code
      FROM sku_master 
      WHERE is_active = true 
      AND (
        sku_code LIKE '%PHANTOM%' OR
        sku_code LIKE '%MIDNIGHT%' OR
        sku_code LIKE '%STARLIGHT%' OR
        sku_code LIKE '%ALPINE%' OR
        sku_code LIKE '%SIERRA%'
      )
      LIMIT 10
    `);

    if (phantomExamples.rows.length > 0) {
      phantomExamples.rows.forEach(sku => {
        console.log(`   ${sku.sku_code}`);
      });
    } else {
      console.log('   ❌ No SKUs found with PHANTOM/MIDNIGHT/STARLIGHT/ALPINE/SIERRA patterns');
    }

  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the verification
verifyActualSkuData();
