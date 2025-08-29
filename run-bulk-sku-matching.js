const { Client } = require('pg');
const SkuMatchingService = require('./src/services/skuMatchingService');
require('dotenv').config();

async function runBulkSkuMatching() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
    // Add connection timeout settings
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    query_timeout: 30000
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log('\n🚀 BULK SKU MATCHING: Processing All Devices');
    console.log('=============================================');

    // Get all devices from sku_matching_view
    const devicesResult = await client.query(`
      SELECT imei, brand, model, capacity, color, carrier, device_notes
      FROM sku_matching_view
      ORDER BY imei
    `);

    const devices = devicesResult.rows;
    console.log(`📊 Found ${devices.length} devices to process`);

    const skuService = new SkuMatchingService();
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;

    // Process in smaller batches to avoid timeouts
    const batchSize = 10;
    const totalBatches = Math.ceil(devices.length / batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, devices.length);
      const batch = devices.slice(startIndex, endIndex);

      console.log(`\n🔄 Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} devices)`);

      for (const device of batch) {
        try {
          processedCount++;
          
          // Get device data for matching
          const deviceData = await skuService.getDeviceDataForMatching(device.imei);
          
          if (!deviceData) {
            console.log(`   ❌ ${processedCount}/${devices.length}: ${device.imei} → No device data found`);
            errorCount++;
            continue;
          }

          // Find best matching SKU
          const match = await skuService.findBestMatchingSku(deviceData);
          
          if (match) {
            // Update the sku_matching_results table
            await client.query(`
              INSERT INTO sku_matching_results (imei, original_sku, matched_sku, match_score, match_method, match_notes, processed_at)
              VALUES ($1, $2, $3, $4, $5, $6, NOW())
              ON CONFLICT (imei) 
              DO UPDATE SET 
                matched_sku = EXCLUDED.matched_sku,
                match_score = EXCLUDED.match_score,
                match_method = EXCLUDED.match_method,
                match_notes = EXCLUDED.match_notes,
                processed_at = NOW()
            `, [
              device.imei,
              deviceData.originalSku || 'N/A',
              match.sku_code,
              match.match_score,
              match.match_method,
              match.match_notes || ''
            ]);

            console.log(`   ✅ ${processedCount}/${devices.length}: ${device.imei} → ${match.sku_code} (${(match.match_score * 100).toFixed(1)}%)`);
            successCount++;
          } else {
            // No match found - update with NULL values
            await client.query(`
              INSERT INTO sku_matching_results (imei, original_sku, matched_sku, match_score, match_method, match_notes, processed_at)
              VALUES ($1, $2, NULL, 0, 'no_match', 'No matching SKU found', NOW())
              ON CONFLICT (imei) 
              DO UPDATE SET 
                matched_sku = NULL,
                match_score = 0,
                match_method = 'no_match',
                match_notes = 'No matching SKU found',
                processed_at = NOW()
            `, [
              device.imei,
              deviceData.originalSku || 'N/A'
            ]);

            console.log(`   ❌ ${processedCount}/${devices.length}: ${device.imei} → NO MATCH FOUND`);
            errorCount++;
          }

        } catch (error) {
          console.error(`   💥 ${processedCount}/${devices.length}: ${device.imei} → ERROR: ${error.message}`);
          errorCount++;
        }
      }

      // Small delay between batches to prevent overwhelming the database
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n🎉 BULK SKU MATCHING COMPLETED');
    console.log('===============================');
    console.log(`📊 Total processed: ${processedCount}`);
    console.log(`✅ Successful matches: ${successCount}`);
    console.log(`❌ Errors/No matches: ${errorCount}`);
    console.log(`📈 Success rate: ${((successCount / processedCount) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('❌ Error during bulk SKU matching:', error);
  } finally {
    try {
      await client.end();
      console.log('🔌 Database connection closed');
    } catch (error) {
      console.error('❌ Error closing database connection:', error);
    }
  }
}

runBulkSkuMatching();
