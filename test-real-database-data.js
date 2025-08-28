const SkuMatchingService = require('./src/services/skuMatchingService');
const { Client } = require('pg');
require('dotenv').config();

async function testRealDatabaseData() {
  const skuService = new SkuMatchingService();
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    console.log('\n🔍 TESTING REAL DATABASE DATA - SKU MATCHING ANALYSIS');
    console.log('=====================================================');

    // 1. Check SKU Master data
    console.log('\n📋 1. SKU MASTER DATA ANALYSIS');
    console.log('==============================');
    
    const skuMasterQuery = `
      SELECT 
        COUNT(*) as total_skus,
        COUNT(DISTINCT sku_code) as unique_skus,
        COUNT(DISTINCT brand) as brands,
        COUNT(DISTINCT carrier) as carriers
      FROM sku_master
    `;
    
    const skuMasterStats = await client.query(skuMasterQuery);
    const stats = skuMasterStats.rows[0];
    
    console.log(`📊 Total SKU Records: ${stats.total_skus}`);
    console.log(`📊 Unique SKU Codes: ${stats.unique_skus}`);
    console.log(`📊 Brands: ${stats.brands}`);
    console.log(`📊 Carriers: ${stats.carriers}`);

    // Show sample SKUs by brand
    const sampleSkusQuery = `
      SELECT brand, sku_code, carrier, COUNT(*) as count
      FROM sku_master 
      GROUP BY brand, sku_code, carrier
      ORDER BY brand, sku_code
      LIMIT 20
    `;
    
    const sampleSkus = await client.query(sampleSkusQuery);
    console.log('\n📋 Sample SKUs by Brand:');
    sampleSkus.rows.forEach((sku, index) => {
      console.log(`   ${index + 1}. ${sku.brand} - ${sku.sku_code} (${sku.carrier || 'UNLOCKED'})`);
    });

    // 2. Check device data
    console.log('\n📋 2. DEVICE DATA ANALYSIS');
    console.log('==========================');
    
    const deviceStatsQuery = `
      SELECT 
        COUNT(*) as total_devices,
        COUNT(DISTINCT brand) as brands,
        COUNT(DISTINCT carrier) as carriers,
        COUNT(CASE WHEN device_notes IS NOT NULL THEN 1 END) as devices_with_notes,
        COUNT(CASE WHEN device_notes LIKE '%UNLOCK%' THEN 1 END) as unlock_notes,
        COUNT(CASE WHEN device_notes LIKE '%FAIL%' THEN 1 END) as fail_notes
      FROM sku_matching_view 
      WHERE data_completeness = 'complete'
    `;
    
    const deviceStats = await client.query(deviceStatsQuery);
    const deviceData = deviceStats.rows[0];
    
    console.log(`📊 Total Devices: ${deviceData.total_devices}`);
    console.log(`📊 Brands: ${deviceData.brands}`);
    console.log(`📊 Carriers: ${deviceData.carriers}`);
    console.log(`📊 Devices with Notes: ${deviceData.devices_with_notes}`);
    console.log(`📊 Unlock Notes: ${deviceData.unlock_notes}`);
    console.log(`📊 Fail Notes: ${deviceData.fail_notes}`);

    // Show sample devices with notes
    const sampleDevicesQuery = `
      SELECT 
        imei,
        brand,
        model,
        carrier,
        device_notes,
        original_sku
      FROM sku_matching_view 
      WHERE data_completeness = 'complete'
      AND device_notes IS NOT NULL
      ORDER BY imei
      LIMIT 10
    `;
    
    const sampleDevices = await client.query(sampleDevicesQuery);
    console.log('\n📋 Sample Devices with Notes:');
    sampleDevices.rows.forEach((device, index) => {
      console.log(`   ${index + 1}. IMEI: ${device.imei}`);
      console.log(`      Brand: ${device.brand}, Model: ${device.model}`);
      console.log(`      Carrier: ${device.carrier || 'N/A'}`);
      console.log(`      Original SKU: "${device.original_sku}"`);
      console.log(`      Notes: "${device.device_notes}"`);
      console.log('');
    });

    // 3. Test specific IMEIs with detailed analysis
    console.log('\n📋 3. DETAILED IMEI TESTING');
    console.log('============================');
    
    // Get 5 devices for detailed testing
    const testDevicesQuery = `
      SELECT 
        imei,
        brand,
        model,
        capacity,
        color,
        carrier,
        device_notes,
        original_sku
      FROM sku_matching_view 
      WHERE data_completeness = 'complete'
      ORDER BY RANDOM()
      LIMIT 5
    `;
    
    const testDevices = await client.query(testDevicesQuery);
    
    for (const device of testDevices.rows) {
      console.log(`\n🔍 Testing IMEI: ${device.imei}`);
      console.log(`   Brand: ${device.brand}`);
      console.log(`   Model: ${device.model}`);
      console.log(`   Capacity: ${device.capacity}`);
      console.log(`   Color: ${device.color}`);
      console.log(`   Carrier: ${device.carrier || 'N/A'}`);
      console.log(`   Original SKU: "${device.original_sku}"`);
      console.log(`   Notes: "${device.device_notes || 'None'}"`);
      
      try {
        const deviceData = {
          brand: device.brand,
          model: device.model,
          capacity: device.capacity,
          color: device.color,
          carrier: device.carrier,
          device_notes: device.device_notes
        };

        const matchResult = await skuService.findBestMatchingSku(deviceData);
        
        if (matchResult) {
          if (matchResult.match_method === 'failed_device') {
            console.log(`   ❌ RESULT: Failed device - not processed`);
          } else {
            console.log(`   ✅ RESULT: "${matchResult.sku_code}"`);
            console.log(`   📊 Score: ${matchResult.match_score.toFixed(3)}`);
            console.log(`   🔧 Method: ${matchResult.match_method}`);
            
            if (matchResult.carrier_override) {
              console.log(`   🔄 Carrier Override: ${matchResult.carrier_override.original_carrier} → ${matchResult.carrier_override.effective_carrier}`);
            }
            
            if (matchResult.parsed_info) {
              console.log(`   📝 Parsed Info: ${JSON.stringify(matchResult.parsed_info)}`);
            }
          }
        } else {
          console.log(`   ❌ RESULT: No match found`);
        }
      } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
      }
    }

    // 4. Check current SKU matching results
    console.log('\n📋 4. CURRENT SKU MATCHING RESULTS');
    console.log('==================================');
    
    const resultsQuery = `
      SELECT 
        COUNT(*) as total_results,
        COUNT(CASE WHEN match_status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN match_notes LIKE '%Carrier override%' THEN 1 END) as carrier_overrides,
        AVG(match_score) as avg_score
      FROM sku_matching_results
    `;
    
    const resultsStats = await client.query(resultsQuery);
    const results = resultsStats.rows[0];
    
    console.log(`📊 Total Results: ${results.total_results}`);
    console.log(`📊 Completed: ${results.completed}`);
    console.log(`📊 Carrier Overrides: ${results.carrier_overrides}`);
    console.log(`📊 Average Score: ${parseFloat(results.avg_score || 0).toFixed(3)}`);

    // Show recent matches
    const recentMatchesQuery = `
      SELECT 
        imei,
        original_sku,
        matched_sku,
        match_score,
        match_method,
        match_notes,
        processed_at
      FROM sku_matching_results 
      ORDER BY processed_at DESC
      LIMIT 10
    `;
    
    const recentMatches = await client.query(recentMatchesQuery);
    console.log('\n📋 Recent SKU Matches:');
    recentMatches.rows.forEach((match, index) => {
      console.log(`   ${index + 1}. IMEI: ${match.imei}`);
      console.log(`      Original: "${match.original_sku}"`);
      console.log(`      Matched: "${match.matched_sku}"`);
      console.log(`      Score: ${parseFloat(match.match_score || 0).toFixed(3)} (${match.match_method})`);
      console.log(`      Notes: ${match.match_notes}`);
      console.log(`      Processed: ${match.processed_at}`);
      console.log('');
    });

    // 5. Test specific problematic cases
    console.log('\n📋 5. TESTING SPECIFIC CASES');
    console.log('============================');
    
    // Test the specific IMEI you mentioned earlier
    const specificImei = '350237720639396';
    console.log(`\n🔍 Testing Specific IMEI: ${specificImei}`);
    
    const specificDeviceQuery = `
      SELECT 
        imei,
        brand,
        model,
        capacity,
        color,
        carrier,
        device_notes,
        original_sku
      FROM sku_matching_view 
      WHERE imei = $1
    `;
    
    const specificDevice = await client.query(specificDeviceQuery, [specificImei]);
    
    if (specificDevice.rows.length > 0) {
      const device = specificDevice.rows[0];
      console.log(`   Brand: ${device.brand}`);
      console.log(`   Model: ${device.model}`);
      console.log(`   Capacity: ${device.capacity}`);
      console.log(`   Color: ${device.color}`);
      console.log(`   Carrier: ${device.carrier || 'N/A'}`);
      console.log(`   Original SKU: "${device.original_sku}"`);
      console.log(`   Notes: "${device.device_notes || 'None'}"`);
      
      const deviceData = {
        brand: device.brand,
        model: device.model,
        capacity: device.capacity,
        color: device.color,
        carrier: device.carrier,
        device_notes: device.device_notes
      };

      const matchResult = await skuService.findBestMatchingSku(deviceData);
      
      if (matchResult) {
        console.log(`   ✅ RESULT: "${matchResult.sku_code}"`);
        console.log(`   📊 Score: ${matchResult.match_score.toFixed(3)}`);
        console.log(`   🔧 Method: ${matchResult.match_method}`);
        
        if (matchResult.carrier_override) {
          console.log(`   🔄 Carrier Override: ${matchResult.carrier_override.original_carrier} → ${matchResult.carrier_override.effective_carrier}`);
        }
      } else {
        console.log(`   ❌ RESULT: No match found`);
      }
    } else {
      console.log(`   ❌ Device not found in database`);
    }

    console.log('\n✅ Real database testing completed!');
    console.log('📊 Check the results above for detailed analysis.');

  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await client.end();
  }
}

testRealDatabaseData().catch(console.error);
