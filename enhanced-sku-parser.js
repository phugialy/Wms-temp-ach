const { Client } = require('pg');
require('dotenv').config();

class EnhancedSkuParser {
  constructor(dbClient) {
    this.db = dbClient;
    this.stats = {
      total: 0,
      processed: 0,
      successful: 0,
      undefined: 0,
      errors: 0,
      deviceTypes: new Map(),
      undefinedTags: new Map()
    };
  }

  async parseAllSkus() {
    console.log('🚀 Starting ENHANCED parsing of ALL SKU_MASTER entries...');
    
    // Get ALL active SKU_MASTER entries
    const skus = await this.db.query(`
      SELECT id, sku_code, brand, model, capacity, color, carrier, post_fix, is_active 
      FROM sku_master 
      WHERE is_active = true
      ORDER BY id
    `);
    
    this.stats.total = skus.rows.length;
    console.log(`📊 Found ${this.stats.total} SKUs to parse`);
    
    // Process in batches for better performance
    const batchSize = 100;
    let processed = 0;
    
    for (let i = 0; i < skus.rows.length; i += batchSize) {
      const batch = skus.rows.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(sku => this.parseSingleSku(sku));
      await Promise.all(batchPromises);
      
      processed += batch.length;
      
      // Show progress
      const percentage = Math.round(processed/this.stats.total*100);
      console.log(`✅ Processed ${processed}/${this.stats.total} SKUs (${percentage}%)`);
      console.log(`   📱 Successful: ${this.stats.successful}, ❓ Undefined: ${this.stats.undefined}, ❌ Errors: ${this.stats.errors}`);
    }
    
    console.log(`🎯 Enhanced parsing complete: ${this.stats.processed} processed, ${this.stats.successful} successful, ${this.stats.undefined} undefined, ${this.stats.errors} errors`);
    return this.stats;
  }

  async parseSingleSku(sku) {
    const { id, sku_code, brand, model, capacity, color, carrier, post_fix } = sku;
    
    try {
      // Fast pattern-based parsing (no fallback)
      const result = this.parseSkuFast(sku_code, { brand, model, capacity, color, carrier, post_fix });
      
      if (result.success) {
        // Store successful tags
        await this.storeSkuTags(id, result.tags);
        await this.updateSkuMasterTags(id, result.tags, result.deviceType);
        this.stats.successful++;
      } else {
        // Queue for manual review
        await this.queueForManualReview(sku_code, result.undefinedTags, { brand, model, capacity, color, carrier, post_fix });
        this.stats.undefined++;
      }
      
      this.stats.processed++;
      
    } catch (error) {
      console.error(`❌ Error parsing SKU ${sku.sku_code}:`, error.message);
      this.stats.errors++;
    }
  }

  parseSkuFast(skuCode, skuData) {
    // Detect device type
    const deviceType = this.detectDeviceType(skuCode);
    
    if (deviceType !== 'UNKNOWN') {
      // Try pattern-based parsing
      const tags = this.parseByDeviceType(skuCode, deviceType);
      const validation = this.validatePattern(tags, deviceType);
      
      if (validation.valid) {
        return { success: true, tags, deviceType };
      }
    }
    
    // No fallback - extract undefined tags and queue for manual review
    const undefinedTags = this.extractUndefinedTags(skuCode);
    return { success: false, undefinedTags, needsReview: true };
  }

  detectDeviceType(skuCode) {
    const upperSku = skuCode.toUpperCase();
    
    if (upperSku.includes('WATCH') || upperSku.includes('SE') || upperSku.includes('ULTRA')) {
      return 'WATCH';
    } else if (upperSku.includes('TAB') || upperSku.includes('IPAD')) {
      return 'TAB';
    } else if (upperSku.includes('FOLD') || upperSku.includes('PIXEL') || upperSku.includes('SAMSUNG') || 
               upperSku.includes('IPHONE') || upperSku.includes('IP-')) {
      return 'PHONE';
    } else if (upperSku.includes('XPS') || upperSku.includes('LATITUDE') || upperSku.includes('INSPIRON') ||
               upperSku.includes('PRO') || upperSku.includes('GEFORCE') || upperSku.includes('GTX')) {
      return 'DESKTOP';
    }
    
    return 'UNKNOWN';
  }

