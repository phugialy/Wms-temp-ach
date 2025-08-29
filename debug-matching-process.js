const { Client } = require('pg');
const SkuMatchingService = require('./src/services/skuMatchingService');
require('dotenv').config();

async function debugMatchingProcess() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  const skuService = new SkuMatchingService();

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Test the specific IMEI
    const testImei = '356317536605163';
    console.log(`\n🔍 Detailed Debug for IMEI: ${testImei}`);

    // Get device data
    const deviceData = await skuService.getDeviceDataForMatching(testImei);
    
    if (!deviceData) {
      console.log('❌ No device data found');
      return;
    }

    console.log('\n📱 Device Information:');
    console.log(`   Brand: ${deviceData.brand}`);
    console.log(`   Model: ${deviceData.model}`);
    console.log(`   Capacity: ${deviceData.capacity}`);
    console.log(`   Color: ${deviceData.color}`);
    console.log(`   Carrier: ${deviceData.carrier}`);
    console.log(`   Notes: ${deviceData.device_notes}`);

    // Test carrier override
    const carrierOverride = skuService.parseNotesForCarrierOverride(
      deviceData.device_notes, 
      deviceData.brand, 
      deviceData.carrier
    );
    
    console.log('\n🔧 Carrier Override:');
    console.log(`   Should Override: ${carrierOverride.shouldOverride}`);
    console.log(`   New Carrier: ${carrierOverride.newCarrier}`);
    
    const effectiveCarrier = carrierOverride.shouldOverride ? carrierOverride.newCarrier : deviceData.carrier;
    console.log(`   Effective Carrier: ${effectiveCarrier}`);
    
    const isDeviceUnlocked = skuService.isUnlockedCarrier(effectiveCarrier);
    console.log(`   Is Device Unlocked: ${isDeviceUnlocked}`);

    // Check what query would be executed
    console.log('\n🔍 Query Analysis:');
    
    let query;
    if (isDeviceUnlocked) {
      query = `
        SELECT 
          sku_code,
          post_fix,
          is_unlocked,
          source_tab
        FROM sku_master 
        WHERE is_active = true
      `;
    } else {
      query = `
        SELECT 
          sku_code,
          post_fix,
          is_unlocked,
          source_tab
        FROM sku_master 
        WHERE is_active = true
        AND sku_code LIKE '%-%-%-%-%'
      `;
    }
    
    console.log(`   Query Type: ${isDeviceUnlocked ? 'Unlocked (all SKUs)' : 'Carrier-specific'}`);
    console.log(`   Query: ${query}`);

    // Execute the query manually
    const result = await client.query(query);
    console.log(`   Total SKUs found: ${result.rows.length}`);

    // Check if FOLD3-512-BLK is in the results
    const fold3BaseSku = result.rows.find(row => row.sku_code === 'FOLD3-512-BLK');
    console.log(`   FOLD3-512-BLK in results: ${fold3BaseSku ? 'YES' : 'NO'}`);
    
    if (fold3BaseSku) {
      console.log(`   FOLD3-512-BLK details:`, fold3BaseSku);
    }

    // Check post-fix filtering
    console.log('\n🔍 Post-Fix Filtering:');
    const postFixPatterns = ['-VG', '-UV', '-ACCEPTABLE', '-UL', '-LN', '-NEW', '-TEST'];
    
    const fold3Skus = result.rows.filter(row => row.sku_code.startsWith('FOLD3'));
    console.log(`   Total Fold3 SKUs: ${fold3Skus.length}`);
    
    const baseFold3Skus = fold3Skus.filter(row => {
      const skuCode = row.sku_code;
      const hasPostFix = postFixPatterns.some(pattern => skuCode.includes(pattern));
      return !hasPostFix;
    });
    
    console.log(`   Base Fold3 SKUs (no post-fix): ${baseFold3Skus.length}`);
    baseFold3Skus.forEach(sku => {
      console.log(`     - ${sku.sku_code}`);
    });

    // Test the actual matching process step by step
    console.log('\n🧪 Step-by-Step Matching:');
    
    const matchingData = {
      brand: deviceData.brand,
      model: deviceData.model,
      capacity: deviceData.capacity,
      color: deviceData.color,
      carrier: deviceData.carrier,
      device_notes: deviceData.device_notes,
      imei: deviceData.imei
    };

    // Test with a few specific SKUs
    const testSkus = [
      'FOLD3-512-BLK',
      'FOLD3-512-BLK-ACCEPTABLE', 
      'ZFLIP4-512-BLK',
      'S22-256-BLK'
    ];

    for (const testSku of testSkus) {
      console.log(`\n   Testing: ${testSku}`);
      
      const parsedSku = skuService.parseSkuCode(testSku);
      console.log(`     Parsed: ${parsedSku.brand} ${parsedSku.model} ${parsedSku.capacity} ${parsedSku.color} ${parsedSku.carrier}`);
      
      const matchScore = skuService.calculateDeviceSimilarityWithCarrierLogic(
        { brand: deviceData.brand, model: deviceData.model, capacity: deviceData.capacity, color: deviceData.color, carrier: effectiveCarrier },
        parsedSku,
        isDeviceUnlocked
      );
      
      console.log(`     Score: ${(matchScore * 100).toFixed(1)}%`);
      
      // Check post-fix
      const hasPostFix = postFixPatterns.some(pattern => testSku.includes(pattern));
      if (hasPostFix) {
        console.log(`     ⚠️  Has post-fix - would be penalized`);
      }
      
      // Check product type
      const deviceProductType = skuService.getDeviceProductType(deviceData.model);
      const skuProductType = skuService.getProductType(testSku);
      if (deviceProductType !== skuProductType) {
        console.log(`     ❌ Product type mismatch: ${deviceProductType} vs ${skuProductType}`);
      }
    }

    // Now test the actual matching function
    console.log('\n🎯 Final Matching Test:');
    const match = await skuService.findBestMatchingSku(matchingData);
    
    if (match) {
      console.log(`   Best Match: ${match.sku_code}`);
      console.log(`   Score: ${(match.match_score * 100).toFixed(1)}%`);
      console.log(`   Method: ${match.match_method}`);
    } else {
      console.log(`   No match found`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

debugMatchingProcess();
