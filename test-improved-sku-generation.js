const { Client } = require('pg');
require('dotenv').config();

// Import the SKU matching service
const SkuMatchingService = require('./src/services/skuMatchingService');

async function testImprovedSkuGeneration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    // Test the improved SKU generation logic
    console.log('\n🧪 Testing Improved SKU Generation Logic...');
    
    // Simulate the data that would come from the queue processor
    const testData = {
      imei: '350275820547424',
      model: 'Galaxy Z Fold3 Duos',
      capacity: 'N/A',
      color: 'Phantom Black',
      carrier: null, // Empty carrier should default to UNLOCKED
      brand: 'Samsung'
    };

    // Simulate the improved SKU generation logic
    function generateImprovedSKU(data) {
      const model = data.model || 'Unknown';
      const capacity = data.capacity || data.storage || 'N/A';
      const color = data.color || data.colour || 'N/A';
      const carrier = data.carrier || null; // Allow null for carrier
      
      // Clean and format components
      const cleanModel = model.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
      const cleanCapacity = capacity.toString().replace(/\s+/g, '').toUpperCase();
      
      // Enhanced color processing - limit to 10 characters and handle abbreviations
      let cleanColor = color.replace(/\s+/g, '').toUpperCase();
      if (cleanColor.length > 10) {
        cleanColor = cleanColor.substring(0, 10);
      }
      
      // Enhanced carrier processing - default to UNLOCKED when empty/null
      let cleanCarrier = 'UNLOCKED'; // Default for unlocked devices
      if (carrier && carrier.trim() !== '') {
        cleanCarrier = carrier.replace(/\s+/g, '').toUpperCase();
        // Limit carrier to reasonable length
        if (cleanCarrier.length > 10) {
          cleanCarrier = cleanCarrier.substring(0, 10);
        }
      }
      
      // Generate SKU in format: Model-Capacity-Color-Carrier
      const sku = `${cleanModel}-${cleanCapacity}-${cleanColor}-${cleanCarrier}`;
      
      return {
        sku,
        components: {
          model: cleanModel,
          capacity: cleanCapacity,
          color: cleanColor,
          carrier: cleanCarrier
        }
      };
    }

    // Generate the improved SKU
    const generatedSku = generateImprovedSKU(testData);
    console.log('✅ Generated SKU:');
    console.log(`   Original: GalaxyZFold3Duos-N/A-PHA-UNL`);
    console.log(`   Improved: ${generatedSku.sku}`);
    console.log('   Components:');
    console.log(`     Model: ${generatedSku.components.model}`);
    console.log(`     Capacity: ${generatedSku.components.capacity}`);
    console.log(`     Color: ${generatedSku.components.color}`);
    console.log(`     Carrier: ${generatedSku.components.carrier}`);

    // Test the color normalization
    console.log('\n🎨 Testing Color Normalization...');
    const skuMatchingService = new SkuMatchingService();
    
    const testColors = ['PHA', 'Phantom Black', 'BLK', 'BLACK', 'HAZ', 'Hazel'];
    testColors.forEach(color => {
      const normalized = skuMatchingService.normalizeColor(color);
      console.log(`   "${color}" -> "${normalized}"`);
    });

    // Test SKU matching with the improved logic
    console.log('\n🔍 Testing SKU Matching with Improved Logic...');
    
    // Create device data for matching
    const deviceData = {
      brand: 'Samsung',
      model: 'Galaxy Z Fold3 Duos',
      capacity: 'N/A',
      color: 'Phantom Black', // This should be normalized to 'BLK'
      carrier: null // This should be normalized to 'UNLOCKED'
    };

    console.log('   Device Data:');
    console.log(`     Brand: ${deviceData.brand}`);
    console.log(`     Model: ${deviceData.model}`);
    console.log(`     Capacity: ${deviceData.capacity}`);
    console.log(`     Color: ${deviceData.color} (will be normalized to BLK)`);
    console.log(`     Carrier: ${deviceData.carrier} (will be normalized to UNLOCKED)`);

    // Find best match
    const bestMatch = await skuMatchingService.findBestMatchingSku(deviceData);
    
    if (bestMatch) {
      console.log('\n✅ Best Match Found:');
      console.log(`   SKU Code: ${bestMatch.sku_code}`);
      console.log(`   Brand: ${bestMatch.brand}`);
      console.log(`   Model: ${bestMatch.model}`);
      console.log(`   Capacity: ${bestMatch.capacity}`);
      console.log(`   Color: ${bestMatch.color}`);
      console.log(`   Carrier: ${bestMatch.carrier}`);
      console.log(`   Match Score: ${(bestMatch.match_score * 100).toFixed(1)}%`);
      console.log(`   Match Method: ${bestMatch.match_method}`);
      console.log(`   Source Tab: ${bestMatch.source_tab}`);
      
      console.log('\n🎯 Expected Result:');
      console.log('   Should match: FOLD3-256-BLK (or similar)');
      console.log('   Because:');
      console.log('     - Model contains "Fold3"');
      console.log('     - Color "Phantom Black" normalized to "BLK"');
      console.log('     - Carrier null normalized to "UNLOCKED"');
      
    } else {
      console.log('\n❌ No match found');
    }

    // Test the actual database update
    console.log('\n💾 Testing Database Update...');
    
    // First, check if we have a test item in the database
    const testItem = await client.query(`
      SELECT imei, sku, brand
      FROM product 
      WHERE sku LIKE '%-%-%-%'
      LIMIT 1
    `);

    if (testItem.rows.length > 0) {
      const item = testItem.rows[0];
      console.log(`   Found test item: ${item.imei} with SKU: ${item.sku}`);
      
      if (bestMatch) {
        // Update the SKU
        const updateResult = await client.query(`
          UPDATE product 
          SET sku = $1, updated_at = NOW()
          WHERE imei = $2
          RETURNING imei, sku
        `, [bestMatch.sku_code, item.imei]);

        if (updateResult.rows.length > 0) {
          console.log('✅ Database updated successfully!');
          console.log(`   IMEI: ${updateResult.rows[0].imei}`);
          console.log(`   Old SKU: ${item.sku}`);
          console.log(`   New SKU: ${updateResult.rows[0].sku}`);
          
          // Log the match
          await client.query(`
            INSERT INTO sku_match_log (imei, original_sku, matched_sku, match_score, match_method, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
          `, [item.imei, item.sku, bestMatch.sku_code, bestMatch.match_score, bestMatch.match_method]);
          
          console.log('✅ Match logged successfully!');
        }
      }
    } else {
      console.log('   No test items found in database');
    }

  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    await client.end();
    console.log('\n🔗 Database connection closed');
  }
}

console.log('🚀 Testing Improved SKU Generation and Matching...\n');
testImprovedSkuGeneration();
