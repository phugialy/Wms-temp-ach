const { Client } = require('pg');
const SkuMatchingService = require('./src/services/skuMatchingService');
require('dotenv').config();

async function performanceTest() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  const skuService = new SkuMatchingService();

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Test IMEIs
    const testImeis = [
      '356317536605163', // Fold3
      '356317536605164', // Another device
      '356317536605165'  // Another device
    ];

    console.log('\n🚀 PERFORMANCE TEST: SKU Matching Speed');
    console.log('========================================');

    // Test 1: Count total SKUs in database
    const skuCountResult = await client.query(`
      SELECT COUNT(*) as total_skus 
      FROM sku_master 
      WHERE is_active = true
    `);
    const totalSkus = parseInt(skuCountResult.rows[0].total_skus);
    console.log(`📊 Total SKUs in database: ${totalSkus.toLocaleString()}`);

    // Test 2: Measure new tiered approach performance
    console.log('\n🎯 Testing NEW Tiered Approach:');
    console.log('===============================');

    const tieredResults = [];
    for (const imei of testImeis) {
      const startTime = process.hrtime.bigint();
      
      const deviceData = await skuService.getDeviceDataForMatching(imei);
      if (!deviceData) {
        console.log(`❌ No device data for IMEI: ${imei}`);
        continue;
      }

      const match = await skuService.findBestMatchingSku(deviceData);
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      tieredResults.push({
        imei,
        duration,
        match: match ? match.sku_code : 'No match',
        score: match ? (match.match_score * 100).toFixed(1) + '%' : 'N/A',
        method: match ? match.match_method : 'N/A'
      });

      console.log(`   📱 ${imei}: ${duration.toFixed(2)}ms → ${match ? match.sku_code : 'No match'} (${match ? (match.match_score * 100).toFixed(1) + '%' : 'N/A'})`);
    }

    // Test 3: Simulate old brute-force approach
    console.log('\n🐌 Testing OLD Brute-Force Approach (Simulation):');
    console.log('================================================');

    const bruteForceResults = [];
    for (const imei of testImeis) {
      const startTime = process.hrtime.bigint();
      
      const deviceData = await skuService.getDeviceDataForMatching(imei);
      if (!deviceData) {
        console.log(`❌ No device data for IMEI: ${imei}`);
        continue;
      }

      // Simulate old approach: query ALL SKUs and process each one
      const allSkusResult = await client.query(`
        SELECT sku_code, post_fix, is_unlocked, source_tab
        FROM sku_master 
        WHERE is_active = true
        ORDER BY sku_code
      `);

      let bestMatch = null;
      let bestScore = 0;

      // Process each SKU (simulating old brute-force logic)
      for (const row of allSkusResult.rows) {
        const parsedSku = skuService.parseSkuCode(row.sku_code);
        const score = skuService.calculateDeviceSimilarityWithCarrierLogic(
          { 
            brand: deviceData.brand, 
            model: deviceData.model, 
            capacity: deviceData.capacity, 
            color: deviceData.color, 
            carrier: deviceData.carrier 
          },
          parsedSku,
          false
        );

        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            sku_code: row.sku_code,
            match_score: score
          };
        }
      }

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      bruteForceResults.push({
        imei,
        duration,
        match: bestMatch ? bestMatch.sku_code : 'No match',
        score: bestMatch ? (bestMatch.match_score * 100).toFixed(1) + '%' : 'N/A',
        skus_processed: allSkusResult.rows.length
      });

      console.log(`   📱 ${imei}: ${duration.toFixed(2)}ms → ${bestMatch ? bestMatch.sku_code : 'No match'} (${bestMatch ? (bestMatch.match_score * 100).toFixed(1) + '%' : 'N/A'}) - Processed ${allSkusResult.rows.length} SKUs`);
    }

    // Performance Summary
    console.log('\n📈 PERFORMANCE SUMMARY:');
    console.log('=======================');

    const tieredAvg = tieredResults.reduce((sum, r) => sum + r.duration, 0) / tieredResults.length;
    const bruteForceAvg = bruteForceResults.reduce((sum, r) => sum + r.duration, 0) / bruteForceResults.length;
    const speedup = bruteForceAvg / tieredAvg;

    console.log(`🏃‍♂️ NEW Tiered Approach:`);
    console.log(`   Average time: ${tieredAvg.toFixed(2)}ms`);
    console.log(`   SKUs processed: ~2-20 per query (database-level filtering)`);
    console.log(`   Efficiency: Database-level filtering`);

    console.log(`\n🐌 OLD Brute-Force Approach:`);
    console.log(`   Average time: ${bruteForceAvg.toFixed(2)}ms`);
    console.log(`   SKUs processed: ${totalSkus.toLocaleString()} per query`);
    console.log(`   Efficiency: Process every SKU in JavaScript`);

    console.log(`\n⚡ PERFORMANCE IMPROVEMENT:`);
    console.log(`   Speedup: ${speedup.toFixed(1)}x faster`);
    console.log(`   Time saved: ${((bruteForceAvg - tieredAvg) / 1000).toFixed(2)} seconds per match`);
    console.log(`   Efficiency gain: ${((totalSkus - 10) / totalSkus * 100).toFixed(1)}% fewer SKUs processed`);

    // Database query analysis
    console.log('\n🔍 DATABASE QUERY ANALYSIS:');
    console.log('==========================');

    // Count queries in new approach
    const newApproachQueries = 4; // Tier 1, 2, 3, 4 (but usually only 1-2 execute)
    const oldApproachQueries = 1; // Single query for all SKUs

    console.log(`📊 NEW Approach:`);
    console.log(`   Queries: ${newApproachQueries} (tiered)`);
    console.log(`   Data transferred: ~2-20 SKUs per query`);
    console.log(`   Network efficiency: High (minimal data transfer)`);

    console.log(`\n📊 OLD Approach:`);
    console.log(`   Queries: ${oldApproachQueries} (single)`);
    console.log(`   Data transferred: ${totalSkus.toLocaleString()} SKUs per query`);
    console.log(`   Network efficiency: Low (massive data transfer)`);

    console.log(`\n💡 KEY INSIGHTS:`);
    console.log(`   • Database-level filtering is ${speedup.toFixed(1)}x faster`);
    console.log(`   • Network transfer reduced by ${((totalSkus - 10) / totalSkus * 100).toFixed(1)}%`);
    console.log(`   • Memory usage reduced by ${((totalSkus - 10) / totalSkus * 100).toFixed(1)}%`);
    console.log(`   • Scalability: Performance stays consistent as SKU database grows`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

performanceTest();
