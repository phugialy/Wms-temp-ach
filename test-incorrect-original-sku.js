const { Client } = require('pg');
const SkuMatchingService = require('./src/services/skuMatchingService');
require('dotenv').config();

async function testIncorrectOriginalSku() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  const skuService = new SkuMatchingService();

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Find a device with an incorrect original SKU
    const query = `
      SELECT 
        imei,
        original_sku,
        brand,
        model,
        capacity,
        color,
        carrier,
        device_notes
      FROM sku_matching_view 
      WHERE original_sku LIKE '%-%-%-%'  -- Has a generated SKU
        AND brand IS NOT NULL 
        AND model IS NOT NULL
        AND capacity IS NOT NULL
      LIMIT 3
    `;

    const result = await client.query(query);
    
    if (result.rows.length === 0) {
      console.log('❌ No devices found with generated SKUs');
      return;
    }

    console.log('\n📱 Testing devices with potentially incorrect original SKUs:\n');

    for (const device of result.rows) {
      console.log(`🔍 Testing IMEI: ${device.imei}`);
      console.log(`   Original SKU: ${device.original_sku}`);
      console.log(`   Device Data: ${device.brand} ${device.model} ${device.capacity}GB ${device.color} ${device.carrier}`);
      
      // Get device data using the service
      const deviceData = await skuService.getDeviceDataForMatching(device.imei);
      
      if (!deviceData) {
        console.log('   ❌ No device data found');
        continue;
      }

      // Prepare matching data (this is what the system uses for matching)
      const matchingData = {
        brand: deviceData.brand,
        model: deviceData.model,
        capacity: deviceData.capacity,
        color: deviceData.color,
        carrier: deviceData.carrier,
        device_notes: deviceData.device_notes,
        imei: deviceData.imei
      };

      console.log(`   📊 Matching Data Used:`);
      console.log(`      Brand: ${matchingData.brand}`);
      console.log(`      Model: ${matchingData.model}`);
      console.log(`      Capacity: ${matchingData.capacity}`);
      console.log(`      Color: ${matchingData.color}`);
      console.log(`      Carrier: ${matchingData.carrier}`);

      // Find best matching SKU
      const match = await skuService.findBestMatchingSku(matchingData);
      
      if (match) {
        console.log(`   ✅ Best Match: ${match.sku_code}`);
        console.log(`   📈 Match Score: ${(match.match_score * 100).toFixed(1)}%`);
        console.log(`   🔧 Match Method: ${match.match_method}`);
        
        // Check if the match is different from original SKU
        if (match.sku_code !== device.original_sku) {
          console.log(`   🔄 SKU CORRECTION: ${device.original_sku} → ${match.sku_code}`);
        } else {
          console.log(`   ✅ SKU MATCHES: ${device.original_sku}`);
        }
      } else {
        console.log(`   ❌ No match found`);
      }
      
      console.log(''); // Empty line for readability
    }

    console.log('\n🎯 Summary:');
    console.log('The system uses the device characteristics (brand, model, capacity, color, carrier)');
    console.log('from the database to find the correct SKU, regardless of the original_sku value.');
    console.log('This means incorrect original SKUs can be corrected based on actual device data!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

testIncorrectOriginalSku();
