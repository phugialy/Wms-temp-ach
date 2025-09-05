const { Client } = require('pg');
require('dotenv').config();

class TagIntegrationService {
  constructor(dbClient) {
    this.db = dbClient;
    this.stats = {
      total: 0,
      processed: 0,
      integrated: 0,
      errors: 0,
      skipped: 0
    };
  }

  async integrateReviewedTags() {
    console.log('🔄 INTEGRATING MANUALLY REVIEWED TAGS BACK INTO SYSTEM');
    console.log('=' .repeat(60));
    
    // Get all reviewed tags
    const reviewedTags = await this.db.query(`
      SELECT 
        id,
        tag_value,
        original_sku,
        suggested_category,
        suggested_type,
        user_notes,
        reviewed_by
      FROM undefined_tag_review 
      WHERE status = 'REVIEWED'
      ORDER BY reviewed_at DESC
    `);
    
    this.stats.total = reviewedTags.rows.length;
    console.log(`📊 Found ${this.stats.total} reviewed tags to integrate`);
    
    if (this.stats.total === 0) {
      console.log('✅ No reviewed tags to integrate');
      return this.stats;
    }
    
    // Process each reviewed tag
    for (const tagInfo of reviewedTags.rows) {
      try {
        await this.integrateSingleTag(tagInfo);
        this.stats.processed++;
      } catch (error) {
        console.error(`❌ Error integrating tag ${tagInfo.tag_value}:`, error.message);
        this.stats.errors++;
      }
    }
    
    console.log(`\n🎯 Integration complete: ${this.stats.processed} processed, ${this.stats.integrated} integrated, ${this.stats.skipped} skipped, ${this.stats.errors} errors`);
    return this.stats;
  }

  async integrateSingleTag(tagInfo) {
    const { tag_value, suggested_category, suggested_type, original_sku } = tagInfo;
    
    console.log(`\n🔄 Integrating tag: "${tag_value}" (${suggested_category}) from SKU: ${original_sku}`);
    
    // Step 1: Create or update the tag in sku_tags
    const tagId = await this.getOrCreateTag(tag_value, suggested_category);
    console.log(`   ✅ Tag created/updated with ID: ${tagId}`);
    
    // Step 2: Find all SKUs that contain this tag value
    const matchingSkus = await this.findSkusWithTag(tag_value);
    console.log(`   📱 Found ${matchingSkus.length} SKUs containing this tag`);
    
    // Step 3: Update sku_master_tags for each matching SKU
    let updatedSkus = 0;
    for (const sku of matchingSkus) {
      try {
        await this.updateSkuMasterTags(sku.id, tagId, suggested_category, tag_value);
        updatedSkus++;
      } catch (error) {
        console.error(`     ❌ Error updating SKU ${sku.sku_code}:`, error.message);
      }
    }
    
    console.log(`   ✅ Updated ${updatedSkus} SKU tag mappings`);
    
    // Step 4: Update sku_master tag columns
    await this.updateSkuMasterTagColumns(tag_value, suggested_category);
    console.log(`   ✅ Updated sku_master tag columns`);
    
    // Step 5: Mark as integrated
    await this.markAsIntegrated(tagInfo.id);
    console.log(`   ✅ Marked as integrated`);
    
    this.stats.integrated++;
  }

  async getOrCreateTag(tagValue, category) {
    // Check if tag already exists with this category
    const existing = await this.db.query(`
      SELECT id FROM sku_tags 
      WHERE tag_value = $1 AND tag_category = $2
    `, [tagValue, category]);
    
    if (existing.rows.length > 0) {
      // Update usage count
      await this.db.query(`
        UPDATE sku_tags 
        SET usage_count = usage_count + 1 
        WHERE id = $1
      `, [existing.rows[0].id]);
      
      return existing.rows[0].id;
    }
    
    // Create new tag
    const result = await this.db.query(`
      INSERT INTO sku_tags (tag_name, tag_category, tag_value, usage_count)
      VALUES ($1, $2, $3, 1)
      ON CONFLICT (tag_name, tag_category) DO UPDATE SET
        usage_count = sku_tags.usage_count + 1
      RETURNING id
    `, [tagValue, category, tagValue]);
    
    return result.rows[0].id;
  }

  async findSkusWithTag(tagValue) {
    // Find SKUs that contain this tag value in their sku_code
    const result = await this.db.query(`
      SELECT id, sku_code
      FROM sku_master 
      WHERE sku_code ILIKE $1
      AND is_active = true
    `, [`%${tagValue}%`]);
    
    return result.rows;
  }