  parseByDeviceType(skuCode, deviceType) {
    const chunks = skuCode.split('-').filter(c => c.length > 0);
    
    switch (deviceType) {
      case 'PHONE':
        return this.parsePhonePattern(chunks);
      case 'TAB':
        return this.parseTabPattern(chunks);
      case 'WATCH':
        return this.parseWatchPattern(chunks);
      case 'DESKTOP':
        return this.parseDesktopPattern(chunks);
      default:
        return this.parseGenericPattern(chunks);
    }
  }

  parsePhonePattern(chunks) {
    const tags = [];
    
    // MODEL-CAPACITY-COLOR-CARRIER pattern
    if (chunks.length >= 4) {
      tags.push({ tag: chunks[0], category: 'MODEL', position: 0 });
      tags.push({ tag: chunks[1], category: 'CAPACITY', position: 1 });
      tags.push({ tag: chunks[2], category: 'COLOR', position: 2 });
      tags.push({ tag: chunks[3], category: 'CARRIER', position: 3 });
      
      // Handle additional segments (postfix, etc.)
      for (let i = 4; i < chunks.length; i++) {
        tags.push({ tag: chunks[i], category: 'POSTFIX', position: i });
      }
    }
    
    return tags;
  }

  parseTabPattern(chunks) {
    const tags = [];
    
    // TYPE-MODEL-CAPACITY-COLOR-CARRIER pattern
    if (chunks.length >= 5) {
      tags.push({ tag: chunks[0], category: 'TYPE', position: 0 });
      tags.push({ tag: chunks[1], category: 'MODEL', position: 1 });
      tags.push({ tag: chunks[2], category: 'CAPACITY', position: 2 });
      tags.push({ tag: chunks[3], category: 'COLOR', position: 3 });
      tags.push({ tag: chunks[4], category: 'CARRIER', position: 4 });
      
      // Handle additional segments
      for (let i = 5; i < chunks.length; i++) {
        tags.push({ tag: chunks[i], category: 'POSTFIX', position: i });
      }
    }
    
    return tags;
  }

  parseWatchPattern(chunks) {
    const tags = [];
    
    // TYPE-MODEL-SIZE-CARRIER-COLOR pattern
    if (chunks.length >= 5) {
      tags.push({ tag: chunks[0], category: 'TYPE', position: 0 });
      tags.push({ tag: chunks[1], category: 'MODEL', position: 1 });
      tags.push({ tag: chunks[2], category: 'SIZE', position: 2 });
      tags.push({ tag: chunks[3], category: 'CARRIER', position: 3 });
      tags.push({ tag: chunks[4], category: 'COLOR', position: 4 });
      
      // Handle additional segments
      for (let i = 5; i < chunks.length; i++) {
        tags.push({ tag: chunks[i], category: 'POSTFIX', position: i });
      }
    }
    
    return tags;
  }

  parseDesktopPattern(chunks) {
    const tags = [];
    
    // Handle various desktop patterns
    if (chunks.length >= 3) {
      tags.push({ tag: chunks[0], category: 'MODEL', position: 0 });
      
      // Try to identify capacity and other specs
      for (let i = 1; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (/^\d+$/.test(chunk)) {
          tags.push({ tag: chunk, category: 'CAPACITY', position: i });
        } else if (chunk.includes('GB') || chunk.includes('TB')) {
          tags.push({ tag: chunk, category: 'CAPACITY', position: i });
        } else if (chunk.includes('I7') || chunk.includes('I5') || chunk.includes('I9')) {
          tags.push({ tag: chunk, category: 'PROCESSOR', position: i });
        } else {
          tags.push({ tag: chunk, category: 'SPEC', position: i });
        }
      }
    }
    
    return tags;
  }

  parseGenericPattern(chunks) {
    // For unknown patterns, just categorize by position
    return chunks.map((chunk, index) => ({
      tag: chunk,
      category: 'UNKNOWN',
      position: index
    }));
  }

  validatePattern(tags, deviceType) {
    const expectedLength = this.getExpectedLength(deviceType);
    const expectedCategories = this.getExpectedCategories(deviceType);
    
    if (tags.length < expectedLength) {
      return { valid: false, reason: 'Too few segments' };
    }
    
    // Basic validation - check if we have the core categories
    const hasCoreCategories = expectedCategories.every(cat => 
      tags.some(tag => tag.category === cat)
    );
    
    return { valid: hasCoreCategories, reason: hasCoreCategories ? 'Valid' : 'Missing core categories' };
  }

