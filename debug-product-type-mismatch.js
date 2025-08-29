const { Client } = require('pg');
const SkuMatchingService = require('./src/services/skuMatchingService');
require('dotenv').config();

async function debugProductTypeMismatch() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  const skuService = new SkuMatchingService();

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Test the specific problematic IMEI
    const testImei = '356317536605163';
    console.log(`\n🔍 Debugging IMEI: ${testImei}`);

    // Get device data
    const deviceData = await skuService.getDeviceDataForMatching(testImei);
    
    if (!deviceData) {
      console.log('❌ No device data found');
      return;
    }

    console.log('\n📱 Device Information:');
    console.log(`   Brand: ${deviceData.brand}`);
    console.log(`   Model: ${deviceData.model}`);
    console.log(`   Capacity: ${deviceData.capacity}`);
    console.log(`   Color: ${deviceData.color}`);
    console.log(`   Carrier: ${deviceData.carrier}`);

    // Check what SKUs are available for Samsung devices
    console.log('\n🔍 Checking available Samsung SKUs in master:');
    
    const samsungSkus = await client.query(`
      SELECT sku_code, is_unlocked, source_tab
      FROM sku_master 
      WHERE sku_code LIKE '%SAMSUNG%' 
         OR sku_code LIKE '%GALAXY%'
         OR sku_code LIKE '%FOLD%'
         OR sku_code LIKE '%S7%'
         OR sku_code LIKE '%TAB%'
      ORDER BY sku_code
      LIMIT 20
    `);

    console.log('\n📦 Available Samsung SKUs:');
    samsungSkus.rows.forEach((sku, index) => {
      console.log(`   ${index + 1}. ${sku.sku_code} (Unlocked: ${sku.is_unlocked}, Source: ${sku.source_tab})`);
    });

    // Check specifically for Fold3 SKUs
    console.log('\n🔍 Looking for Fold3 specific SKUs:');
    
    const fold3Skus = await client.query(`
      SELECT sku_code, is_unlocked, source_tab
      FROM sku_master 
      WHERE sku_code LIKE '%FOLD%'
         OR sku_code LIKE '%FOLD3%'
         OR sku_code LIKE '%Z%FOLD%'
      ORDER BY sku_code
    `);

    if (fold3Skus.rows.length > 0) {
      console.log('\n📱 Fold3 SKUs found:');
      fold3Skus.rows.forEach((sku, index) => {
        console.log(`   ${index + 1}. ${sku.sku_code} (Unlocked: ${sku.is_unlocked}, Source: ${sku.source_tab})`);
      });
    } else {
      console.log('\n❌ NO Fold3 SKUs found in master!');
    }

    // Check for tablet SKUs
    console.log('\n📱 Looking for tablet SKUs:');
    
    const tabletSkus = await client.query(`
      SELECT sku_code, is_unlocked, source_tab
      FROM sku_master 
      WHERE sku_code LIKE '%TAB%'
         OR sku_code LIKE '%S7%PLUS%'
         OR sku_code LIKE '%S7-PLUS%'
      ORDER BY sku_code
    `);

    if (tabletSkus.rows.length > 0) {
      console.log('\n📱 Tablet SKUs found:');
      tabletSkus.rows.forEach((sku, index) => {
        console.log(`   ${index + 1}. ${sku.sku_code} (Unlocked: ${sku.is_unlocked}, Source: ${sku.source_tab})`);
      });
    }

    // Test the matching logic manually
    console.log('\n🧪 Testing matching logic manually:');
    
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
      console.log(`\n✅ Best Match Found: ${match.sku_code}`);
      console.log(`   Score: ${(match.match_score * 100).toFixed(1)}%`);
      console.log(`   Method: ${match.match_method}`);
      
      if (match.parsed_info) {
        console.log(`   Parsed Info: ${match.parsed_info.brand} ${match.parsed_info.model} ${match.parsed_info.capacity} ${match.parsed_info.color} ${match.parsed_info.carrier}`);
      }
    }

    console.log('\n🎯 Analysis:');
    console.log('The issue is that the system is matching a phone (Fold3) to a tablet (S7-PLUS)');
    console.log('This suggests either:');
    console.log('1. Missing Fold3 SKUs in the master data');
    console.log('2. Poor model matching logic');
    console.log('3. No product type validation');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

debugProductTypeMismatch();
