const { Client } = require('pg');
const SkuMatchingService = require('./src/services/skuMatchingService');
require('dotenv').config();

async function debugSpecificImeiIssue() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  const skuService = new SkuMatchingService();

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Test the specific problematic IMEI
    const testImei = '352707355368444';
    console.log(`\n🔍 Debugging IMEI: ${testImei}`);

    // Get device data from database
    const deviceQuery = await client.query(`
      SELECT 
        p.imei,
        p.sku as original_sku,
        p.brand,
        p.model,
        p.capacity,
        p.color,
        p.carrier,
        dt.notes as device_notes,
        dt.working
      FROM product p
      LEFT JOIN device_test dt ON p.imei = dt.imei
      WHERE p.imei = $1
    `, [testImei]);

    if (deviceQuery.rows.length === 0) {
      console.log('❌ Device not found in database');
      return;
    }

    const deviceData = deviceQuery.rows[0];
    console.log('\n📱 Device Information:');
    console.log(`   IMEI: ${deviceData.imei}`);
    console.log(`   Original SKU: "${deviceData.original_sku}"`);
    console.log(`   Brand: "${deviceData.brand}"`);
    console.log(`   Model: "${deviceData.model}"`);
    console.log(`   Capacity: "${deviceData.capacity}"`);
    console.log(`   Color: "${deviceData.color}"`);
    console.log(`   Carrier: "${deviceData.carrier}"`);
    console.log(`   Notes: "${deviceData.device_notes}"`);
    console.log(`   Working: "${deviceData.working}"`);

    // Test carrier override logic
    console.log('\n🔧 Testing Carrier Override Logic:');
    const carrierOverride = skuService.parseNotesForCarrierOverride(
      deviceData.device_notes, 
      deviceData.brand, 
      deviceData.carrier
    );
    
    console.log(`   Original Carrier: "${deviceData.carrier}"`);
    console.log(`   Should Override: ${carrierOverride.shouldOverride}`);
    console.log(`   New Carrier: "${carrierOverride.newCarrier}"`);
    console.log(`   Is Failed: ${carrierOverride.isFailed}`);

    // Test SKU generation
    console.log('\n🔧 Testing SKU Generation:');
    const generatedSku = skuService.generateSkuFromDeviceData(
      deviceData.brand,
      deviceData.model,
      deviceData.capacity,
      deviceData.color,
      deviceData.carrier
    );
    console.log(`   Generated SKU: "${generatedSku}"`);

    // Check what SKUs are available for this device
    console.log('\n🔍 Checking available SKUs for this device:');
    
    const effectiveCarrier = carrierOverride.shouldOverride ? carrierOverride.newCarrier : deviceData.carrier;
    console.log(`   Effective Carrier: "${effectiveCarrier}"`);

    // Look for SKUs that might match
    const skuQuery = await client.query(`
      SELECT sku_code, post_fix, is_unlocked, source_tab
      FROM sku_master 
      WHERE is_active = true
      AND sku_code LIKE $1
      ORDER BY sku_code
    `, [`%${deviceData.model}%`]);

    console.log(`\n📊 Found ${skuQuery.rows.length} potential SKUs for model "${deviceData.model}":`);
    skuQuery.rows.forEach((sku, index) => {
      console.log(`   ${index + 1}. "${sku.sku_code}" (${sku.post_fix || 'no post-fix'})`);
    });

    // Test the actual matching
    console.log('\n🧪 Testing Actual Matching:');
    
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
      console.log(`\n✅ Best Match Found: "${match.sku_code}"`);
      console.log(`   Score: ${(match.match_score * 100).toFixed(1)}%`);
      console.log(`   Method: ${match.match_method}`);
      
      if (match.parsed_info) {
        console.log(`   Parsed Info: ${match.parsed_info.brand} ${match.parsed_info.model} ${match.parsed_info.capacity} ${match.parsed_info.color} ${match.parsed_info.carrier}`);
      }

      // Check if the matched SKU has post-fix
      const matchedSku = match.sku_code;
      const postFixPatterns = ['-VG', '-UV', '-ACCEPTABLE', '-UL', '-LN', '-NEW', '-TEST', '-EXCELLENT', '-GOOD', '-FAIR', '-LIKE'];
      const foundPostFix = postFixPatterns.find(pattern => matchedSku.includes(pattern));
      
      if (foundPostFix) {
        console.log(`   ⚠️  WARNING: Matched SKU has post-fix: ${foundPostFix}`);
        console.log(`   This should be avoided in the matching process!`);
      }
    } else {
      console.log('\n❌ No match found');
    }

    // Check current SKU matching results
    console.log('\n📊 Current SKU Matching Results:');
    const currentResult = await client.query(`
      SELECT matched_sku, match_score, match_method, match_notes
      FROM sku_matching_results
      WHERE imei = $1
    `, [testImei]);

    if (currentResult.rows.length > 0) {
      const result = currentResult.rows[0];
      console.log(`   Current Matched SKU: "${result.matched_sku}"`);
      console.log(`   Current Score: ${(result.match_score * 100).toFixed(1)}%`);
      console.log(`   Current Method: ${result.match_method}`);
      console.log(`   Current Notes: "${result.match_notes}"`);
    } else {
      console.log('   No current SKU matching result found');
    }

    console.log('\n🎯 Analysis:');
    console.log('The issue appears to be:');
    console.log('1. Carrier mismatch: T-Mobile device getting matched to ATT SKU');
    console.log('2. Color mismatch: Phantom Green being matched to BLK (Black)');
    console.log('3. Possible post-fix confusion in the matching logic');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

debugSpecificImeiIssue();
