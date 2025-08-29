const { Client } = require('pg');
require('dotenv').config();

async function checkCarrierSkus() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log('\n🔍 CHECKING CARRIER-SPECIFIC SKUs');
    console.log('===================================');

    // Check for Fold3 carrier-specific SKUs
    console.log('\n📦 Fold3 Carrier-Specific SKUs:');
    
    const carrierSkus = await client.query(`
      SELECT sku_code, is_unlocked, source_tab
      FROM sku_master 
      WHERE is_active = true
      AND sku_code LIKE 'FOLD3%'
      AND sku_code LIKE '%-%-%-%-%'
      ORDER BY sku_code
    `);

    console.log(`\n📊 Found ${carrierSkus.rows.length} Fold3 carrier-specific SKUs:`);
    carrierSkus.rows.forEach(sku => {
      console.log(`   - ${sku.sku_code} (Unlocked: ${sku.is_unlocked}, Source: ${sku.source_tab})`);
    });

    // Check for AT&T specific SKUs
    console.log('\n📱 AT&T Specific SKUs:');
    
    const attSkus = await client.query(`
      SELECT sku_code, is_unlocked, source_tab
      FROM sku_master 
      WHERE is_active = true
      AND sku_code LIKE '%ATT%'
      ORDER BY sku_code
    `);

    console.log(`\n📊 Found ${attSkus.rows.length} AT&T SKUs:`);
    attSkus.rows.forEach(sku => {
      console.log(`   - ${sku.sku_code} (Unlocked: ${sku.is_unlocked}, Source: ${sku.source_tab})`);
    });

    // Check for T-Mobile specific SKUs
    console.log('\n📱 T-Mobile Specific SKUs:');
    
    const tmobileSkus = await client.query(`
      SELECT sku_code, is_unlocked, source_tab
      FROM sku_master 
      WHERE is_active = true
      AND (sku_code LIKE '%TMOBILE%' OR sku_code LIKE '%TMO%')
      ORDER BY sku_code
    `);

    console.log(`\n📊 Found ${tmobileSkus.rows.length} T-Mobile SKUs:`);
    tmobileSkus.rows.forEach(sku => {
      console.log(`   - ${sku.sku_code} (Unlocked: ${sku.is_unlocked}, Source: ${sku.source_tab})`);
    });

    // Check for Verizon specific SKUs
    console.log('\n📱 Verizon Specific SKUs:');
    
    const verizonSkus = await client.query(`
      SELECT sku_code, is_unlocked, source_tab
      FROM sku_master 
      WHERE is_active = true
      AND (sku_code LIKE '%VERIZON%' OR sku_code LIKE '%VRZ%' OR sku_code LIKE '%VZW%')
      ORDER BY sku_code
    `);

    console.log(`\n📊 Found ${verizonSkus.rows.length} Verizon SKUs:`);
    verizonSkus.rows.forEach(sku => {
      console.log(`   - ${sku.sku_code} (Unlocked: ${sku.is_unlocked}, Source: ${sku.source_tab})`);
    });

    // Test the exact query that should work for carrier-locked devices
    console.log('\n🧪 Testing carrier-locked query for Fold3 512GB Black AT&T:');
    
    const testQuery = `
      SELECT sku_code, is_unlocked, source_tab
      FROM sku_master 
      WHERE is_active = true
      AND sku_code LIKE 'FOLD3%'
      AND sku_code LIKE '%-512-%'
      AND sku_code LIKE '%-BLK%'
      AND sku_code LIKE '%-%-%-%-%'
      AND sku_code NOT LIKE '%-VG'
      AND sku_code NOT LIKE '%-UV'
      AND sku_code NOT LIKE '%-ACCEPTABLE'
      AND sku_code NOT LIKE '%-UL'
      AND sku_code NOT LIKE '%-LN'
      AND sku_code NOT LIKE '%-NEW'
      AND sku_code NOT LIKE '%-TEST'
      AND sku_code NOT LIKE '%-EXCELLENT'
      AND sku_code NOT LIKE '%-GOOD'
      AND sku_code NOT LIKE '%-FAIR'
      AND sku_code NOT LIKE '%-LIKE'
      AND sku_code NOT LIKE '%--%'
      AND sku_code NOT LIKE '%(LIKE NEW)%'
      ORDER BY sku_code
    `;

    const testResult = await client.query(testQuery);
    console.log(`\n📊 Test query results (${testResult.rows.length}):`);
    testResult.rows.forEach(sku => {
      console.log(`   - ${sku.sku_code} (Unlocked: ${sku.is_unlocked})`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkCarrierSkus();
