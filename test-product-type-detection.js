const { Client } = require('pg');
require('dotenv').config();

// Product Type Detection Function
function getProductType(sku) {
  if (!sku || typeof sku !== 'string') return 'unknown';
  
  const upperSku = sku.toUpperCase().trim();
  
  // Check for specific product type prefixes
  if (upperSku.startsWith('TAB-')) return 'tablet';
  if (upperSku.startsWith('WATCH-')) return 'watch';
  if (upperSku.startsWith('LAPTOP-')) return 'laptop';
  
  // Default to phone for existing SKUs
  return 'phone';
}

async function testProductTypeDetection() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    console.log('\n🔍 TESTING PRODUCT TYPE DETECTION');
    console.log('==================================');

    // Test with sample SKUs from your database
    console.log('\n📋 Testing with sample SKUs:');
    
    const sampleSkus = [
      'FOLD3-256-BLK-ATT-VG',
      'S22-256-BLK',
      'IPHONE15-512-BLU',
      'TAB-S8-ULTRA-128-BLK-WIFI',
      'WATCH-6-CLASSIC-47-4G-BLK',
      'LAPTOP-MACBOOK-512-SILVER'
    ];

    sampleSkus.forEach(sku => {
      const type = getProductType(sku);
      console.log(`   "${sku}" → ${type}`);
    });

    // Test with real data from your database
    console.log('\n📋 Testing with real database SKUs:');
    
    const realSkusQuery = `
      SELECT DISTINCT sku_code 
      FROM sku_master 
      ORDER BY sku_code 
      LIMIT 20
    `;
    
    const realSkus = await client.query(realSkusQuery);
    
    console.log('\n📊 Product Type Distribution:');
    const typeCounts = {};
    
    realSkus.rows.forEach(row => {
      const sku = row.sku_code;
      const type = getProductType(sku);
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      console.log(`   "${sku}" → ${type}`);
    });

    console.log('\n📈 Type Distribution Summary:');
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} SKUs`);
    });

    // Test with device data from sku_matching_view
    console.log('\n📋 Testing with device original SKUs:');
    
    const deviceSkusQuery = `
      SELECT DISTINCT original_sku 
      FROM sku_matching_view 
      WHERE original_sku IS NOT NULL
      ORDER BY original_sku 
      LIMIT 15
    `;
    
    const deviceSkus = await client.query(deviceSkusQuery);
    
    deviceSkus.rows.forEach(row => {
      const sku = row.original_sku;
      const type = getProductType(sku);
      console.log(`   "${sku}" → ${type}`);
    });

    console.log('\n✅ Product type detection testing completed!');

  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await client.end();
  }
}

testProductTypeDetection().catch(console.error);

