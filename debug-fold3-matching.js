const { Client } = require('pg');
const SkuMatchingService = require('./src/services/skuMatchingService');
require('dotenv').config();

async function debugFold3Matching() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  const skuService = new SkuMatchingService();

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Test the problematic IMEI
    const testImei = '356317536605163';
    console.log(`\n🔍 Debugging Fold3 Matching for IMEI: ${testImei}`);

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

    // Test model matching logic
    console.log('\n🔍 Testing Model Matching Logic:');
    
    const testModels = [
      'FOLD3-512-BLK',
      'FOLD3-256-BLK-VRZ', 
      'ZFLIP4-512-BLK',
      'S22-256-BLK'
    ];

    testModels.forEach(testSku => {
      const parsedSku = skuService.parseSkuCode(testSku);
      const modelScore = skuService.compareField(deviceData.model, parsedSku.model);
      console.log(`   ${testSku} → Model: ${parsedSku.model}, Score: ${(modelScore * 100).toFixed(1)}%`);
    });

    // Check available Fold3 SKUs for this device
    console.log('\n📱 Available Fold3 SKUs for this device:');
    
    const fold3Skus = await client.query(`
      SELECT sku_code, is_unlocked, source_tab
      FROM sku_master 
      WHERE sku_code LIKE 'FOLD3-512%'
         OR sku_code LIKE 'FOLD3-256%'
      ORDER BY sku_code
    `);

    console.log('\n📦 Fold3 SKUs:');
    fold3Skus.rows.forEach((sku, index) => {
      console.log(`   ${index + 1}. ${sku.sku_code} (Unlocked: ${sku.is_unlocked}, Source: ${sku.source_tab})`);
    });

    // Test the matching logic manually for Fold3 SKUs
    console.log('\n🧪 Testing Fold3 SKU Matching:');
    
    const matchingData = {
      brand: deviceData.brand,
      model: deviceData.model,
      capacity: deviceData.capacity,
      color: deviceData.color,
      carrier: deviceData.carrier,
      device_notes: deviceData.device_notes,
      imei: deviceData.imei
    };

    // Test each Fold3 SKU manually
    for (const row of fold3Skus.rows) {
      const masterSku = row.sku_code;
      const parsedMasterSku = skuService.parseSkuCode(masterSku);
      
      const matchScore = skuService.calculateDeviceSimilarityWithCarrierLogic(
        { brand: deviceData.brand, model: deviceData.model, capacity: deviceData.capacity, color: deviceData.color, carrier: 'UNLOCKED' },
        parsedMasterSku,
        true // isDeviceUnlocked
      );
      
      console.log(`   ${masterSku}: ${(matchScore * 100).toFixed(1)}%`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

debugFold3Matching();
