const { Client } = require('pg');
require('dotenv').config();

class FastSkuParser {
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
    
    // Batch storage for bulk operations
    this.tagBatch = [];
    this.skuTagBatch = [];
    this.skuMasterBatch = [];
    this.undefinedBatch = [];
    
    // Batch sizes
    this.tagBatchSize = 100;
    this.skuTagBatchSize = 200;
    this.skuMasterBatchSize = 200;
    this.undefinedBatchSize = 100;
  }

  async parseAllSkus() {
    console.log('🚀 Starting FAST parsing of ALL SKU_MASTER entries...');
    
    // Get ALL active SKU_MASTER entries
    const skus = await this.db.query(`
      SELECT id, sku_code, brand, model, capacity, color, carrier, post_fix, is_active 
      FROM sku_master 
      WHERE is_active = true
      ORDER BY id
    `);
    
    this.stats.total = skus.rows.length;
    console.log(`📊 Found ${this.stats.total} SKUs to parse`);
    
    // Process in larger batches for better performance
    const batchSize = 200;
    let processed = 0;
    const startTime = Date.now();
    
    for (let i = 0; i < skus.rows.length; i += batchSize) {
      const batch = skus.rows.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(sku => this.parseSingleSku(sku));
      await Promise.all(batchPromises);
      
      // Flush batches to database
      await this.flushAllBatches();
      
      processed += batch.length;
      
      // Show progress with timing
      const percentage = Math.round(processed/this.stats.total*100);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const rate = Math.round(processed / elapsed);
      const eta = Math.round((this.stats.total - processed) / rate);
      
      console.log(`✅ Processed ${processed}/${this.stats.total} SKUs (${percentage}%) - Rate: ${rate}/sec - ETA: ${eta}s`);
      console.log(`   📱 Successful: ${this.stats.successful}, ❓ Undefined: ${this.stats.undefined}, ❌ Errors: ${this.stats.errors}`);
    }
    
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`🎯 Fast parsing complete in ${totalTime}s: ${this.stats.processed} processed, ${this.stats.successful} successful, ${this.stats.undefined} undefined, ${this.stats.errors} errors`);
    console.log(`⚡ Average rate: ${Math.round(this.stats.total / totalTime)} SKUs/second`);
    
    return this.stats;
  }

  async parseSingleSku(sku) {
    const { id, sku_code, brand, model, capacity, color, carrier, post_fix } = sku;
    
    try {
      // Fast pattern-based parsing (no fallback)
      const result = this.parseSkuFast(sku_code, { brand, model, capacity, color, carrier, post_fix });
      
      if (result.success) {
        // Add to batches instead of immediate database operations
        this.addToBatches(id, result.tags, result.deviceType);
        this.stats.successful++;
      } else {
        // Add to undefined batch
        this.addToUndefinedBatch(sku_code, result.undefinedTags, { brand, model, capacity, color, carrier, post_fix });
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

  // BATCH OPERATIONS - Add to batches instead of immediate DB operations
  addToBatches(skuMasterId, tags, deviceType) {
    // Add tags to tag batch
    tags.forEach(tagInfo => {
      this.tagBatch.push({
        tag_name: tagInfo.tag,
        tag_category: tagInfo.category,
        tag_value: tagInfo.tag,
        usage_count: 1
      });
    });
    
    // Add to sku tag mapping batch
    tags.forEach(tagInfo => {
      this.skuTagBatch.push({
        sku_master_id: skuMasterId,
        tag_position: tagInfo.position,
        tag_category: tagInfo.category,
        tag_value: tagInfo.tag // We'll resolve this to tag_id during flush
      });
    });
    
    // Add to sku_master update batch
    const modelTags = tags.filter(tag => tag.category === 'MODEL');
    const modelTag = modelTags.length > 0 ? modelTags.map(t => t.tag).join('|') : null;
    const capacityTag = tags.find(tag => tag.category === 'CAPACITY')?.tag || null;
    const colorTag = tags.find(tag => tag.category === 'COLOR')?.tag || null;
    const carrierTag = tags.find(tag => tag.category === 'CARRIER')?.tag || null;
    const postfixTag = tags.find(tag => tag.category === 'POSTFIX')?.tag || null;
    
    this.skuMasterBatch.push({
      id: skuMasterId,
      model_tag: modelTag,
      capacity_tag: capacityTag,
      color_tag: colorTag,
      carrier_tag: carrierTag,
      postfix_tag: postfixTag,
      tag_count: tags.length,
      device_type: deviceType
    });
  }

  addToUndefinedBatch(skuCode, undefinedTags, skuData) {
    undefinedTags.forEach(tagInfo => {
      const description = `Brand: ${skuData.brand || 'N/A'}, Model: ${skuData.model || 'N/A'}, Capacity: ${skuData.capacity || 'N/A'}, Color: ${skuData.color || 'N/A'}, Carrier: ${skuData.carrier || 'N/A'}, Postfix: ${skuData.post_fix || 'N/A'}`;
      
      this.undefinedBatch.push({
        tag_value: tagInfo.tag,
        original_sku: skuCode,
        status: 'UNDEFINED',
        suggested_type: tagInfo.suggestedType,
        suggested_category: tagInfo.suggestedCategory,
        product_description: description
      });
    });
  }

  // FLUSH ALL BATCHES TO DATABASE
  async flushAllBatches() {
    if (this.tagBatch.length > 0) {
      await this.flushTagBatch();
    }
    
    if (this.skuTagBatch.length > 0) {
      await this.flushSkuTagBatch();
    }
    
    if (this.skuMasterBatch.length > 0) {
      await this.flushSkuMasterBatch();
    }
    
    if (this.undefinedBatch.length > 0) {
      await this.flushUndefinedBatch();
    }
  }

  async flushTagBatch() {
    if (this.tagBatch.length === 0) return;
    
    try {
      // Use COPY for bulk insert (much faster than individual INSERTs)
      const values = this.tagBatch.map(tag => 
        `('${tag.tag_name}', '${tag.tag_category}', '${tag.tag_value}', ${tag.usage_count})`
      ).join(',');
      
      const query = `
        INSERT INTO sku_tags (tag_name, tag_category, tag_value, usage_count)
        VALUES ${values}
        ON CONFLICT (tag_name, tag_category) DO UPDATE SET
          usage_count = sku_tags.usage_count + EXCLUDED.usage_count
      `;
      
      await this.db.query(query);
      console.log(`   📝 Flushed ${this.tagBatch.length} tags to database`);
      this.tagBatch = [];
      
    } catch (error) {
      console.error('❌ Error flushing tag batch:', error.message);
      // Fallback to individual inserts if bulk fails
      await this.fallbackTagInserts();
    }
  }

  async fallbackTagInserts() {
    console.log('   ⚠️ Falling back to individual tag inserts...');
    
    for (const tag of this.tagBatch) {
      try {
        await this.db.query(`
          INSERT INTO sku_tags (tag_name, tag_category, tag_value, usage_count)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (tag_name, tag_category) DO UPDATE SET
            usage_count = sku_tags.usage_count + $4
        `, [tag.tag_name, tag.tag_category, tag.tag_value, tag.usage_count]);
      } catch (error) {
        console.error(`     ❌ Error inserting tag ${tag.tag_name}:`, error.message);
      }
    }
    
    this.tagBatch = [];
  }

  async flushSkuTagBatch() {
    if (this.skuTagBatch.length === 0) return;
    
    try {
      // Get all unique tag values to resolve to IDs
      const uniqueTags = [...new Set(this.skuTagBatch.map(st => st.tag_value))];
      const tagQuery = await this.db.query(`
        SELECT tag_name, id FROM sku_tags WHERE tag_name = ANY($1)
      `, [uniqueTags]);
      
      const tagMap = new Map(tagQuery.rows.map(row => [row.tag_name, row.id]));
      
      // Build bulk insert for sku_master_tags
      const values = this.skuTagBatch.map(st => {
        const tagId = tagMap.get(st.tag_value);
        if (!tagId) {
          console.warn(`     ⚠️ Tag "${st.tag_value}" not found in sku_tags`);
          return null;
        }
        return `(${st.sku_master_id}, ${tagId}, ${st.tag_position}, '${st.tag_category}')`;
      }).filter(v => v !== null);
      
      if (values.length > 0) {
        const query = `
          INSERT INTO sku_master_tags (sku_master_id, tag_id, tag_position, tag_category)
          VALUES ${values.join(',')}
          ON CONFLICT (sku_master_id, tag_id, tag_position) DO NOTHING
        `;
        
        await this.db.query(query);
        console.log(`   📝 Flushed ${values.length} SKU tag mappings to database`);
      }
      
      this.skuTagBatch = [];
      
    } catch (error) {
      console.error('❌ Error flushing SKU tag batch:', error.message);
    }
  }

  async flushSkuMasterBatch() {
    if (this.skuMasterBatch.length === 0) return;
    
    try {
      // Build bulk update for sku_master
      const updates = this.skuMasterBatch.map(sm => `
        UPDATE sku_master SET 
          model_tag = ${sm.model_tag ? `'${sm.model_tag}'` : 'NULL'},
          capacity_tag = ${sm.capacity_tag ? `'${sm.capacity_tag}'` : 'NULL'},
          color_tag = ${sm.color_tag ? `'${sm.color_tag}'` : 'NULL'},
          carrier_tag = ${sm.carrier_tag ? `'${sm.carrier_tag}'` : 'NULL'},
          postfix_tag = ${sm.postfix_tag ? `'${sm.postfix_tag}'` : 'NULL'},
          tag_count = ${sm.tag_count},
          device_type = '${sm.device_type}'
        WHERE id = ${sm.id}
      `);
      
      // Execute all updates in a single transaction
      await this.db.query('BEGIN');
      
      for (const update of updates) {
        await this.db.query(update);
      }
      
      await this.db.query('COMMIT');
      console.log(`   📝 Flushed ${this.skuMasterBatch.length} SKU master updates to database`);
      this.skuMasterBatch = [];
      
    } catch (error) {
      await this.db.query('ROLLBACK');
      console.error('❌ Error flushing SKU master batch:', error.message);
    }
  }

  async flushUndefinedBatch() {
    if (this.undefinedBatch.length === 0) return;
    
    try {
      // Use COPY for bulk insert
      const values = this.undefinedBatch.map(ud => 
        `('${ud.tag_value}', '${ud.original_sku}', '${ud.status}', '${ud.suggested_type || ''}', '${ud.suggested_category || ''}', '${ud.product_description.replace(/'/g, "''")}')`
      ).join(',');
      
      const query = `
        INSERT INTO undefined_tag_review (tag_value, original_sku, status, suggested_type, suggested_category, product_description)
        VALUES ${values}
        ON CONFLICT (tag_value, original_sku) DO NOTHING
      `;
      
      await this.db.query(query);
      console.log(`   📝 Flushed ${this.undefinedBatch.length} undefined tags to review table`);
      this.undefinedBatch = [];
      
    } catch (error) {
      console.error('❌ Error flushing undefined batch:', error.message);
    }
  }

  async generateReport() {
    console.log('\n📋 FAST PARSING ANALYSIS REPORT:');
    console.log(`Total SKUs: ${this.stats.total}`);
    console.log(`✅ Successfully parsed: ${this.stats.successful} (${Math.round(this.stats.successful/this.stats.total*100)}%)`);
    console.log(`❓ Needs manual review: ${this.stats.undefined} (${Math.round(this.stats.undefined/this.stats.total*100)}%)`);
    console.log(`❌ Errors: ${this.stats.errors} (${Math.round(this.stats.errors/this.stats.total*100)}%)`);
    
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

async function runFastParser() {
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

    // Run fast parser
    console.log('\n🚀 Starting fast parsing...');
    const parser = new FastSkuParser(client);
    const result = await parser.parseAllSkus();

    // Generate report
    await parser.generateReport();

  } catch (error) {
    console.error('❌ Error during fast parsing:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the fast parser
runFastParser();

