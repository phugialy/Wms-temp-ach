const { Client } = require('pg');
require('dotenv').config();

async function analyzeColorMapping() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Get all SKU codes and extract colors
    const result = await client.query(`
      SELECT sku_code, post_fix, is_unlocked, source_tab
      FROM sku_master 
      WHERE is_active = true 
      ORDER BY sku_code
    `);

    console.log('\n🎨 Color Mapping Analysis:');
    console.log('==========================');

    const colorMap = new Map();
    const skuExamples = new Map();

    result.rows.forEach(row => {
      const parts = row.sku_code.split('-');
      if (parts.length >= 3) {
        const color = parts[2];
        
        if (!colorMap.has(color)) {
          colorMap.set(color, []);
          skuExamples.set(color, []);
        }
        
        colorMap.get(color).push(row.sku_code);
        if (skuExamples.get(color).length < 3) {
          skuExamples.get(color).push(row.sku_code);
        }
      }
    });

    // Group colors by type
    const standardColors = [];
    const abbreviatedColors = [];
    const longColors = [];
    const otherColors = [];

    colorMap.forEach((skus, color) => {
      if (color.length <= 3) {
        abbreviatedColors.push({ color, count: skus.length, examples: skuExamples.get(color) });
      } else if (color.length <= 8) {
        standardColors.push({ color, count: skus.length, examples: skuExamples.get(color) });
      } else if (color.length <= 15) {
        longColors.push({ color, count: skus.length, examples: skuExamples.get(color) });
      } else {
        otherColors.push({ color, count: skus.length, examples: skuExamples.get(color) });
      }
    });

    // Display abbreviated colors (3 letters or less)
    console.log('\n🔤 Abbreviated Colors (3 letters or less):');
    console.log('==========================================');
    abbreviatedColors.sort((a, b) => b.count - a.count).forEach(item => {
      console.log(`   ${item.color.padEnd(8)} (${item.count.toString().padStart(3)} SKUs): ${item.examples.join(', ')}`);
    });

    // Display standard colors (4-8 letters)
    console.log('\n🎨 Standard Colors (4-8 letters):');
    console.log('==================================');
    standardColors.sort((a, b) => b.count - a.count).forEach(item => {
      console.log(`   ${item.color.padEnd(12)} (${item.count.toString().padStart(3)} SKUs): ${item.examples.join(', ')}`);
    });

    // Display long colors (9-15 letters)
    console.log('\n📏 Long Colors (9-15 letters):');
    console.log('================================');
    longColors.sort((a, b) => b.count - a.count).forEach(item => {
      console.log(`   ${item.color.padEnd(20)} (${item.count.toString().padStart(3)} SKUs): ${item.examples.join(', ')}`);
    });

    // Display other colors (16+ letters)
    if (otherColors.length > 0) {
      console.log('\n❓ Other Colors (16+ letters):');
      console.log('===============================');
      otherColors.sort((a, b) => b.count - a.count).forEach(item => {
        console.log(`   ${item.color.padEnd(25)} (${item.count.toString().padStart(3)} SKUs): ${item.examples.join(', ')}`);
      });
    }

    // Identify potential mapping issues
    console.log('\n⚠️  Potential Color Mapping Issues:');
    console.log('====================================');
    
    const issues = [];
    
    // Check for similar colors that might need mapping
    const colorGroups = [
      { variants: ['BLACK', 'BLK', 'JETBLACK'], standard: 'BLK' },
      { variants: ['BLUE', 'BLU', 'BLUESHADOW', 'NAVY'], standard: 'BLU' },
      { variants: ['WHITE', 'WHT'], standard: 'WHT' },
      { variants: ['GREEN', 'GRN'], standard: 'GRN' },
      { variants: ['SILVER', 'SLV'], standard: 'SLV' },
      { variants: ['PURPLE', 'PUR'], standard: 'PUR' },
      { variants: ['PINK', 'PNK'], standard: 'PNK' },
      { variants: ['GOLD', 'GLD'], standard: 'GLD' },
      { variants: ['RED', 'CORALRED'], standard: 'RED' },
      { variants: ['YELLOW', 'YLW'], standard: 'YLW' }
    ];

    colorGroups.forEach(group => {
      const foundVariants = group.variants.filter(variant => 
        Array.from(colorMap.keys()).some(color => 
          color.toUpperCase().includes(variant.toUpperCase())
        )
      );
      
      if (foundVariants.length > 1) {
        issues.push({
          type: 'Multiple Variants',
          colors: foundVariants,
          standard: group.standard,
          recommendation: `Map all to ${group.standard}`
        });
      }
    });

    // Check for colors that might be truncated
    const truncatedColors = Array.from(colorMap.keys()).filter(color => 
      color.length > 8 && !color.includes(' ') && !color.includes('-')
    );
    
    if (truncatedColors.length > 0) {
      issues.push({
        type: 'Potentially Truncated',
        colors: truncatedColors,
        recommendation: 'Check if these are full color names or truncated'
      });
    }

    // Display issues
    issues.forEach((issue, index) => {
      console.log(`\n   ${index + 1}. ${issue.type}:`);
      console.log(`      Colors: ${issue.colors.join(', ')}`);
      if (issue.standard) {
        console.log(`      Standard: ${issue.standard}`);
      }
      console.log(`      Recommendation: ${issue.recommendation}`);
    });

    // Summary and recommendations
    console.log('\n🎯 Summary & Recommendations:');
    console.log('==============================');
    console.log(`   Total unique colors found: ${colorMap.size}`);
    console.log(`   Abbreviated colors (≤3 chars): ${abbreviatedColors.length}`);
    console.log(`   Standard colors (4-8 chars): ${standardColors.length}`);
    console.log(`   Long colors (9-15 chars): ${longColors.length}`);
    console.log(`   Other colors (16+ chars): ${otherColors.length}`);
    
    console.log('\n📋 Strategic Options:');
    console.log('=====================');
    console.log('   1. 🚀 QUICK FIX: Update color normalization to handle all variants');
    console.log('   2. 🔧 MEDIUM: Create a comprehensive color mapping table');
    console.log('   3. 🎯 COMPREHENSIVE: Add color tier to SKU matching logic');
    console.log('   4. 📊 DATA CLEANUP: Standardize all SKU colors in master table');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

analyzeColorMapping();

