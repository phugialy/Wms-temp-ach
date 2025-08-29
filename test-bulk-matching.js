const BulkSkuMatcher = require('./bulk-sku-matching');

async function testBulkMatching() {
  console.log('🧪 Testing Bulk SKU Matching with Small Batch');
  console.log('=============================================');
  
  const matcher = new BulkSkuMatcher();
  
  try {
    await matcher.connect();
    
    // Test with just 10 devices first
    console.log('\n🔧 Test Configuration:');
    console.log('   Batch size: 10');
    console.log('   Total limit: 10');
    
    // Override the getDevicesForProcessing method for testing
    const originalMethod = matcher.getDevicesForProcessing.bind(matcher);
    matcher.getDevicesForProcessing = async (limit) => {
      const devices = await originalMethod(limit);
      return devices.slice(0, 10); // Only process 10 devices for testing
    };
    
    // Process devices
    const stats = await matcher.processBatch(10);
    
    // Generate report
    await matcher.generateReport();
    
    console.log('\n✅ Test completed successfully!');
    console.log('🚀 Ready to run full bulk processing.');
    
  } catch (error) {
    console.error('❌ Error in test:', error);
  } finally {
    await matcher.disconnect();
  }
}

testBulkMatching();
