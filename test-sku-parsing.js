const SkuMatchingService = require('./src/services/skuMatchingService');

async function testSkuParsing() {
  const service = new SkuMatchingService();
  
  // Test device data (from our IMEI)
  const deviceData = {
    brand: 'Unknown',
    model: 'Galaxy Z Fold3 Duos',
    capacity: '256GB',
    color: 'Phantom Green',
    carrier: 'Unlocked'
  };
  
  console.log('🔍 Testing SKU Matching...');
  console.log('Device Data:', deviceData);
  
  // Test parsing some SKU codes
  const testSkus = [
    'FOLD3-256-BLK',
    'FOLD3-256-GREEN',
    'FOLD3-256-BLK-ATT',
    'A15-128-BLK-ATT'
  ];
  
  console.log('\n📋 Testing SKU Parsing:');
  for (const sku of testSkus) {
    const parsed = service.parseSkuCode(sku);
    console.log(`SKU: ${sku}`);
    console.log(`  Parsed:`, parsed);
  }
  
  // Test device similarity
  console.log('\n🔍 Testing Device Similarity:');
  const device1 = {
    brand: 'Unknown',
    model: 'Galaxy Z Fold3 Duos',
    capacity: '256GB',
    color: 'GRN',
    carrier: 'UNLOCKED'
  };
  
  const device2 = {
    brand: 'Samsung',
    model: 'Galaxy Z Fold3',
    capacity: '256GB',
    color: 'GRN',
    carrier: 'UNLOCKED'
  };
  
  const similarity = service.calculateDeviceSimilarity(device1, device2);
  console.log('Device 1:', device1);
  console.log('Device 2:', device2);
  console.log('Similarity Score:', similarity);
  
  // Test field comparison
  console.log('\n🔍 Testing Field Comparison:');
  console.log('Brand comparison:', service.compareField('Unknown', 'Samsung'));
  console.log('Model comparison:', service.compareField('Galaxy Z Fold3 Duos', 'Galaxy Z Fold3'));
  console.log('Capacity comparison:', service.compareField('256GB', '256GB'));
  console.log('Color comparison:', service.compareField('GRN', 'GRN'));
  console.log('Carrier comparison:', service.compareField('UNLOCKED', 'UNLOCKED'));
}

testSkuParsing().catch(console.error);
