const { Client } = require('pg');
const SkuMatchingService = require('./src/services/skuMatchingService');
require('dotenv').config();

async function analyzeSkuMasterData() {
  const skuService = new SkuMatchingService();
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    console.log('\n🔍 ANALYZING SKU MASTER DATA');
    console.log('=============================');

    // Get all SKU codes and analyze them
    const skuQuery = `
      SELECT DISTINCT sku_code 
      FROM sku_master 
      ORDER BY sku_code
    `;
    
    const skuResult = await client.query(skuQuery);
    const skus = skuResult.rows.map(row => row.sku_code);

    console.log(`📊 Total unique SKUs: ${skus.length}`);

    // Analyze product types
    console.log('\n📋 Product Type Analysis:');
    const typeCounts = {};
    const typeExamples = {};

    skus.forEach(sku => {
      const type = skuService.getProductType(sku);
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      
      if (!typeExamples[type] || typeExamples[type].length < 5) {
        if (!typeExamples[type]) typeExamples[type] = [];
        typeExamples[type].push(sku);
      }
    });

    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`\n   ${type.toUpperCase()}: ${count} SKUs`);
      console.log(`   Examples: ${typeExamples[type].slice(0, 3).join(', ')}`);
    });

    // Analyze SKU patterns
    console.log('\n📋 SKU Pattern Analysis:');
    
    const patternAnalysis = {};
    skus.forEach(sku => {
      const parts = sku.split('-');
      const pattern = parts.length;
      patternAnalysis[pattern] = (patternAnalysis[pattern] || 0) + 1;
    });

    Object.entries(patternAnalysis).forEach(([fields, count]) => {
      console.log(`   ${fields} fields: ${count} SKUs`);
    });

    // Find potential tablet and watch SKUs
    console.log('\n📋 Potential New Product Types:');
    
    const potentialTablets = skus.filter(sku => 
      sku.toUpperCase().includes('TAB') || 
      sku.toUpperCase().includes('IPAD') ||
      sku.toUpperCase().includes('SURFACE')
    );
    
    const potentialWatches = skus.filter(sku => 
      sku.toUpperCase().includes('WATCH') || 
      sku.toUpperCase().includes('GALAXY WATCH') ||
      sku.toUpperCase().includes('APPLE WATCH')
    );

    if (potentialTablets.length > 0) {
      console.log(`\n   Potential Tablets (${potentialTablets.length}):`);
      potentialTablets.slice(0, 5).forEach(sku => {
        console.log(`     ${sku}`);
      });
    }

    if (potentialWatches.length > 0) {
      console.log(`\n   Potential Watches (${potentialWatches.length}):`);
      potentialWatches.slice(0, 5).forEach(sku => {
        console.log(`     ${sku}`);
      });
    }

    // Test parsing with real data
    console.log('\n📋 Testing Parsing with Real SKUs:');
    
    const testSkus = skus.slice(0, 10); // Test first 10 SKUs
    testSkus.forEach(sku => {
      const type = skuService.getProductType(sku);
      const parsed = skuService.parseSkuCode(sku);
      
      console.log(`\n   SKU: "${sku}"`);
      console.log(`   Type: ${type}`);
      console.log(`   Parsed: Brand=${parsed.brand}, Model=${parsed.model}, Capacity=${parsed.capacity}, Color=${parsed.color}, Carrier=${parsed.carrier}`);
    });

    console.log('\n✅ SKU master data analysis completed!');

  } catch (error) {
    console.error('❌ Error during analysis:', error);
  } finally {
    await client.end();
  }
}

analyzeSkuMasterData().catch(console.error);

