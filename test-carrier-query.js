const { Client } = require('pg');
require('dotenv').config();

async function testCarrierQuery() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log('\n🧪 TESTING CARRIER QUERIES');
    console.log('===========================');

    // Test 1: Find FOLD3-512-BLK-ATT (should exist)
    console.log('\n📱 Test 1: Looking for FOLD3-512-BLK-ATT');
    
    const test1 = await client.query(`
      SELECT sku_code, is_unlocked, source_tab
      FROM sku_master 
      WHERE is_active = true
      AND sku_code = 'FOLD3-512-BLK-ATT'
    `);

    console.log(`📊 Found: ${test1.rows.length} results`);
    test1.rows.forEach(sku => {
      console.log(`   - ${sku.sku_code} (Unlocked: ${sku.is_unlocked})`);
    });

    // Test 2: Check how many dashes FOLD3-512-BLK-ATT has
    console.log('\n📱 Test 2: Analyzing FOLD3-512-BLK-ATT structure');
    
    const test2 = await client.query(`
      SELECT sku_code, 
             LENGTH(sku_code) - LENGTH(REPLACE(sku_code, '-', '')) as dash_count
      FROM sku_master 
      WHERE sku_code = 'FOLD3-512-BLK-ATT'
    `);

    console.log(`📊 Analysis:`);
    test2.rows.forEach(sku => {
      console.log(`   - ${sku.sku_code} has ${sku.dash_count} dashes`);
    });

    // Test 3: Test the exact query from our tier system
    console.log('\n📱 Test 3: Testing tier system query for carrier-locked device');
    
    const test3 = await client.query(`
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
    `);

    console.log(`📊 Tier query results: ${test3.rows.length}`);
    test3.rows.forEach(sku => {
      console.log(`   - ${sku.sku_code} (Unlocked: ${sku.is_unlocked})`);
    });

    // Test 4: Test with correct dash count (3 dashes for carrier SKUs)
    console.log('\n📱 Test 4: Testing with correct dash count (3 dashes)');
    
    const test4 = await client.query(`
      SELECT sku_code, is_unlocked, source_tab
      FROM sku_master 
      WHERE is_active = true
      AND sku_code LIKE 'FOLD3%'
      AND sku_code LIKE '%-512-%'
      AND sku_code LIKE '%-BLK%'
      AND LENGTH(sku_code) - LENGTH(REPLACE(sku_code, '-', '')) = 3
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
    `);

    console.log(`📊 Corrected query results: ${test4.rows.length}`);
    test4.rows.forEach(sku => {
      console.log(`   - ${sku.sku_code} (Unlocked: ${sku.is_unlocked})`);
    });

    // Test 5: Check all FOLD3 SKUs with their dash counts
    console.log('\n📱 Test 5: All FOLD3 SKUs with dash counts');
    
    const test5 = await client.query(`
      SELECT sku_code, 
             LENGTH(sku_code) - LENGTH(REPLACE(sku_code, '-', '')) as dash_count,
             is_unlocked
      FROM sku_master 
      WHERE is_active = true
      AND sku_code LIKE 'FOLD3%'
      ORDER BY dash_count, sku_code
    `);

    console.log(`📊 All FOLD3 SKUs:`);
    test5.rows.forEach(sku => {
      console.log(`   - ${sku.sku_code} (${sku.dash_count} dashes, Unlocked: ${sku.is_unlocked})`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

testCarrierQuery();
