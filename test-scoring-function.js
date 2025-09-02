const SkuMatchingService = require('./src/services/skuMatchingService');

async function testScoringFunction() {
  const skuService = new SkuMatchingService();
  
  console.log('🔍 Testing Scoring Function:');
  console.log('=============================');
  
  // Test device data for IMEI 353618520520570
  const deviceData = {
    brand: 'Samsung',
    model: 'Galaxy Z Fold3 Duos',
    capacity: '512GB',
    color: 'Phantom Black',
    carrier: 'Unlocked'
  };
  
  console.log('📱 Device Data:');
  console.log(`   Brand: ${deviceData.brand}`);
  console.log(`   Model: ${deviceData.model}`);
  console.log(`   Capacity: ${deviceData.capacity}`);
  console.log(`   Color: ${deviceData.color}`);
  console.log(`   Carrier: ${deviceData.carrier}`);
  
  // Test different SKUs
  const testSkus = [
    'FOLD3-512-BLK',      // Should be perfect match
    'FOLD3-512-BLK-ATT',  // Should be good match (wrong carrier)
    'FOLD3-256-BLK',      // Should be rejected (wrong capacity)
    'FOLD3-512-GREEN'     // Should be rejected (wrong color)
  ];
  
  console.log('\n🎯 Testing SKU Scoring:');
  console.log('========================');
  
  for (const skuCode of testSkus) {
    console.log(`\n📋 Testing SKU: ${skuCode}`);
    
    try {
      const parsedSku = skuService.parseSkuCode(skuCode);
      console.log(`   Parsed SKU:`, parsedSku);
      
      // Test the scoring function
      const score = skuService.calculateDeviceSimilarityWithCarrierLogic(
        deviceData,
        parsedSku,
        true // isDeviceUnlocked
      );
      
      console.log(`   Score: ${(score * 100).toFixed(1)}%`);
      console.log(`   Acceptable: ${score >= 0.8 ? '✅ YES' : '❌ NO'}`);
      
      // Check individual field scores
      const modelScore = skuService.compareFieldWithCharacterWeight(deviceData.model, parsedSku.model);
      const capacityScore = skuService.compareFieldWithCharacterWeight(deviceData.capacity, parsedSku.capacity);
      const colorScore = skuService.compareFieldWithCharacterWeight(deviceData.color, parsedSku.color);
      const carrierScore = skuService.compareFieldWithCharacterWeight(deviceData.carrier, parsedSku.carrier);
      
      console.log(`   Field Scores:`);
      console.log(`     Model: ${(modelScore * 100).toFixed(1)}%`);
      console.log(`     Capacity: ${(capacityScore * 100).toFixed(1)}%`);
      console.log(`     Color: ${(colorScore * 100).toFixed(1)}%`);
      console.log(`     Carrier: ${(carrierScore * 100).toFixed(1)}%`);
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
}

testScoringFunction();

