const { Client } = require('pg');
const SkuMatchingService = require('./src/services/skuMatchingService');
require('dotenv').config();

async function debugTieredMatching() {
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
    console.log(`\n🔍 Debugging Tiered Matching for IMEI: ${testImei}`);

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

    // Test each tier individually
    console.log('\n🎯 Testing Tier 1: Exact Matches');
    console.log('================================');
    
    const exactMatches = await skuService.findExactMatches(client, {
      brand: deviceData.brand,
      model: deviceData.model,
      capacity: deviceData.capacity,
      color: deviceData.color,
      carrier: deviceData.carrier,
      isDeviceUnlocked: false
    });
    
    if (exactMatches) {
      console.log(`✅ Found exact match: ${exactMatches.sku_code} (${(exactMatches.match_score * 100).toFixed(1)}%)`);
    } else {
      console.log('❌ No exact matches found');
    }

    console.log('\n🎯 Testing Tier 2: Brand + Model Matches');
    console.log('========================================');
    
    const brandModelMatches = await skuService.findBrandModelMatches(client, {
      brand: deviceData.brand,
      model: deviceData.model,
      capacity: deviceData.capacity,
      color: deviceData.color,
      carrier: deviceData.carrier,
      isDeviceUnlocked: false
    });
    
    if (brandModelMatches) {
      console.log(`✅ Found brand+model match: ${brandModelMatches.sku_code} (${(brandModelMatches.match_score * 100).toFixed(1)}%)`);
    } else {
      console.log('❌ No brand+model matches found');
    }

    console.log('\n🎯 Testing Tier 3: Brand + Capacity Matches');
    console.log('===========================================');
    
    const brandCapacityMatches = await skuService.findBrandCapacityMatches(client, {
      brand: deviceData.brand,
      model: deviceData.model,
      capacity: deviceData.capacity,
      color: deviceData.color,
      carrier: deviceData.carrier,
      isDeviceUnlocked: false
    });
    
    if (brandCapacityMatches) {
      console.log(`✅ Found brand+capacity match: ${brandCapacityMatches.sku_code} (${(brandCapacityMatches.match_score * 100).toFixed(1)}%)`);
    } else {
      console.log('❌ No brand+capacity matches found');
    }

    console.log('\n🎯 Testing Tier 4: Brand-Only Matches');
    console.log('=====================================');
    
    const brandMatches = await skuService.findBrandMatches(client, {
      brand: deviceData.brand,
      model: deviceData.model,
      capacity: deviceData.capacity,
      color: deviceData.color,
      carrier: deviceData.carrier,
      isDeviceUnlocked: false
    });
    
    if (brandMatches) {
      console.log(`✅ Found brand-only match: ${brandMatches.sku_code} (${(brandMatches.match_score * 100).toFixed(1)}%)`);
    } else {
      console.log('❌ No brand-only matches found');
    }

    // Test the full tiered matching
    console.log('\n🎯 Testing Full Tiered Matching');
    console.log('================================');
    
    const fullMatch = await skuService.findBestMatchingSku(deviceData);
    
    if (fullMatch) {
      console.log(`✅ Full tiered match: ${fullMatch.sku_code} (${(fullMatch.match_score * 100).toFixed(1)}%)`);
      console.log(`   Method: ${fullMatch.match_method}`);
    } else {
      console.log('❌ No full tiered match found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

debugTieredMatching();
