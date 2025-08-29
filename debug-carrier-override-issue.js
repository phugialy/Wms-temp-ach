const { Client } = require('pg');
const SkuMatchingService = require('./src/services/skuMatchingService');
require('dotenv').config();

async function debugCarrierOverrideIssue() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  const skuService = new SkuMatchingService();

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Test the specific problematic IMEI
    const testImei = '356317536605163';
    console.log(`\n🔍 Debugging IMEI: ${testImei}`);

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
    console.log('\n🔧 Testing Carrier Override Logic:');
    const carrierOverride = skuService.parseNotesForCarrierOverride(
      deviceData.device_notes, 
      deviceData.brand, 
      deviceData.carrier
    );
    
    console.log(`   Original Carrier: ${deviceData.carrier}`);
    console.log(`   Should Override: ${carrierOverride.shouldOverride}`);
    console.log(`   New Carrier: ${carrierOverride.newCarrier}`);
    console.log(`   Is Failed: ${carrierOverride.isFailed}`);

    // Check what SKUs are available for this device
    console.log('\n🔍 Checking available SKUs for this device:');
    
    const effectiveCarrier = carrierOverride.shouldOverride ? carrierOverride.newCarrier : deviceData.carrier;
    console.log(`   Effective Carrier: ${effectiveCarrier}`);

    // Look for SKUs that might match
    const matchingSkus = await client.query(`
      SELECT sku_code, is_unlocked, source_tab
      FROM sku_master 
      WHERE sku_code LIKE 'FOLD3-256-BLK%'
         OR sku_code LIKE 'FOLD3-512-BLK%'
      ORDER BY sku_code
    `);

    console.log('\n📦 Potential Matching SKUs:');
    matchingSkus.rows.forEach((sku, index) => {
      console.log(`   ${index + 1}. ${sku.sku_code} (Unlocked: ${sku.is_unlocked}, Source: ${sku.source_tab})`);
    });

    // Analyze post-fix patterns
    console.log('\n🔍 Analyzing Post-Fix Patterns:');
    
    const postFixPatterns = ['-VG', '-UV', '-ACCEPTABLE', '-UL', '-LN', '-NEW', '-TEST'];
    
    matchingSkus.rows.forEach(sku => {
      const skuCode = sku.sku_code;
      const foundPostFix = postFixPatterns.find(pattern => skuCode.includes(pattern));
      
      if (foundPostFix) {
        console.log(`   ${skuCode} → Post-Fix: ${foundPostFix}`);
      } else {
        console.log(`   ${skuCode} → No Post-Fix (Base SKU)`);
      }
    });

    // Check for Verizon-specific SKUs
    console.log('\n📱 Looking for Verizon-specific SKUs:');
    
    const verizonSkus = await client.query(`
      SELECT sku_code, is_unlocked, source_tab
      FROM sku_master 
      WHERE sku_code LIKE '%VERIZON%'
         OR sku_code LIKE '%VRZ%'
         OR sku_code LIKE '%VZW%'
      ORDER BY sku_code
    `);

    if (verizonSkus.rows.length > 0) {
      console.log('\n📱 Verizon SKUs found:');
      verizonSkus.rows.forEach((sku, index) => {
        console.log(`   ${index + 1}. ${sku.sku_code} (Unlocked: ${sku.is_unlocked}, Source: ${sku.source_tab})`);
      });
    } else {
      console.log('\n❌ NO Verizon SKUs found!');
    }

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
      console.log(`\n✅ Best Match Found: ${match.sku_code}`);
      console.log(`   Score: ${(match.match_score * 100).toFixed(1)}%`);
      console.log(`   Method: ${match.match_method}`);
      
      if (match.parsed_info) {
        console.log(`   Parsed Info: ${match.parsed_info.brand} ${match.parsed_info.model} ${match.parsed_info.capacity} ${match.parsed_info.color} ${match.parsed_info.carrier}`);
      }

      // Check if the matched SKU has post-fix
      const matchedSku = match.sku_code;
      const foundPostFix = postFixPatterns.find(pattern => matchedSku.includes(pattern));
      
      if (foundPostFix) {
        console.log(`   ⚠️  WARNING: Matched SKU has post-fix: ${foundPostFix}`);
        console.log(`   This should be avoided in the matching process!`);
      }
    }

    console.log('\n🎯 Analysis:');
    console.log('The issue is that the system is confusing post-fixes with carriers.');
    console.log('-VG means "VERY GOOD" (post-fix), not Verizon');
    console.log('The carrier override logic needs to be fixed to avoid this confusion.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

debugCarrierOverrideIssue();