  async updateSkuMasterTags(skuMasterId, tagId, category, tagValue) {
    // Find the position of this tag in the SKU
    const skuInfo = await this.db.query(`
      SELECT sku_code FROM sku_master WHERE id = $1
    `, [skuMasterId]);
    
    if (skuInfo.rows.length === 0) return;
    
    const skuCode = skuInfo.rows[0].sku_code;
    const chunks = skuCode.split(/[-/ ]/);
    const position = chunks.findIndex(chunk => chunk.toUpperCase() === tagValue.toUpperCase());
    
    if (position === -1) {
      console.log(`     ⚠️ Tag "${tagValue}" not found in SKU "${skuCode}" - skipping`);
      this.stats.skipped++;
      return;
    }
    
    // Insert or update the tag mapping
    await this.db.query(`
      INSERT INTO sku_master_tags (sku_master_id, tag_id, tag_position, tag_category)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (sku_master_id, tag_id, tag_position) DO UPDATE SET
        tag_category = $4
    `, [skuMasterId, tagId, position, category]);
  }

  async updateSkuMasterTagColumns(tagValue, category) {
    // Update the appropriate tag column in sku_master based on category
    let updateQuery = '';
    let columnName = '';
    
    switch (category) {
      case 'MODEL':
        columnName = 'model_tag';
        break;
      case 'CAPACITY':
        columnName = 'capacity_tag';
        break;
      case 'COLOR':
        columnName = 'color_tag';
        break;
      case 'CARRIER':
        columnName = 'carrier_tag';
        break;
      case 'POSTFIX':
        columnName = 'postfix_tag';
        break;
      default:
        console.log(`     ⚠️ Unknown category "${category}" - skipping column update`);
        return;
    }
    
    // Update SKUs that contain this tag but don't have it set in the column
    const result = await this.db.query(`
      UPDATE sku_master 
      SET ${columnName} = $1
      WHERE sku_code ILIKE $2 
      AND ${columnName} IS NULL
      AND is_active = true
    `, [tagValue, `%${tagValue}%`]);
    
    console.log(`     📝 Updated ${result.rowCount} SKUs with ${columnName} = "${tagValue}"`);
  }

  async markAsIntegrated(tagReviewId) {
    // Mark this tag as integrated in the review table
    await this.db.query(`
      UPDATE undefined_tag_review 
      SET status = 'INTEGRATED', reviewed_at = NOW()
      WHERE id = $1
    `, [tagReviewId]);
  }

  async generateIntegrationReport() {
    console.log('\n📋 INTEGRATION REPORT');
    console.log('=' .repeat(40));
    console.log(`Total reviewed tags: ${this.stats.total}`);
    console.log(`Processed: ${this.stats.processed}`);
    console.log(`Successfully integrated: ${this.stats.integrated}`);
    console.log(`Skipped: ${this.stats.skipped}`);
    console.log(`Errors: ${this.stats.errors}`);
    
    // Show remaining undefined tags
    const remainingUndefined = await this.db.query(`
      SELECT COUNT(*) FROM undefined_tag_review WHERE status = 'UNDEFINED'
    `);
    console.log(`Remaining undefined tags: ${remainingUndefined.rows[0].count}`);
    
    // Show integration progress
    const totalInReview = await this.db.query(`
      SELECT COUNT(*) FROM undefined_tag_review
    `);
    const integratedCount = await this.db.query(`
      SELECT COUNT(*) FROM undefined_tag_review WHERE status = 'INTEGRATED'
    `);
    
    const progress = Math.round((integratedCount.rows[0].count / totalInReview.rows[0].count) * 100);
    console.log(`Integration progress: ${progress}%`);
  }

  async cleanupIntegratedTags() {
    console.log('\n🧹 CLEANING UP INTEGRATED TAGS FROM REVIEW TABLE');
    console.log('=' .repeat(60));
    
    // Optionally remove integrated tags from the review table
    const result = await this.db.query(`
      DELETE FROM undefined_tag_review 
      WHERE status = 'INTEGRATED'
    `);
    
    console.log(`✅ Removed ${result.rowCount} integrated tags from review table`);
    console.log('💡 Note: You can also keep them for audit purposes');
  }
}

async function runTagIntegration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    const integrationService = new TagIntegrationService(client);
    
    // Run integration
    const result = await integrationService.integrateReviewedTags();
    
    // Generate report
    await integrationService.generateIntegrationReport();
    
    // Ask about cleanup
    console.log('\n🧹 Would you like to clean up integrated tags from the review table?');
    console.log('This will remove them from the review table but keep them in the main system.');
    
  } catch (error) {
    console.error('❌ Error during tag integration:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the tag integration
runTagIntegration();

