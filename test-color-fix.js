const SkuMatchingService = require('./src/services/skuMatchingService');

async function testColorFix() {
  const skuService = new SkuMatchingService();
  
  console.log('🎨 Testing Updated Color Normalization:');
  console.log('=====================================');
  
  const testColors = [
    'Phantom Green',
    'Phantom Black', 
    'Phantom Blue',
    'Phantom White',
    'BLK',
    'BLACK',
    'GREEN',
    'GRN',
    'BLUE',
    'BLU',
    'WHITE',
    'WHT',
    'SILVER',
    'SLV'
  ];
  
  testColors.forEach(color => {
    const normalized = skuService.normalizeColor(color);
    console.log(`   "${color}" -> "${normalized}"`);
  });
  
  console.log('\n🎯 Expected Results:');
  console.log('   "Phantom Green" -> "GREEN" (not GRN)');
  console.log('   "Phantom Black" -> "BLACK" (not BLK)');
  console.log('   "BLK" -> "BLACK" (full name)');
  console.log('   "GRN" -> "GREEN" (full name)');
}

testColorFix();

