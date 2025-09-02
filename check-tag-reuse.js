const { Client } = require('pg');
require('dotenv').config();

async function checkTagReuse() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log('\n🔍 ANALYZING TAG REUSE PATTERNS...');
    
    // Check current state of tables
    const skuTagsCount = await client.query('SELECT COUNT(*) FROM sku_tags');
    const skuMasterTagsCount = await client.query('SELECT COUNT(*) FROM sku_master_tags');
    
    console.log(`📊 Current state:`);
    console.log(`   sku_tags: ${skuTagsCount.rows[0].count} total tags`);
    console.log(`   sku_master_tags: ${skuMasterTagsCount.rows[0].count} tag mappings`);
    
    // Check for duplicate tag values across different categories
    console.log('\n🔍 Checking for duplicate tag values...');
    const duplicateTags = await client.query(`
      SELECT 
        tag_value,
        COUNT(*) as count,
        STRING_AGG(tag_category, ', ') as categories
      FROM sku_tags 
      GROUP BY tag_value 
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);
    
    if (duplicateTags.rows.length > 0) {
      console.log(`\n⚠️ Found ${duplicateTags.rows.length} tags that exist in multiple categories:`);
      duplicateTags.rows.slice(0, 20).forEach(tag => {
        console.log(`   ${tag.tag_value}: ${tag.count}x in [${tag.categories}]`);
      });
      if (duplicateTags.rows.length > 20) {
        console.log(`   ... and ${duplicateTags.rows.length - 20} more`);
      }
    } else {
      console.log('\n✅ No duplicate tag values found');
    }
    
    // Check tag usage distribution
    console.log('\n📊 Tag usage distribution:');
    const usageDistribution = await client.query(`
      SELECT 
        usage_count,
        COUNT(*) as tag_count
      FROM sku_tags 
      GROUP BY usage_count 
      ORDER BY usage_count DESC
    `);
    
    usageDistribution.rows.forEach(row => {
      console.log(`   Used ${row.usage_count}x: ${row.tag_count} tags`);
    });
    
    // Check most used tags
    console.log('\n🏆 Most frequently used tags:');
    const mostUsedTags = await client.query(`
      SELECT 
        tag_value,
        tag_category,
        usage_count
      FROM sku_tags 
      ORDER BY usage_count DESC 
      LIMIT 20
    `);
    
    mostUsedTags.rows.forEach(tag => {
      console.log(`   ${tag.tag_value} (${tag.tag_category}): ${tag.usage_count}x`);
    });
    
    // Check undefined tags specifically
    console.log('\n❓ Undefined tags analysis:');
    const undefinedTags = await client.query(`
      SELECT 
        tag_value,
        COUNT(*) as sku_count
      FROM sku_master_tags smt
      JOIN sku_tags st ON smt.tag_id = st.id
      WHERE st.tag_category = 'TEXT'
      GROUP BY tag_value
      ORDER BY sku_count DESC
      LIMIT 20
    `);
    
    if (undefinedTags.rows.length > 0) {
      console.log(`\n📱 Top undefined tags by SKU count:`);
      undefinedTags.rows.forEach(tag => {
        console.log(`   ${tag.tag_value}: ${tag.sku_count} SKUs`);
      });
    }
    
    // Check if the issue is in tag creation vs reuse
    console.log('\n🔍 Analyzing tag creation vs reuse logic...');
    
    // Look at the getOrCreateTag logic issue
    console.log('\n⚠️ POTENTIAL ISSUE IDENTIFIED:');
    console.log('   The getOrCreateTag method is checking for existing tags by tag_value only,');
    console.log('   but then trying to insert with ON CONFLICT (tag_name, tag_category).');
    console.log('   This could cause the same tag_value to be inserted multiple times');
    console.log('   if it\'s categorized differently in different SKUs.');
    
    // Show example of this issue
    const exampleIssue = await client.query(`
      SELECT 
        tag_value,
        tag_category,
        COUNT(*) as count
      FROM sku_tags 
      WHERE tag_value IN ('32', '64', '128', '256', '512')
      GROUP BY tag_value, tag_category
      ORDER BY tag_value, tag_category
    `);
    
    if (exampleIssue.rows.length > 0) {
      console.log('\n📊 Example of the issue with numeric tags:');
      exampleIssue.rows.forEach(tag => {
        console.log(`   ${tag.tag_value} as ${tag.tag_category}: ${tag.count}x`);
      });
    }

  } catch (error) {
    console.error('❌ Error analyzing tag reuse:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the analysis
checkTagReuse();