  getExpectedLength(deviceType) {
    const lengths = {
      'PHONE': 4,
      'TAB': 5,
      'WATCH': 5,
      'DESKTOP': 3
    };
    return lengths[deviceType] || 3;
  }

  getExpectedCategories(deviceType) {
    const categories = {
      'PHONE': ['MODEL', 'CAPACITY', 'COLOR', 'CARRIER'],
      'TAB': ['TYPE', 'MODEL', 'CAPACITY', 'COLOR', 'CARRIER'],
      'WATCH': ['TYPE', 'MODEL', 'SIZE', 'CARRIER', 'COLOR'],
      'DESKTOP': ['MODEL', 'CAPACITY']
    };
    return categories[deviceType] || ['MODEL'];
  }

  extractUndefinedTags(skuCode) {
    // Extract all segments that couldn't be categorized
    const chunks = skuCode.split(/[-/ ]/).filter(c => c.length > 0);
    return chunks.map(chunk => ({
      tag: chunk,
      originalSku: skuCode,
      suggestedType: this.suggestType(chunk),
      suggestedCategory: this.suggestCategory(chunk)
    }));
  }

  suggestType(tag) {
    const upperTag = tag.toUpperCase();
    
    if (upperTag.includes('IPAD') || upperTag.includes('TAB')) return 'TAB';
    if (upperTag.includes('WATCH') || upperTag.includes('SE')) return 'WATCH';
    if (upperTag.includes('PIXEL') || upperTag.includes('FOLD') || upperTag.includes('SAMSUNG')) return 'PHONE';
    if (upperTag.includes('XPS') || upperTag.includes('LATITUDE')) return 'DESKTOP';
    
    return 'UNKNOWN';
  }

  suggestCategory(tag) {
    const upperTag = tag.toUpperCase();
    
    if (/^\d+$/.test(tag)) {
      if (tag.length === 2) return 'SIZE';
      if (tag.length === 3) return 'CAPACITY';
      return 'CAPACITY';
    }
    
    if (['BLK', 'BLACK', 'WHT', 'WHITE', 'GLD', 'GOLD', 'SLV', 'SILVER', 'ROSE', 'RED', 'BLU', 'BLUE'].includes(upperTag)) {
      return 'COLOR';
    }
    
    if (['TMO', 'ATT', 'VRZ', 'WIFI', '4G', '5G'].includes(upperTag)) {
      return 'CARRIER';
    }
    
    if (['PRO', 'MINI', 'ULTRA', 'PLUS', 'MAX'].includes(upperTag)) {
      return 'MODEL';
    }
    
    return 'UNKNOWN';
  }

  async queueForManualReview(skuCode, undefinedTags, skuData) {
    for (const tagInfo of undefinedTags) {
      try {
        const description = `Brand: ${skuData.brand || 'N/A'}, Model: ${skuData.model || 'N/A'}, Capacity: ${skuData.capacity || 'N/A'}, Color: ${skuData.color || 'N/A'}, Carrier: ${skuData.carrier || 'N/A'}, Postfix: ${skuData.post_fix || 'N/A'}`;
        
        await this.db.query(`
          INSERT INTO undefined_tag_review 
          (tag_value, original_sku, status, suggested_type, suggested_category, product_description)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (tag_value, original_sku) DO NOTHING
        `, [
          tagInfo.tag, 
          skuCode, 
          'UNDEFINED', 
          tagInfo.suggestedType, 
          tagInfo.suggestedCategory,
          description
        ]);
        
        // Track undefined tags for reporting
        if (!this.stats.undefinedTags.has(tagInfo.tag)) {
          this.stats.undefinedTags.set(tagInfo.tag, []);
        }
        this.stats.undefinedTags.get(tagInfo.tag).push(skuCode);
        
      } catch (error) {
        console.error(`❌ Error queuing tag ${tagInfo.tag} for review:`, error.message);
      }
    }
  }

  async storeSkuTags(skuMasterId, tags) {
    for (const tagInfo of tags) {
      const tagId = await this.getOrCreateTag(tagInfo.tag, tagInfo.category);
      await this.storeSkuTagMapping(skuMasterId, tagId, tagInfo.position, tagInfo.category);
    }
  }

