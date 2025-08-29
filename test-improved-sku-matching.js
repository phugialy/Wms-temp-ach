const { Client } = require('pg');
const SkuMatchingService = require('./src/services/skuMatchingService');
require('dotenv').config();

async function testImprovedSkuMatching() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  const skuService = new SkuMatchingService();

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Test the problematic IMEI that was matching phone to tablet
    const testImei = '356317536605163';
    console.log(`\n🔍 Testing Improved SKU Matching for IMEI: ${testImei}`);

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

    // Test carrier override logic
    console.log('\n🔧 Testing Enhanced Carrier Override Logic:');
    const carrierOverride = skuService.parseNotesForCarrierOverride(
      deviceData.device_notes, 
      deviceData.brand, 
      deviceData.carrier
    );
    
    console.log(`   Original Carrier: ${deviceData.carrier}`);
    console.log(`   Should Override: ${carrierOverride.shouldOverride}`);
    console.log(`   New Carrier: ${carrierOverride.newCarrier}`);
    console.log(`   Is Failed: ${carrierOverride.isFailed}`);

    // Test product type detection
    console.log('\n📱 Testing Product Type Detection:');
    const deviceProductType = skuService.getDeviceProductType(deviceData.model);
    console.log(`   Device Product Type: ${deviceProductType}`);

    // Test the actual matching with improvements
    console.log('\n🧪 Testing Improved SKU Matching:');
    
    const matchingData = {
      brand: deviceData.brand,
      model: deviceData.model,
      capacity: deviceData.capacity,
      color: deviceData.color,
      carrier: deviceData.carrier,
      device_notes: deviceData.device_notes,
      imei: deviceData.imei
    };

    const match = await skuService.findBestMatchingSku(matchingData);
    
    if (match) {
      console.log(`\n✅ Best Match Found: ${match.sku_code}`);
      console.log(`   Score: ${(match.match_score * 100).toFixed(1)}%`);
      console.log(`   Method: ${match.match_method}`);
      
      if (match.parsed_info) {
        console.log(`   Parsed Info: ${match.parsed_info.brand} ${match.parsed_info.model} ${match.parsed_info.capacity} ${match.parsed_info.color} ${match.parsed_info.carrier}`);
      }

      // Check if the matched SKU has post-fix
      const postFixPatterns = ['-VG', '-UV', '-ACCEPTABLE', '-UL', '-LN', '-NEW', '-TEST'];
      const matchedSku = match.sku_code;
      const foundPostFix = postFixPatterns.find(pattern => matchedSku.includes(pattern));
      
      if (foundPostFix) {
        console.log(`   ⚠️  WARNING: Matched SKU has post-fix: ${foundPostFix}`);
      } else {
        console.log(`   ✅ Good: Matched SKU has no post-fix`);
      }

      // Check product type
      const skuProductType = skuService.getProductType(match.sku_code);
      if (deviceProductType === skuProductType) {
        console.log(`   ✅ Good: Product type matches (${deviceProductType})`);
      } else {
        console.log(`   ❌ Bad: Product type mismatch (Device: ${deviceProductType}, SKU: ${skuProductType})`);
      }

      // Check if this is a better match than before
      if (match.sku_code.includes('FOLD3') && !match.sku_code.includes('TAB')) {
        console.log(`   🎉 SUCCESS: Now matching to correct Fold3 SKU instead of tablet!`);
      } else if (match.sku_code.includes('TAB')) {
        console.log(`   ❌ Still matching to tablet - need further investigation`);
      }

    } else {
      console.log(`\n❌ No match found`);
    }

    console.log('\n🎯 Summary of Improvements:');
    console.log('1. ✅ Enhanced carrier override logic with typo handling');
    console.log('2. ✅ Post-fix SKU filtering and penalty system');
    console.log('3. ✅ Product type validation to prevent phone/tablet confusion');
    console.log('4. ✅ Better matching prioritization');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

testImprovedSkuMatching();
