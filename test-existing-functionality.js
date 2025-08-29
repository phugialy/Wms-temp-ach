const SkuMatchingService = require('./src/services/skuMatchingService');

async function testExistingFunctionality() {
  const skuService = new SkuMatchingService();
  
  console.log('🔍 TESTING EXISTING FUNCTIONALITY');
  console.log('==================================');

  // Test product type detection
  console.log('\n📋 Testing Product Type Detection:');
  const testSkus = [
    'FOLD3-256-BLK-ATT-VG',
    'S22-256-BLK',
    'TAB-S8-ULTRA-128-BLK-WIFI',
    'WATCH-6-CLASSIC-47-4G-BLK'
  ];

  testSkus.forEach(sku => {
    const type = skuService.getProductType(sku);
    console.log(`   "${sku}" → ${type}`);
  });

  // Test existing SKU matching with a known device
  console.log('\n📋 Testing Existing SKU Matching:');
  
  const testDevice = {
    brand: 'Samsung',
    model: 'Galaxy Z Fold3 Duos',
    capacity: '256GB',
    color: 'Phantom Black',
    carrier: 'AT&T',
    device_notes: 'CARRIER LOCKED'
  };

  try {
    const result = await skuService.findBestMatchingSku(testDevice);
    
    if (result) {
      console.log(`   ✅ Match found: "${result.sku_code}"`);
      console.log(`   📊 Score: ${result.match_score.toFixed(3)}`);
      console.log(`   🔧 Method: ${result.match_method}`);
      
      if (result.carrier_override) {
        console.log(`   🔄 Carrier Override: ${result.carrier_override.original_carrier} → ${result.carrier_override.effective_carrier}`);
      }
    } else {
      console.log('   ❌ No match found');
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  console.log('\n✅ Existing functionality test completed!');
}

testExistingFunctionality().catch(console.error);

