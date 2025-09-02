const { Client } = require('pg');
require('dotenv').config();

async function analyzeSkuVariations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log('\n🔍 Analyzing SKU variations across all 1,375 SKUs...\n');

    // Analyze CARRIER variations
    console.log('📱 CARRIER Variations:');
    const carriers = await client.query(`
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

    carriers.rows.forEach(row => {
      console.log(`   ${row.detected_carrier}: ${row.count} SKUs`);
    });

    // Analyze COLOR variations
    console.log('\n🎨 COLOR Variations:');
    const colors = await client.query(`
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

    colors.rows.forEach(row => {
      console.log(`   ${row.detected_color}: ${row.count} SKUs`);
    });

    // Analyze CAPACITY variations
    console.log('\n💾 CAPACITY Variations:');
    const capacities = await client.query(`
      SELECT DISTINCT 
        CASE 
          WHEN sku_code ~ '-\\d+GB-' THEN 'GB'
          WHEN sku_code ~ '-\\d+TB-' THEN 'TB'
          WHEN sku_code ~ '-\\d+MB-' THEN 'MB'
          WHEN sku_code ~ '-\\d{2,4}-' THEN 'NUMERIC'
          ELSE 'UNKNOWN_CAPACITY'
        END as capacity_type,
        COUNT(*) as count
      FROM sku_master 
      WHERE is_active = true
      GROUP BY 
        CASE 
          WHEN sku_code ~ '-\\d+GB-' THEN 'GB'
          WHEN sku_code ~ '-\\d+TB-' THEN 'TB'
          WHEN sku_code ~ '-\\d+MB-' THEN 'MB'
          WHEN sku_code ~ '-\\d{2,4}-' THEN 'NUMERIC'
          ELSE 'UNKNOWN_CAPACITY'
        END
      ORDER BY count DESC
    `);

    capacities.rows.forEach(row => {
      console.log(`   ${row.capacity_type}: ${row.count} SKUs`);
    });

    // Show specific capacity values
    console.log('\n📊 Specific Capacity Values:');
    const specificCapacities = await client.query(`
      SELECT DISTINCT 
        CASE 
          WHEN sku_code ~ '-\\d+GB-' THEN REGEXP_REPLACE(sku_code, '.*-(\\d+)GB-.*', '\\1GB')
          WHEN sku_code ~ '-\\d+TB-' THEN REGEXP_REPLACE(sku_code, '.*-(\\d+)TB-.*', '\\1TB')
          WHEN sku_code ~ '-\\d+MB-' THEN REGEXP_REPLACE(sku_code, '.*-(\\d+)MB-.*', '\\1MB')
          WHEN sku_code ~ '-\\d{2,4}-' THEN REGEXP_REPLACE(sku_code, '.*-(\\d{2,4})-.*', '\\1')
          ELSE 'UNKNOWN'
        END as capacity_value,
        COUNT(*) as count
      FROM sku_master 
      WHERE is_active = true
      GROUP BY 
        CASE 
          WHEN sku_code ~ '-\\d+GB-' THEN REGEXP_REPLACE(sku_code, '.*-(\\d+)GB-.*', '\\1GB')
          WHEN sku_code ~ '-\\d+TB-' THEN REGEXP_REPLACE(sku_code, '.*-(\\d+)TB-.*', '\\1TB')
          WHEN sku_code ~ '-\\d+MB-' THEN REGEXP_REPLACE(sku_code, '.*-(\\d+)MB-.*', '\\1MB')
          WHEN sku_code ~ '-\\d{2,4}-' THEN REGEXP_REPLACE(sku_code, '.*-(\\d{2,4})-.*', '\\1')
          ELSE 'UNKNOWN'
        END
      ORDER BY 
        CASE 
          WHEN capacity_value ~ '^\\d+GB$' THEN CAST(REGEXP_REPLACE(capacity_value, 'GB', '') AS INTEGER)
          WHEN capacity_value ~ '^\\d+TB$' THEN CAST(REGEXP_REPLACE(capacity_value, 'TB', '') AS INTEGER) * 1000
          WHEN capacity_value ~ '^\\d+MB$' THEN CAST(REGEXP_REPLACE(capacity_value, 'MB', '') AS INTEGER) / 1000
          WHEN capacity_value ~ '^\\d+$' THEN CAST(capacity_value AS INTEGER)
          ELSE 0
        END
      LIMIT 20
    `);

    specificCapacities.rows.forEach(row => {
      console.log(`   ${row.capacity_value}: ${row.count} SKUs`);
    });

    // Show some examples of complex SKUs
    console.log('\n🔍 Examples of Complex SKUs:');
    const complexSkus = await client.query(`
      SELECT sku_code
      FROM sku_master 
      WHERE is_active = true 
      AND (
        sku_code LIKE '%-%-%-%-%-%-%' OR
        sku_code LIKE '%/%' OR
        sku_code LIKE '% %'
      )
      LIMIT 10
    `);

    complexSkus.rows.forEach(sku => {
      console.log(`   ${sku.sku_code}`);
    });

  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the analysis
analyzeSkuVariations();
