const { Client } = require('pg');
const SkuMatchingService = require('./src/services/skuMatchingService');
require('dotenv').config();

async function debugPostFixIssue() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  const skuService = new SkuMatchingService();

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log('\n🔍 DEBUGGING POST-FIX ISSUE');
    console.log('============================');

    // Test IMEI that was showing issues
    const testImei = '356317536605163';

    console.log(`\n📱 Testing IMEI: ${testImei}`);

    // Get device data
    const deviceData = await skuService.getDeviceDataForMatching(testImei);
    if (!deviceData) {
      console.log('❌ No device data found');
      return;
    }

    console.log('\n📋 Device Data:');
    console.log(`   Brand: ${deviceData.brand}`);
    console.log(`   Model: ${deviceData.model}`);
    console.log(`   Capacity: ${deviceData.capacity}`);
    console.log(`   Color: ${deviceData.color}`);
    console.log(`   Carrier: ${deviceData.carrier}`);
    console.log(`   Notes: ${deviceData.device_notes}`);
    console.log(`   Is Unlocked: ${deviceData.isDeviceUnlocked}`);

    // Check what SKUs exist in the database
    console.log('\n📦 Checking Available SKUs:');
    
    const allSkusResult = await client.query(`
      SELECT sku_code, is_unlocked, source_tab
      FROM sku_master 
      WHERE is_active = true
      AND sku_code LIKE 'FOLD3%'
      ORDER BY sku_code
    `);

    console.log(`\n📊 Found ${allSkusResult.rows.length} Fold3 SKUs:`);
    allSkusResult.rows.forEach((sku, index) => {
      console.log(`   ${index + 1}. ${sku.sku_code} (Unlocked: ${sku.is_unlocked}, Source: ${sku.source_tab})`);
    });

    // Check post-fix patterns
    console.log('\n🔍 Post-Fix Analysis:');
    const postFixPatterns = ['-VG', '-UV', '-ACCEPTABLE', '-UL', '-LN', '-NEW', '-TEST', '-EXCELLENT', '-GOOD', '-FAIR', '-LIKE'];
    
    allSkusResult.rows.forEach(sku => {
      const skuCode = sku.sku_code;
      const foundPostFix = postFixPatterns.find(pattern => skuCode.includes(pattern));
      
      if (foundPostFix) {
        console.log(`   ❌ ${skuCode} → Has post-fix: ${foundPostFix}`);
      } else {
        console.log(`   ✅ ${skuCode} → No post-fix (Base SKU)`);
      }
    });

    // Test the exact match query manually
    console.log('\n🧪 Testing Exact Match Query:');
    
    const modelKey = skuService.extractModelKey(deviceData.model);
    const capacityValue = deviceData.capacity ? deviceData.capacity.replace('GB', '').replace('TB', '000') : null;
    const colorKey = skuService.extractColorKey(deviceData.color);
    
    console.log(`   Model Key: ${modelKey}`);
    console.log(`   Capacity Value: ${capacityValue}`);
    console.log(`   Color Key: ${colorKey}`);

    let query = `
      SELECT sku_code, post_fix, is_unlocked, source_tab
      FROM sku_master 
      WHERE is_active = true
      AND sku_code LIKE $1
      AND sku_code LIKE $2
      AND sku_code LIKE $3
    `;

    const params = [
      `${modelKey}%`,
      `%-${capacityValue}-%`,
      `%-${colorKey}%`
    ];

    if (deviceData.isDeviceUnlocked) {
      query += ` AND sku_code NOT LIKE '%-%-%-%-%'`;
    } else {
      query += ` AND sku_code LIKE '%-%-%-%-%'`;
    }

    // Add post-fix filtering
    postFixPatterns.forEach(pattern => {
      query += ` AND sku_code NOT LIKE '%${pattern}'`;
    });

    query += ` ORDER BY sku_code LIMIT 10`;

    console.log(`\n🔍 Query: ${query}`);
    console.log(`   Params: ${params.join(', ')}`);

    const exactMatchResult = await client.query(query, params);
    console.log(`\n📊 Exact match candidates: ${exactMatchResult.rows.length}`);
    
    if (exactMatchResult.rows.length > 0) {
      exactMatchResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.sku_code} (Unlocked: ${row.is_unlocked})`);
      });
    } else {
      console.log('   ❌ No exact matches found!');
    }

    // Test the actual matching
    console.log('\n🧪 Testing Actual SKU Matching:');
    
    const match = await skuService.findBestMatchingSku(deviceData);
    
    if (match) {
      console.log(`\n✅ Best Match Found: ${match.sku_code}`);
      console.log(`   Score: ${(match.match_score * 100).toFixed(1)}%`);
      console.log(`   Method: ${match.match_method}`);
      
      // Check if it has post-fix
      const foundPostFix = postFixPatterns.find(pattern => match.sku_code.includes(pattern));
      if (foundPostFix) {
        console.log(`   ❌ PROBLEM: Matched SKU has post-fix: ${foundPostFix}`);
      } else {
        console.log(`   ✅ Good: No post-fix found`);
      }
    } else {
      console.log('\n❌ No match found - this explains the NULL!');
    }

    // Check for NULL values in current results
    console.log('\n🔍 Checking Current NULL Values:');
    
    const nullResults = await client.query(`
      SELECT imei, sku_matched, match_score, match_method
      FROM sku_matching_view 
      WHERE sku_matched IS NULL 
         OR match_score IS NULL
      ORDER BY imei
    `);

    console.log(`\n📊 Found ${nullResults.rows.length} records with NULL values:`);
    nullResults.rows.forEach(row => {
      console.log(`   📱 ${row.imei}: SKU=${row.sku_matched}, Score=${row.match_score}, Method=${row.match_method}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

debugPostFixIssue();
