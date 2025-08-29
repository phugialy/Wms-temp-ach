const { Client } = require('pg');
require('dotenv').config();

async function checkTmobileSkus() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Check for T-Mobile SKUs for FOLD3 devices
    console.log('\n🔍 Checking T-Mobile SKUs for FOLD3 devices:');
    console.log('==============================================');
    
    const tmobileSkus = await client.query(`
      SELECT sku_code, post_fix, is_unlocked, source_tab
      FROM sku_master 
      WHERE is_active = true
      AND (sku_code LIKE '%FOLD3%' OR sku_code LIKE '%FOLD%')
      AND (sku_code LIKE '%TMO%' OR sku_code LIKE '%T-MOBILE%' OR sku_code LIKE '%TMOBILE%')
      ORDER BY sku_code
    `);

    console.log(`\n📊 Found ${tmobileSkus.rows.length} T-Mobile FOLD3 SKUs:`);
    tmobileSkus.rows.forEach((sku, index) => {
      console.log(`   ${index + 1}. "${sku.sku_code}" (${sku.post_fix || 'no post-fix'})`);
    });

    // Check for all FOLD3 SKUs to see what's available
    console.log('\n🔍 Checking all FOLD3 SKUs:');
    console.log('===========================');
    
    const allFold3Skus = await client.query(`
      SELECT sku_code, post_fix, is_unlocked, source_tab
      FROM sku_master 
      WHERE is_active = true
      AND (sku_code LIKE '%FOLD3%' OR sku_code LIKE '%FOLD%')
      ORDER BY sku_code
    `);

    console.log(`\n📊 Found ${allFold3Skus.rows.length} total FOLD3 SKUs:`);
    allFold3Skus.rows.forEach((sku, index) => {
      console.log(`   ${index + 1}. "${sku.sku_code}" (${sku.post_fix || 'no post-fix'})`);
    });

    // Check for ATT SKUs specifically
    console.log('\n🔍 Checking ATT FOLD3 SKUs:');
    console.log('============================');
    
    const attSkus = await client.query(`
      SELECT sku_code, post_fix, is_unlocked, source_tab
      FROM sku_master 
      WHERE is_active = true
      AND (sku_code LIKE '%FOLD3%' OR sku_code LIKE '%FOLD%')
      AND (sku_code LIKE '%ATT%' OR sku_code LIKE '%AT&T%')
      ORDER BY sku_code
    `);

    console.log(`\n📊 Found ${attSkus.rows.length} ATT FOLD3 SKUs:`);
    attSkus.rows.forEach((sku, index) => {
      console.log(`   ${index + 1}. "${sku.sku_code}" (${sku.post_fix || 'no post-fix'})`);
    });

    // Check for unlocked FOLD3 SKUs
    console.log('\n🔍 Checking Unlocked FOLD3 SKUs:');
    console.log('=================================');
    
    const unlockedSkus = await client.query(`
      SELECT sku_code, post_fix, is_unlocked, source_tab
      FROM sku_master 
      WHERE is_active = true
      AND (sku_code LIKE '%FOLD3%' OR sku_code LIKE '%FOLD%')
      AND (sku_code LIKE '%UNLOCKED%' OR sku_code LIKE '%UNL%')
      ORDER BY sku_code
    `);

    console.log(`\n📊 Found ${unlockedSkus.rows.length} Unlocked FOLD3 SKUs:`);
    unlockedSkus.rows.forEach((sku, index) => {
      console.log(`   ${index + 1}. "${sku.sku_code}" (${sku.post_fix || 'no post-fix'})`);
    });

    console.log('\n🎯 Analysis:');
    console.log('The issue is that there might not be a T-Mobile FOLD3 SKU available,');
    console.log('so the system is falling back to ATT SKU as the best match.');
    console.log('This is why we see the carrier mismatch.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkTmobileSkus();
