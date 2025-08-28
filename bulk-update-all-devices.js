const SkuMatchingService = require('./src/services/skuMatchingService');
const { Client } = require('pg');
require('dotenv').config();

async function bulkUpdateAllDevices() {
  const skuService = new SkuMatchingService();
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    console.log('\n🔄 BULK UPDATING ALL DEVICES WITH NEW SKU MATCHING LOGIC');
    console.log('==========================================================');

    // Get all devices that need SKU matching (excluding failed devices)
    console.log('\n📋 Fetching devices for SKU matching...');
    const devicesQuery = `
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
      WHERE data_completeness = 'complete'
      ORDER BY last_activity DESC
    `;

    const devicesResult = await client.query(devicesQuery);
    const devices = devicesResult.rows;

    console.log(`📊 Found ${devices.length} devices to process`);

    if (devices.length === 0) {
      console.log('❌ No devices found to process');
      return;
    }

    // Process devices in batches
    const batchSize = 10;
    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let failedDevices = [];
    let carrierOverrideCount = 0;

    console.log(`\n🔄 Processing devices in batches of ${batchSize}...`);

    for (let i = 0; i < devices.length; i += batchSize) {
      const batch = devices.slice(i, i + batchSize);
      
      console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(devices.length / batchSize)} (${batch.length} devices)`);

      for (const device of batch) {
        try {
          console.log(`   Processing IMEI: ${device.imei}`);
          
          // Prepare device data for SKU matching
          const deviceData = {
            brand: device.brand,
            model: device.model,
            capacity: device.capacity,
            color: device.color,
            carrier: device.carrier,
            device_notes: device.device_notes
          };

          // Find best matching SKU
          const matchResult = await skuService.findBestMatchingSku(deviceData);

          if (matchResult) {
            if (matchResult.match_method === 'failed_device') {
              console.log(`   ⚠️  SKIPPED: Failed device (${device.device_notes})`);
              skippedCount++;
              failedDevices.push({
                imei: device.imei,
                reason: 'Failed device',
                notes: device.device_notes
              });
            } else {
              // Update or insert SKU matching result
              const upsertQuery = `
                INSERT INTO sku_matching_results (
                  imei, 
                  original_sku, 
                  matched_sku, 
                  match_score, 
                  match_method, 
                  match_status, 
                  match_notes,
                  processed_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                ON CONFLICT (imei) DO UPDATE SET
                  original_sku = EXCLUDED.original_sku,
                  matched_sku = EXCLUDED.matched_sku,
                  match_score = EXCLUDED.match_score,
                  match_method = EXCLUDED.match_method,
                  match_status = EXCLUDED.match_status,
                  match_notes = EXCLUDED.match_notes,
                  processed_at = NOW()
              `;

              const matchNotes = matchResult.carrier_override ? 
                `Carrier override: ${matchResult.carrier_override.original_carrier} → ${matchResult.carrier_override.effective_carrier}` : 
                'Standard matching';

              await client.query(upsertQuery, [
                device.imei,
                device.original_sku,
                matchResult.sku_code,
                matchResult.match_score,
                matchResult.match_method,
                'completed',
                matchNotes
              ]);

              if (matchResult.carrier_override && matchResult.carrier_override.original_carrier !== matchResult.carrier_override.effective_carrier) {
                carrierOverrideCount++;
                console.log(`   ✅ MATCHED: "${matchResult.sku_code}" (Score: ${matchResult.match_score.toFixed(3)}) - Carrier Override Applied`);
              } else {
                console.log(`   ✅ MATCHED: "${matchResult.sku_code}" (Score: ${matchResult.match_score.toFixed(3)})`);
              }
              
              successCount++;
            }
          } else {
            console.log(`   ❌ NO MATCH: No suitable SKU found`);
            failedCount++;
            failedDevices.push({
              imei: device.imei,
              reason: 'No SKU match found',
              notes: device.device_notes
            });
          }

          processedCount++;

        } catch (error) {
          console.error(`   ❌ ERROR processing IMEI ${device.imei}:`, error.message);
          failedCount++;
          failedDevices.push({
            imei: device.imei,
            reason: `Error: ${error.message}`,
            notes: device.device_notes
          });
        }
      }

      // Small delay between batches to avoid overwhelming the database
      if (i + batchSize < devices.length) {
        console.log('   ⏳ Waiting 1 second before next batch...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Generate comprehensive report
    console.log('\n📊 BULK UPDATE COMPLETED - FINAL REPORT');
    console.log('==========================================');
    console.log(`📈 Total Devices Processed: ${processedCount}`);
    console.log(`✅ Successful Matches: ${successCount}`);
    console.log(`❌ Failed Matches: ${failedCount}`);
    console.log(`⚠️  Skipped (Failed Devices): ${skippedCount}`);
    console.log(`🔄 Carrier Overrides Applied: ${carrierOverrideCount}`);
    console.log(`📊 Success Rate: ${((successCount / processedCount) * 100).toFixed(1)}%`);

    // Show recent matches
    console.log('\n🔍 Recent SKU Matches (Last 10):');
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
      WHERE processed_at >= NOW() - INTERVAL '1 hour'
      ORDER BY processed_at DESC
      LIMIT 10
    `;

    const recentMatches = await client.query(recentMatchesQuery);
    
    if (recentMatches.rows.length > 0) {
      recentMatches.rows.forEach((match, index) => {
        console.log(`   ${index + 1}. IMEI: ${match.imei}`);
        console.log(`      Original: "${match.original_sku}"`);
        console.log(`      Matched: "${match.matched_sku}"`);
        console.log(`      Score: ${parseFloat(match.match_score || 0).toFixed(3)} (${match.match_method})`);
        console.log(`      Notes: ${match.match_notes}`);
        console.log('');
      });
    } else {
      console.log('   No recent matches found');
    }

    // Show carrier override examples
    if (carrierOverrideCount > 0) {
      console.log('\n🔄 Carrier Override Examples:');
      const overrideQuery = `
        SELECT 
          imei,
          original_sku,
          matched_sku,
          match_score,
          match_notes
        FROM sku_matching_results 
        WHERE match_notes LIKE '%Carrier override%'
        AND processed_at >= NOW() - INTERVAL '1 hour'
        ORDER BY processed_at DESC
        LIMIT 5
      `;

      const overrideResults = await client.query(overrideQuery);
      
      overrideResults.rows.forEach((match, index) => {
        console.log(`   ${index + 1}. IMEI: ${match.imei}`);
        console.log(`      Original: "${match.original_sku}"`);
        console.log(`      Matched: "${match.matched_sku}"`);
        console.log(`      Notes: ${match.match_notes}`);
        console.log(`      Score: ${parseFloat(match.match_score || 0).toFixed(3)}`);
        console.log('');
      });
    }

    // Show failed devices summary
    if (failedDevices.length > 0) {
      console.log('\n❌ Failed/Skipped Devices Summary:');
      console.log(`   Total Failed/Skipped: ${failedDevices.length}`);
      
      const failureReasons = {};
      failedDevices.forEach(device => {
        failureReasons[device.reason] = (failureReasons[device.reason] || 0) + 1;
      });

      Object.entries(failureReasons).forEach(([reason, count]) => {
        console.log(`   ${reason}: ${count} devices`);
      });
    }

    console.log('\n✅ Bulk update completed successfully!');
    console.log('📊 Check the database for updated SKU matching results.');

  } catch (error) {
    console.error('❌ Error during bulk update:', error);
  } finally {
    await client.end();
  }
}

bulkUpdateAllDevices().catch(console.error);
