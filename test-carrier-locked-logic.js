const SkuMatchingService = require('./src/services/skuMatchingService');
require('dotenv').config();

async function testCarrierLockedLogic() {
  const skuService = new SkuMatchingService();
  
  console.log('🔍 TESTING CARRIER LOCKED LOGIC');
  console.log('================================');
  
  // Test case: Device with "CARRIER LOCKED" notes (this one actually has notes)
  const testImei = '350237727628665'; // This device has "CARRIER LOCKED" notes
  
  console.log(`\n📱 Testing IMEI: ${testImei}`);
  
  try {
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
    console.log(`   Notes: "${deviceData.device_notes || 'NULL'}"`);
    
    // Test carrier override logic
    const deviceBrand = deviceData.brand || skuService.getBrandFromModel(deviceData.model);
    const carrierOverride = skuService.parseNotesForCarrierOverride(deviceData.device_notes, deviceBrand, deviceData.carrier);
    
    console.log('\n🔍 Carrier Override Analysis:');
    console.log(`   Should Override: ${carrierOverride.shouldOverride}`);
    console.log(`   Original Carrier: ${deviceData.carrier}`);
    console.log(`   New Carrier: ${carrierOverride.newCarrier}`);
    console.log(`   Is Failed: ${carrierOverride.isFailed}`);
    
    // Test effective carrier
    const effectiveCarrier = carrierOverride.shouldOverride ? carrierOverride.newCarrier : deviceData.carrier;
    console.log(`   Effective Carrier: ${effectiveCarrier}`);
    
    // Test if device is unlocked
    const isDeviceUnlocked = skuService.isUnlockedCarrier(effectiveCarrier);
    console.log(`   Is Device Unlocked: ${isDeviceUnlocked}`);
    
    // Test the actual matching
    console.log('\n🎯 Testing Full Matching Process:');
    const match = await skuService.findBestMatchingSku(testImei);
    
    if (match) {
      console.log(`   ✅ Match Found: ${match.sku_code} (${(match.match_score * 100).toFixed(1)}%)`);
      console.log(`   Method: ${match.match_method}`);
    } else {
      console.log('   ❌ No match found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testCarrierLockedLogic();
