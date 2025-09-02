const { Client } = require('pg');
require('dotenv').config();

// Helper function to identify patterns
function identifyPattern(tags) {
  if (tags.length === 0) return 'Empty';
  
  const pattern = tags.map(tag => {
    if (/^\d+$/.test(tag)) return 'NUMBER';
    if (/^\d+[GT]B?$/i.test(tag)) return 'CAPACITY';
    if (/^(BLK|BLU|WHT|RED|GRN|PUR|PNK|GLD|SLV|GRY|SG)$/i.test(tag)) return 'COLOR';
    if (/^(WIFI|4G|5G|UNLOCKED|ATT|VERIZON|TMOBILE)$/i.test(tag)) return 'CARRIER';
    if (/^(IPAD|IPHONE|FOLD|FLIP|GALAXY|PIXEL)$/i.test(tag)) return 'MODEL';
    if (/^(PRO|AIR|MINI|ULTRA|PLUS|1ST|2ND|3RD|4TH|5TH|6TH|7TH|8TH|9TH|10TH)$/i.test(tag)) return 'VARIANT';
    if (/^(VG|LL|A|TEST|GRADE-A|GRADE-B|OPENBOX|LIKE-NEW|UL)$/i.test(tag)) return 'SUFFIX';
    return 'TEXT';
  });
  
  return pattern.join('-');
}

async function analyzeSkuPatterns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log('=== SKU MASTER PATTERN ANALYSIS ===\n');

    // Get sample SKU codes to analyze patterns
    const patterns = await client.query(`
      SELECT sku_code, LENGTH(sku_code) as length 
      FROM sku_master 
      WHERE is_active = true 
      ORDER BY LENGTH(sku_code) DESC 
      LIMIT 20
    `);

    console.log('📊 SKU Code Length Distribution:');
    patterns.rows.forEach((row, i) => {
      console.log(`${i+1}. "${row.sku_code}" (${row.length} chars)`);
    });

    // Analyze different SKU formats
    console.log('\n🔍 SKU Format Analysis:');
    
    // Check for dash-separated SKUs
    const dashSkus = await client.query(`
      SELECT sku_code FROM sku_master 
      WHERE is_active = true AND sku_code LIKE '%-%'
      LIMIT 10
    `);
    
    if (dashSkus.rows.length > 0) {
      console.log('\n📋 Dash-Separated SKUs:');
      dashSkus.rows.forEach(row => {
        const tags = row.sku_code.split('-');
        console.log(`   "${row.sku_code}"`);
        console.log(`      Tags: [${tags.map(t => `"${t.trim()}"`).join(', ')}]`);
        console.log(`      Pattern: ${identifyPattern(tags.map(t => t.trim()))}`);
      });
    }

    // Check for Apple part numbers
    const appleSkus = await client.query(`
      SELECT sku_code FROM sku_master 
      WHERE is_active = true AND sku_code LIKE '%/%'
      LIMIT 10
    `);
    
    if (appleSkus.rows.length > 0) {
      console.log('\n🍎 Apple Part Number SKUs:');
      appleSkus.rows.forEach(row => {
        const tags = row.sku_code.split('/');
        console.log(`   "${row.sku_code}"`);
        console.log(`      Tags: [${tags.map(t => `"${t.trim()}"`).join(', ')}]`);
        console.log(`      Pattern: ${identifyPattern(tags.map(t => t.trim()))}`);
      });
    }

    // Check for simple SKUs
    const simpleSkus = await client.query(`
      SELECT sku_code FROM sku_master 
      WHERE is_active = true 
      AND sku_code NOT LIKE '%-%' 
      AND sku_code NOT LIKE '%/%'
      LIMIT 10
    `);
    
    if (simpleSkus.rows.length > 0) {
      console.log('\n🔢 Simple SKUs:');
      simpleSkus.rows.forEach(row => {
        console.log(`   "${row.sku_code}" → ["${row.sku_code}"]`);
      });
    }

    // Analyze specific patterns
    console.log('\n🎯 Specific Pattern Analysis:');
    
    // iPad patterns
    const ipadSkus = await client.query(`
      SELECT sku_code FROM sku_master 
      WHERE is_active = true AND sku_code LIKE '%IPAD%'
      LIMIT 5
    `);
    
    if (ipadSkus.rows.length > 0) {
      console.log('\n📱 iPad SKU Patterns:');
      ipadSkus.rows.forEach(row => {
        const tags = row.sku_code.split('-');
        console.log(`   "${row.sku_code}"`);
        console.log(`      Tags: [${tags.map(t => `"${t.trim()}"`).join(', ')}]`);
        console.log(`      Pattern: ${identifyPattern(tags.map(t => t.trim()))}`);
      });
    }

    // Samsung patterns
    const samsungSkus = await client.query(`
      SELECT sku_code FROM sku_master 
      WHERE is_active = true AND sku_code LIKE '%FOLD%'
      LIMIT 5
    `);
    
    if (samsungSkus.rows.length > 0) {
      console.log('\n📱 Samsung SKU Patterns:');
      samsungSkus.rows.forEach(row => {
        const tags = row.sku_code.split('-');
        console.log(`   "${row.sku_code}"`);
        console.log(`      Tags: [${tags.map(t => `"${t.trim()}"`).join(', ')}]`);
        console.log(`      Pattern: ${identifyPattern(tags.map(t => t.trim()))}`);
      });
    }

    // Pixel patterns
    const pixelSkus = await client.query(`
      SELECT sku_code FROM sku_master 
      WHERE is_active = true AND sku_code LIKE '%PIXEL%'
      LIMIT 5
    `);
    
    if (pixelSkus.rows.length > 0) {
      console.log('\n📱 Pixel SKU Patterns:');
      pixelSkus.rows.forEach(row => {
        const tags = row.sku_code.split('-');
        console.log(`   "${row.sku_code}"`);
        console.log(`      Tags: [${tags.map(t => `"${t.trim()}"`).join(', ')}]`);
        console.log(`      Pattern: ${identifyPattern(tags.map(t => t.trim()))}`);
      });
    }

  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
  } finally {
    await client.end();
    console.log('🔌 Disconnected from database');
  }
}

// Run the analysis
analyzeSkuPatterns();
