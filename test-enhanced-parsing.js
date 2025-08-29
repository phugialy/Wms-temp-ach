const SkuMatchingService = require('./src/services/skuMatchingService');

async function testEnhancedParsing() {
  const skuService = new SkuMatchingService();
  
  console.log('🔍 TESTING ENHANCED TYPE-SPECIFIC PARSING');
  console.log('==========================================');

  // Test different product types
  const testSkus = [
    // Phones (existing logic)
    'FOLD3-256-BLK-ATT-VG',
    'S22-256-BLK',
    'IPHONE15-512-BLU',
    
    // Tablets (new logic)
    'TAB-S8-ULTRA-128-BLK-WIFI',
    'TAB-S9-PLUS-256-GRN-CELLULAR',
    'TAB-IPAD-AIR-64-SILVER-WIFI',
    
    // Watches (new logic)
    'WATCH-6-CLASSIC-47-4G-BLK',
    'WATCH-SS-8-ULTRA-49-5G-BLK',
    'WATCH-APL-S10-48-BLK',
    
    // Laptops (new logic)
    'LAPTOP-MACBOOK-512-SILVER',
    'LAPTOP-SURFACE-256-BLK'
  ];

  console.log('\n📋 Testing SKU Parsing by Product Type:');
  
  testSkus.forEach(sku => {
    const productType = skuService.getProductType(sku);
    const parsed = skuService.parseSkuCode(sku);
    
    console.log(`\n   SKU: "${sku}"`);
    console.log(`   Type: ${productType}`);
    console.log(`   Parsed: Brand=${parsed.brand}, Model=${parsed.model}, Capacity=${parsed.capacity}, Color=${parsed.color}, Carrier=${parsed.carrier}`);
  });

  // Test existing phone matching still works
  console.log('\n📋 Testing Existing Phone Matching:');
  
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

  console.log('\n✅ Enhanced parsing test completed!');
}

testEnhancedParsing().catch(console.error);

