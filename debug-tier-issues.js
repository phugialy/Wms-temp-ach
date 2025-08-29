const { Client } = require('pg');
const SkuMatchingService = require('./src/services/skuMatchingService');
require('dotenv').config();

async function debugTierIssues() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  const skuService = new SkuMatchingService();

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log('\n🔍 DEBUGGING TIER SYSTEM ISSUES');
    console.log('================================');

    // Test cases for different scenarios
    const testCases = [
      {
        imei: '356317536605163',
        description: 'Fold3 512GB Black - CARRIER UNLOKED (should be unlocked)'
      },
      {
        imei: '350237727628665', 
        description: 'Device with NULL match - likely carrier locked issue'
      },
      {
        imei: '350237727780896',
        description: 'Another NULL match - color/carrier issue'
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n📱 Testing: ${testCase.description}`);
      console.log(`   IMEI: ${testCase.imei}`);

      // Get device data
      const deviceData = await skuService.getDeviceDataForMatching(testCase.imei);
      if (!deviceData) {
        console.log('   ❌ No device data found');
        continue;
      }

      console.log(`\n📋 Device Data:`);
      console.log(`   Brand: ${deviceData.brand}`);
      console.log(`   Model: ${deviceData.model}`);
      console.log(`   Capacity: ${deviceData.capacity}`);
      console.log(`   Color: ${deviceData.color}`);
      console.log(`   Carrier: ${deviceData.carrier}`);
      console.log(`   Notes: ${deviceData.device_notes}`);
      console.log(`   Is Unlocked: ${deviceData.isDeviceUnlocked}`);

      // Test color extraction
      const colorKey = skuService.extractColorKey(deviceData.color);
      console.log(`   Color Key: ${colorKey}`);

      // Test tier 1: Exact matches
      console.log(`\n🎯 TIER 1 - EXACT MATCHES:`);
      const exactMatches = await skuService.findExactMatches(client, deviceData);
      if (exactMatches) {
        console.log(`   ✅ Found: ${exactMatches.sku_code} (${(exactMatches.match_score * 100).toFixed(1)}%)`);
      } else {
        console.log(`   ❌ No exact matches found`);
      }

      // Test tier 2: Brand + Model
      console.log(`\n🎯 TIER 2 - BRAND + MODEL:`);
      const brandModelMatches = await skuService.findBrandModelMatches(client, deviceData);
      if (brandModelMatches) {
        console.log(`   ✅ Found: ${brandModelMatches.sku_code} (${(brandModelMatches.match_score * 100).toFixed(1)}%)`);
      } else {
        console.log(`   ❌ No brand+model matches found`);
      }

      // Test tier 3: Brand + Capacity
      console.log(`\n🎯 TIER 3 - BRAND + CAPACITY:`);
      const brandCapacityMatches = await skuService.findBrandCapacityMatches(client, deviceData);
      if (brandCapacityMatches) {
        console.log(`   ✅ Found: ${brandCapacityMatches.sku_code} (${(brandCapacityMatches.match_score * 100).toFixed(1)}%)`);
      } else {
        console.log(`   ❌ No brand+capacity matches found`);
      }

      // Test tier 4: Brand only
      console.log(`\n🎯 TIER 4 - BRAND ONLY:`);
      const brandMatches = await skuService.findBrandMatches(client, deviceData);
      if (brandMatches) {
        console.log(`   ✅ Found: ${brandMatches.sku_code} (${(brandMatches.match_score * 100).toFixed(1)}%)`);
      } else {
        console.log(`   ❌ No brand matches found`);
      }

      // Test full matching
      console.log(`\n🎯 FULL MATCHING PROCESS:`);
      const fullMatch = await skuService.findBestMatchingSku(deviceData);
      if (fullMatch) {
        console.log(`   ✅ Final Match: ${fullMatch.sku_code} (${(fullMatch.match_score * 100).toFixed(1)}%)`);
        console.log(`   Method: ${fullMatch.match_method}`);
      } else {
        console.log(`   ❌ NO MATCH FOUND - This explains the NULL!`);
      }

      console.log(`\n${'='.repeat(60)}`);
    }

    // Check current NULL values and their characteristics
    console.log(`\n🔍 ANALYZING NULL VALUES:`);
    
    const nullResults = await client.query(`
      SELECT 
        imei, 
        brand, 
        model, 
        capacity, 
        color, 
        carrier, 
        device_notes,
        sku_matched, 
        match_score, 
        match_method
      FROM sku_matching_view 
      WHERE sku_matched IS NULL 
         OR match_score IS NULL
      ORDER BY imei
    `);

    console.log(`\n📊 Found ${nullResults.rows.length} records with NULL values:`);
    nullResults.rows.forEach((row, index) => {
      console.log(`\n   📱 ${index + 1}. IMEI: ${row.imei}`);
      console.log(`      Brand: ${row.brand}`);
      console.log(`      Model: ${row.model}`);
      console.log(`      Capacity: ${row.capacity}`);
      console.log(`      Color: ${row.color}`);
      console.log(`      Carrier: ${row.carrier}`);
      console.log(`      Notes: ${row.device_notes}`);
      console.log(`      SKU: ${row.sku_matched}`);
      console.log(`      Score: ${row.match_score}`);
      console.log(`      Method: ${row.match_method}`);
    });

    // Check available SKUs for these devices
    if (nullResults.rows.length > 0) {
      console.log(`\n🔍 CHECKING AVAILABLE SKUs FOR NULL DEVICES:`);
      
      for (const nullDevice of nullResults.rows.slice(0, 3)) { // Check first 3
        console.log(`\n📱 Device: ${nullDevice.brand} ${nullDevice.model} ${nullDevice.capacity} ${nullDevice.color}`);
        
        // Check what SKUs exist for this brand/model
        const availableSkus = await client.query(`
          SELECT sku_code, is_unlocked, source_tab
          FROM sku_master 
          WHERE is_active = true
          AND sku_code LIKE $1
          ORDER BY sku_code
        `, [`${nullDevice.brand?.toUpperCase().substring(0, 3)}%`]);

        console.log(`   Available SKUs (${availableSkus.rows.length}):`);
        availableSkus.rows.slice(0, 10).forEach(sku => {
          console.log(`     - ${sku.sku_code} (Unlocked: ${sku.is_unlocked})`);
        });
        
        if (availableSkus.rows.length > 10) {
          console.log(`     ... and ${availableSkus.rows.length - 10} more`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

debugTierIssues();
