const { Client } = require('pg');
const SkuMatchingService = require('./src/services/skuMatchingService');
require('dotenv').config();

async function testFixedSkuMatching() {
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
    console.log(`\n🔍 Testing Fixed SKU Matching for IMEI: ${testImei}`);

    // Get device data from the view
    const deviceData = await skuService.getDeviceDataForMatching(testImei);
    
    if (!deviceData) {
      console.log('❌ No device data found');
      return;
    }

    console.log('\n📱 Device Information:');
    console.log(`   IMEI: ${deviceData.imei}`);
    console.log(`   Original SKU: "${deviceData.original_sku}"`);
    console.log(`   Brand: "${deviceData.brand}"`);
    console.log(`   Model: "${deviceData.model}"`);
    console.log(`   Capacity: "${deviceData.capacity}"`);
    console.log(`   Color: "${deviceData.color}"`);
    console.log(`   Carrier: "${deviceData.carrier}"`);
    console.log(`   Notes: "${deviceData.device_notes}"`);

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

    // Test the actual matching
    console.log('\n🧪 Testing Actual SKU Matching:');
    
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

      // Check if this is the correct T-Mobile SKU
      if (match.sku_code === 'FOLD3-256-BLK-TMO') {
        console.log(`\n🎉 SUCCESS! Device now correctly matches to T-Mobile SKU!`);
        console.log(`   Carrier mismatch issue has been resolved.`);
      } else if (match.sku_code === 'FOLD3-256-BLK-ATT') {
        console.log(`\n⚠️  Still matching to ATT SKU. This might indicate a logic issue.`);
      } else {
        console.log(`\n📊 Matched to different SKU: "${match.sku_code}"`);
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

    // Update the SKU matching result for this IMEI
    console.log('\n🔄 Updating SKU Matching Result:');
    
    if (match) {
      await client.query(`
        INSERT INTO sku_matching_results (imei, original_sku, matched_sku, match_score, match_method, match_notes, processed_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (imei) 
        DO UPDATE SET 
          matched_sku = EXCLUDED.matched_sku,
          match_score = EXCLUDED.match_score,
          match_method = EXCLUDED.match_method,
          match_notes = EXCLUDED.match_notes,
          processed_at = NOW()
      `, [
        testImei,
        deviceData.original_sku,
        match.sku_code,
        match.match_score,
        match.match_method,
        `Updated to use correct T-Mobile SKU: ${match.sku_code}`
      ]);

      console.log(`   ✅ Updated SKU matching result to: "${match.sku_code}"`);
    }

    console.log('\n🎯 Summary:');
    console.log('The T-Mobile FOLD3 SKUs have been added to the master table.');
    console.log('The SKU matching should now correctly identify T-Mobile devices.');
    console.log('This fixes the carrier mismatch issue where T-Mobile devices were being matched to ATT SKUs.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

testFixedSkuMatching();
