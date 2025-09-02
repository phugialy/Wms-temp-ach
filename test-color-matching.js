const { Client } = require('pg');
const SkuMatchingService = require('./src/services/skuMatchingService');
require('dotenv').config();

async function testColorMatching() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  const skuService = new SkuMatchingService();

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Test the specific IMEI mentioned by user
    const testImei = '353899610526897';
    console.log(`\n🔍 Testing Color Matching for IMEI: ${testImei}`);

    // Get device data from database
    const deviceQuery = await client.query(`
             SELECT 
         p.imei,
         p.sku as original_sku,
         p.brand,
         i.model,
         i.capacity,
         i.color,
         i.carrier,
         dt.notes as device_notes
       FROM product p
       LEFT JOIN item i ON p.imei = i.imei
       LEFT JOIN device_test dt ON p.imei = dt.imei
       WHERE p.imei = $1
    `, [testImei]);

    if (deviceQuery.rows.length === 0) {
      console.log('❌ Device not found in database');
      return;
    }

    const deviceData = deviceQuery.rows[0];
    console.log('\n📱 Device Information:');
    console.log(`   IMEI: ${deviceData.imei}`);
    console.log(`   Original SKU: "${deviceData.original_sku}"`);
    console.log(`   Brand: "${deviceData.brand}"`);
    console.log(`   Model: "${deviceData.model}"`);
    console.log(`   Capacity: "${deviceData.capacity}"`);
    console.log(`   Color: "${deviceData.color}"`);
    console.log(`   Carrier: "${deviceData.carrier}"`);
    console.log(`   Notes: "${deviceData.device_notes}"`);

    // Test color normalization
    console.log('\n🎨 Testing Color Normalization:');
    const normalizedColor = skuService.normalizeColor(deviceData.color);
    console.log(`   Original: "${deviceData.color}"`);
    console.log(`   Normalized: "${normalizedColor}"`);

    // Check what SKUs are available for this device pattern
    console.log('\n🔍 Checking Available SKUs for Device Pattern:');
    
    // Extract model key (e.g., "Galaxy Z Fold3 Duos" -> "FOLD3")
    const modelKey = skuService.extractModelKey(deviceData.model);
    console.log(`   Model Key: "${modelKey}"`);
    
         // Extract capacity value (e.g., "256GB" -> "256")
     const capacityValue = deviceData.capacity ? deviceData.capacity.replace(/[^0-9]/g, '') : '';
     console.log(`   Capacity Value: "${capacityValue}"`);

    // Find SKUs that match the pattern: FOLD3-256-<COLOR>-<CARRIER>
    const skuQuery = await client.query(`
      SELECT sku_code, post_fix, is_unlocked, source_tab
      FROM sku_master 
      WHERE is_active = true
      AND sku_code LIKE $1
      AND sku_code LIKE $2
      ORDER BY sku_code
    `, [`%${modelKey}%`, `%${capacityValue}%`]);

    console.log(`\n📊 Found ${skuQuery.rows.length} SKUs matching pattern "${modelKey}-${capacityValue}-<COLOR>-<CARRIER>":`);
    skuQuery.rows.forEach((sku, index) => {
      console.log(`   ${index + 1}. "${sku.sku_code}" (${sku.post_fix || 'no post-fix'})`);
    });

    // Check for specific color matches
    console.log('\n🎨 Checking Color-Specific SKUs:');
    
    // Look for GREEN variants
    const greenSkus = skuQuery.rows.filter(sku => 
      sku.sku_code.includes('GRN') || sku.sku_code.includes('GREEN')
    );
    
    if (greenSkus.length > 0) {
      console.log(`\n✅ Found ${greenSkus.length} GREEN variants:`);
      greenSkus.forEach((sku, index) => {
        console.log(`   ${index + 1}. "${sku.sku_code}"`);
      });
    } else {
      console.log('\n❌ No GREEN variants found');
    }

    // Test the actual SKU matching
    console.log('\n🧪 Testing Actual SKU Matching:');
    
    const matchingData = {
      brand: deviceData.brand,
      model: deviceData.model,
      capacity: deviceData.capacity,
      color: deviceData.color,
      carrier: deviceData.carrier,
      device_notes: deviceData.device_notes,
      imei: deviceData.imei
    };

    const match = await skuService.findBestMatchingSku(matchingData);
    
    if (match) {
      console.log(`\n✅ Best Match Found: "${match.sku_code}"`);
      console.log(`   Score: ${(match.match_score * 100).toFixed(1)}%`);
      console.log(`   Method: ${match.match_method}`);
      
      if (match.parsed_info) {
        console.log(`   Parsed Info: ${match.parsed_info.brand} ${match.parsed_info.model} ${match.parsed_info.capacity} ${match.parsed_info.color} ${match.parsed_info.carrier}`);
      }

      // Check if this is the expected match
      const expectedPattern = `${modelKey}-${capacityValue}-GRN-TMO`;
      if (match.sku_code === expectedPattern) {
        console.log(`\n🎉 SUCCESS! Matched to expected SKU: "${expectedPattern}"`);
      } else {
        console.log(`\n⚠️  Expected: "${expectedPattern}", Got: "${match.sku_code}"`);
      }
    } else {
      console.log('\n❌ No match found');
    }

    console.log('\n🎯 Analysis:');
    console.log('The goal is to match device data to SKU master, not the other way around.');
    console.log('Device: Galaxy Z Fold3 Duos + 256GB + PHANTOM GREEN + T-Mobile');
    console.log('Should match to: FOLD3-256-GRN-TMO');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

testColorMatching();
