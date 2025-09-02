const SkuMatchingService = require('./src/services/skuMatchingService');

async function testCapacityFix() {
  const skuService = new SkuMatchingService();
  
  console.log('🔍 Testing Capacity Matching Fix:');
  console.log('==================================');
  
  const testImeis = [
    '353618520520570',  // Should be FOLD3-512-BLK
    '350237727628665'   // Should be FOLD3-512-BLK-ATT
  ];
  
  for (const imei of testImeis) {
    console.log(`\n📱 Testing IMEI: ${imei}`);
    console.log('----------------------------------');
    
    try {
      // First get the device data
      const deviceData = await skuService.getDeviceDataForMatching(imei);
      if (!deviceData) {
        console.log('❌ No device data found for IMEI');
        continue;
      }
      
      console.log('📱 Device Data Retrieved:');
      console.log(`   Brand: ${deviceData.brand}`);
      console.log(`   Model: ${deviceData.model}`);
      console.log(`   Capacity: ${deviceData.capacity}`);
      console.log(`   Color: ${deviceData.color}`);
      console.log(`   Carrier: ${deviceData.carrier}`);
      
      // Now find the best matching SKU
      const bestMatch = await skuService.findBestMatchingSku(deviceData);
      
      if (bestMatch) {
        console.log(`✅ Match Found:`);
        console.log(`   SKU: ${bestMatch.sku_code}`);
        console.log(`   Score: ${(bestMatch.match_score * 100).toFixed(1)}%`);
        console.log(`   Method: ${bestMatch.match_method}`);
        
        // Check if capacity matches
        const skuParts = bestMatch.sku_code.split('-');
        const skuCapacity = skuParts[1];
        console.log(`   SKU Capacity: ${skuCapacity}`);
        
        // Get device data to compare
        const deviceData = await skuService.getDeviceDataForMatching(imei);
        if (deviceData) {
          const deviceCapacity = deviceData.capacity ? deviceData.capacity.replace(/[^0-9]/g, '') : '';
          console.log(`   Device Capacity: ${deviceCapacity}GB`);
          console.log(`   Capacity Match: ${skuCapacity === deviceCapacity ? '✅ YES' : '❌ NO'}`);
        }
      } else {
        console.log('❌ No match found');
      }
      
    } catch (error) {
      console.error(`❌ Error testing IMEI ${imei}:`, error.message);
    }
  }
}

testCapacityFix();
