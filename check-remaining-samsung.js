const { Client } = require('pg');
require('dotenv').config();

async function checkRemainingSamsung() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    console.log('🔍 Checking remaining SAMSUNG devices with missing models...');

    // Check SAMSUNG devices with missing models
    const samsungNoModel = await client.query(`
      SELECT sku_code, brand, model, capacity, color, carrier, post_fix
      FROM sku_master 
      WHERE brand = 'SAMSUNG'
      AND (model IS NULL OR model = '')
      ORDER BY sku_code;
    `);
    
    console.log(`\n📱 SAMSUNG devices with missing model (${samsungNoModel.rows.length} found):`);
    samsungNoModel.rows.forEach(sku => {
      console.log(`   ${sku.sku_code} - Model: ${sku.model || 'NULL'}`);
    });

    // Check GOOGLE devices with missing models
    const googleNoModel = await client.query(`
      SELECT sku_code, brand, model, capacity, color, carrier, post_fix
      FROM sku_master 
      WHERE brand = 'GOOGLE'
      AND (model IS NULL OR model = '')
      ORDER BY sku_code;
    `);
    
    console.log(`\n📱 GOOGLE devices with missing model (${googleNoModel.rows.length} found):`);
    googleNoModel.rows.forEach(sku => {
      console.log(`   ${sku.sku_code} - Model: ${sku.model || 'NULL'}`);
    });

    // Check APPLE devices with missing models
    const appleNoModel = await client.query(`
      SELECT sku_code, brand, model, capacity, color, carrier, post_fix
      FROM sku_master 
      WHERE brand = 'APPLE'
      AND (model IS NULL OR model = '')
      ORDER BY sku_code;
    `);
    
    console.log(`\n📱 APPLE devices with missing model (${appleNoModel.rows.length} found):`);
    appleNoModel.rows.forEach(sku => {
      console.log(`   ${sku.sku_code} - Model: ${sku.model || 'NULL'}`);
    });

    // Test some specific patterns that might be missing
    console.log('\n🧪 Testing specific patterns...');
    
    const testSkus = [
      'S21-128-BLK',
      'S22-128-BLK', 
      'S23-128-BLK',
      'S24-128-BLK',
      'S25-128-BLK',
      'TAB-S8-128-BLK',
      'WATCH-4-40-BLK'
    ];

    for (const sku of testSkus) {
      try {
        const modelResult = await client.query(`SELECT get_model_from_sku($1) as model;`, [sku]);
        console.log(`   ${sku} -> Model: ${modelResult.rows[0].model || 'NULL'}`);
      } catch (error) {
        console.log(`   ${sku} -> ERROR: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Error checking remaining Samsung:', error);
  } finally {
    await client.end();
  }
}

checkRemainingSamsung();
