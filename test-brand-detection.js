const BulkDataProcessor = require('./src/queue/bulkDataProcessor');

async function testBrandDetection() {
  const processor = new BulkDataProcessor();
  
  // Test data similar to what comes from frontend
  const testData = {
    imei: '356254950619158',
    model: 'Galaxy Z Fold3 Duos',
    brand: 'Unknown', // This is what the frontend sends
    capacity: '256GB',
    color: 'Phantom Green',
    carrier: 'Unlocked',
    working: 'YES',
    location: 'DNCL-Inspection'
  };
  
  console.log('🔍 Testing Brand Detection Logic');
  console.log('Input data:', testData);
  
  // Test the data correction logic
  const correctedData = processor.correctAndStandardizeData(testData);
  
  console.log('\n✅ Corrected data:');
  console.log('  Model:', correctedData.model);
  console.log('  Brand:', correctedData.brand);
  console.log('  Capacity:', correctedData.capacity);
  console.log('  Color:', correctedData.color);
  console.log('  Carrier:', correctedData.carrier);
  console.log('  Working:', correctedData.working);
  
  // Test SKU generation
  const sku = processor.generateSKU(correctedData);
  console.log('\n🏷️ Generated SKU:', sku);
  
  // Test with different models
  const testCases = [
    { model: 'Galaxy Z Fold3 Duos', expectedBrand: 'Samsung' },
    { model: 'iPhone 13 Pro', expectedBrand: 'Apple' },
    { model: 'Google Pixel 8', expectedBrand: 'Google' },
    { model: 'Unknown Model', expectedBrand: 'Unknown' }
  ];
  
  console.log('\n🧪 Testing different models:');
  testCases.forEach((testCase, index) => {
    const testItem = { ...testData, model: testCase.model, brand: 'Unknown' };
    const corrected = processor.correctAndStandardizeData(testItem);
    console.log(`  Test ${index + 1}:`);
    console.log(`    Model: ${testCase.model}`);
    console.log(`    Expected Brand: ${testCase.expectedBrand}`);
    console.log(`    Detected Brand: ${corrected.brand}`);
    console.log(`    ✅ ${corrected.brand === testCase.expectedBrand ? 'PASS' : 'FAIL'}`);
  });
}

testBrandDetection().catch(console.error);