  async getOrCreateTag(tagValue, category) {
    // Check if tag exists
    const existing = await this.db.query(`
      SELECT id FROM sku_tags 
      WHERE tag_value = $1
    `, [tagValue]);
    
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

  async storeSkuTagMapping(skuMasterId, tagId, position, category) {
    await this.db.query(`
      INSERT INTO sku_master_tags (sku_master_id, tag_id, tag_position, tag_category)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (sku_master_id, tag_id, tag_position) DO NOTHING
    `, [skuMasterId, tagId, position, category]);
  }

  async updateSkuMasterTags(skuMasterId, tags, deviceType) {
    const modelTags = tags.filter(tag => tag.category === 'MODEL');
    const modelTag = modelTags.length > 0 ? modelTags.join('|') : null;
    
    const capacityTag = tags.find(tag => tag.category === 'CAPACITY')?.tag || null;
    const colorTag = tags.find(tag => tag.category === 'COLOR')?.tag || null;
    const carrierTag = tags.find(tag => tag.category === 'CARRIER')?.tag || null;
    const postfixTag = tags.find(tag => tag.category === 'POSTFIX')?.tag || null;
    
    await this.db.query(`
      UPDATE sku_master 
      SET 
        model_tag = $1,
        capacity_tag = $2,
        color_tag = $3,
        carrier_tag = $4,
        postfix_tag = $5,
        tag_count = $6,
        device_type = $7
      WHERE id = $8
    `, [modelTag, capacityTag, colorTag, carrierTag, postfixTag, tags.length, deviceType, skuMasterId]);
  }

  async generateReport() {
    console.log('\n📋 ENHANCED PARSING ANALYSIS REPORT:');
    console.log(`Total SKUs: ${this.stats.total}`);
    console.log(`✅ Successfully parsed: ${this.stats.successful} (${Math.round(this.stats.successful/this.stats.total*100)}%)`);
    console.log(`❓ Needs manual review: ${this.stats.undefined} (${Math.round(this.stats.undefined/this.stats.total*100)}%)`);
    console.log(`❌ Errors: ${this.stats.errors} (${Math.round(this.stats.errors/this.stats.total*100)}%)`);
    
    // Device type breakdown
    console.log('\n📱 Device Type Breakdown:');
    for (const [type, count] of this.stats.deviceTypes) {
      console.log(`   ${type}: ${count} SKUs`);
    }
    
    // Top undefined tags
    console.log('\n❓ Top Undefined Tags (need manual review):');
    const sortedUndefined = Array.from(this.stats.undefinedTags.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 20);
    
    sortedUndefined.forEach(([tag, skus]) => {
      console.log(`   ${tag}: ${skus.length} SKUs`);
      if (skus.length <= 3) {
        skus.forEach(sku => console.log(`     - ${sku}`));
      } else {
        console.log(`     - ${skus[0]}, ${skus[1]}, ... and ${skus.length - 2} more`);
      }
    });
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Review undefined tags in the undefined_tag_review table');
    console.log('2. Manually categorize undefined tags');
    console.log('3. Re-run parser to improve coverage');
  }
}

async function runEnhancedParser() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Create undefined tag review table
    console.log('\n🏗️ Creating undefined tag review table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS undefined_tag_review (
        id SERIAL PRIMARY KEY,
        tag_value VARCHAR(100) NOT NULL,
        original_sku VARCHAR(200) NOT NULL,
        status VARCHAR(50) DEFAULT 'UNDEFINED',
        suggested_type VARCHAR(50),
        suggested_category VARCHAR(50),
        product_description TEXT,
        user_notes TEXT,
        reviewed_by VARCHAR(100),
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(tag_value, original_sku)
      )
    `);
    console.log('✅ undefined_tag_review table created');

    // Add device_type column to sku_master if it doesn't exist
    console.log('\n🔧 Adding device_type column to sku_master...');
    try {
      await client.query('ALTER TABLE sku_master ADD COLUMN device_type VARCHAR(20)');
      console.log('✅ device_type column added');
    } catch (error) {
      console.log('⚠️ device_type column already exists');
    }

    // Run enhanced parser
    console.log('\n🚀 Starting enhanced parsing...');
    const parser = new EnhancedSkuParser(client);
    const result = await parser.parseAllSkus();

    // Generate report
    await parser.generateReport();

  } catch (error) {
    console.error('❌ Error during enhanced parsing:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the enhanced parser
runEnhancedParser();
