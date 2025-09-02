const { Client } = require('pg');
require('dotenv').config();

class FastSkuMasterTagParser {
  constructor(dbClient) {
    this.db = dbClient;
    this.stats = {
      total: 0,
      processed: 0,
      errors: 0,
      undefined: 0,
      undefinedExamples: [],
      allUndefinedTags: new Set(),
      tagToSkus: new Map()
    };
  }

  async parseAllSkuMaster() {
    console.log('🚀 Starting FAST parsing of ALL SKU_MASTER entries...');
    
    // Get ALL active SKU_MASTER entries
    const skus = await this.db.query(`
      SELECT id, sku_code, is_active 
      FROM sku_master 
      WHERE is_active = true
      ORDER BY id
    `);
    
    this.stats.total = skus.rows.length;
    console.log(`📊 Found ${this.stats.total} SKUs to parse`);
    
    // Process in batches for better performance
    const batchSize = 50;
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
      
      // Show undefined count so far
      if (this.stats.undefined > 0) {
        console.log(`   📝 Undefined tags so far: ${this.stats.undefined}`);
      }
    }
    
    console.log(`🎯 Parsing complete: ${this.stats.processed} processed, ${this.stats.errors} errors, ${this.stats.undefined} undefined`);
    return this.stats;
  }

  async parseSingleSku(sku) {
    const { id, sku_code } = sku;
    
    try {
      // Parse SKU code into tags
      const tags = this.parseSkuCode(sku_code);
      
      // Categorize each tag
      const categorizedTags = tags.map(tag => ({
        value: tag,
        category: this.categorizeTag(tag)
      }));
      
      // Check if we have undefined tags
      const undefinedTags = categorizedTags.filter(tag => tag.category === 'TEXT');
      if (undefinedTags.length > 0) {
        this.stats.undefined++;
        // Store examples of undefined tags for manual review
        if (this.stats.undefinedExamples.length < 20) {
          this.stats.undefinedExamples.push({
            sku_code,
            undefinedTags: undefinedTags.map(t => t.value)
          });
        }
        // Track ALL undefined tags for analysis
        undefinedTags.forEach(tag => {
          this.stats.allUndefinedTags.add(tag.value);
          if (!this.stats.tagToSkus.has(tag.value)) {
            this.stats.tagToSkus.set(tag.value, []);
          }
          this.stats.tagToSkus.get(tag.value).push(sku_code);
        });
      }
      
      // Store tags in database
      await this.storeSkuTags(id, tags);
      
      // Update SKU_MASTER with tag columns
      await this.updateSkuMasterTags(id, tags);
      
      this.stats.processed++;
      
    } catch (error) {
      console.error(`❌ Error parsing SKU ${sku.sku_code}:`, error.message);
      this.stats.errors++;
    }
  }

  parseSkuCode(skuCode) {
    if (!skuCode) return [];
    
    // Handle different SKU formats
    if (skuCode.includes(' / ')) {
      return this.parseMultiPartSku(skuCode);
    } else if (skuCode.includes('-')) {
      return this.parseDashSeparatedSku(skuCode);
    } else if (skuCode.includes('/')) {
      return this.parseApplePartNumber(skuCode);
    } else {
      return [skuCode.trim()];
    }
  }

  parseDashSeparatedSku(skuCode) {
    return skuCode.split('-')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
  }

  parseMultiPartSku(skuCode) {
    const parts = skuCode.split(' / ');
    const allTags = [];
    
    parts.forEach(part => {
      if (part.includes('-')) {
        allTags.push(...this.parseDashSeparatedSku(part));
      } else if (part.includes('/')) {
        allTags.push(...this.parseApplePartNumber(part));
      } else {
        allTags.push(part.trim());
      }
    });
    
    return allTags;
  }

  parseApplePartNumber(partNumber) {
    return partNumber.split('/')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
  }

  categorizeTag(tagValue) {
    const tag = tagValue.toUpperCase();
    
    // Device type tags
    if (['TABLET', 'PHONE', 'WATCH', 'COMPUTER'].includes(tag)) {
      return 'DEVICE_TYPE';
    }
    
    // Carrier tags - Keep it simple for now
    if (['TMO', 'ATT', 'VRZ', 'SPR', 'SPECTRUM', 'WIFI', '4G', '5G', 'UNLOCKED', 
         'CARRIER', 'LTE'].includes(tag)) {
      return 'CARRIER';
    }
    
         // Model tags - Same as before
     if (['FOLD3', 'FOLD4', 'FOLD5', 'FOLD6', 'FOLD7', 'ZFLIP3', 'ZFLIP4', 'ZFLIP5', 'ZFLIP6', 'ZFLIP7',
          'S10', 'S21', 'S22', 'S23', 'S24', 'S25', 'S10E', 'S21-FE', 'S21-PLUS', 'S22-PLUS', 'S22-ULTRA', 'S24-PLUS', 'S24-ULTRA', 'S25-PLUS', 'S25-EDGE', 'S25-ULTRA',
          'IPHONE13', 'IPHONE14', 'IPHONE15', 'IP-11', 'IP-12', 'IP-13', 'IP-14', 'IP-15',
          'PIXEL', 'PIXEL6', 'PIXEL7', 'PIXEL8', 'PIXEL9', 'PIXEL-FOLD', 'PIXEL-4A', 'PIXEL-5', 'PIXEL-6A', 'PIXEL-6PRO', 'PIXEL-7A', 'PIXEL-7PRO', 'PIXEL-8A', 'PIXEL-8PRO', 'PIXEL-9A', 'PIXEL-9PRO', 'PIXEL-9PRO-XL',
          'IPAD', 'IPAD-AIR', 'IPAD-MINI', 'IPAD-MINI2', 'IPAD-MINI3', 'IPAD-PRO', 'IPAD-PRO-MAX',
          'TAB-A', 'TAB-E', 'TAB-S4', 'TAB-S6', 'TAB-S6-LITE', 'TAB-S7', 'TAB-S7-PLUS', 'TAB-A9-PLUS',
          'GALAXY-VIEW2', 'WATCH-5-PRO', 'WATCH-6', 'WATCH-FE', 'WATCH-ULTRA', 'WATCH-ULTRA2',
          'ONEPLUS-10PRO', 'ONEPLUS-12R', 'MOTO-XT2131', 'MotoGStylus', 'LG-V60',
          'PRO3', 'PRO4', 'PRO5', 'PRO6', 'PRO7', 'XPS-8940', 'XPS-8950', 'XPS-9300', 'XPS-9310', 'XPS-9320', 'XPS-9380', 'XPS-7390', 'XPS-8930',
          'LATITUDE-7320', 'INSPIRON', 'GeForce-GT-1030', 'GT-710', 'GTX-1650', 'GTX-1660', 'RTX-3070', 'ROG-STRIX'].includes(tag)) {
       return 'MODEL';
     }
    
         // Model variants that are part of model identification
     if (['PRO', 'AIR', 'MINI', 'MINI2', 'MINI3', 'MINI4', 'ULTRA', 'PLUS', 'MAX', 'FE', 'LITE', 'EDGE', 'SUPER', 'TI', 'VENTUS', 'AERO', 'GAMING', 'BESPOKE', 'SE', '6A', '6PRO', '7A', '8A', '9A', '10.5'].includes(tag)) {
       return 'MODEL';
     }
    
    // Model size indicators that are part of model identification
    if (['9.7', '10.2', '10.9', '11', '12.9', '13', '14', '15', '16', '32', '64', '128', '256', '512', '1TB', '2G', '4G', '6G', '8G'].includes(tag)) {
      return 'MODEL';
    }
    
    // Generation indicators that are part of model identification
    if (/^\d+[STNDRDTH]+$/.test(tag) || /^\d+GEN$/.test(tag) || /^\d+TH$/.test(tag)) {
      return 'MODEL';
    }
    
         // Capacity tags - Check AFTER carrier (to avoid 4G, 5G being misclassified)
     if (/^\d+$/.test(tag) || /^\d+[GT]B?$/i.test(tag)) {
       return 'CAPACITY';
     }
     
     // Model size indicators that are part of model identification (but NOT pure numbers)
     if (['9.7', '10.2', '10.9', '11', '12.9', '13', '14', '15', '16'].includes(tag)) {
       return 'MODEL';
     }
    
    // Color tags - Keep it simple for now
    if (['BLK', 'BLACK', 'WHT', 'WHITE', 'GLD', 'GOLD', 'SLV', 'SILVER', 
         'GRN', 'GREEN', 'BLU', 'BLUE', 'PNK', 'PINK', 'PUR', 'PURPLE', 
         'GRY', 'GRAY', 'SG', 'SPACE_GRAY', 'ROSE', 'RED', 'ORANGE', 
         'YELLOW', 'BROWN', 'TAN', 'CREAM', 'STARLIGHT', 'BEIGE', 'BURGUNDY',
         'NAVY', 'VIOLET', 'GRAPHITE', 'CHALK', 'CHARCOAL', 'SAGE', 'CORAL',
         'LEMONGRASS', 'HAZEL', 'MINT', 'PEACH', 'PEONY', 'IRIS', 'OBSIDIAN',
         'PORCELAIN', 'BLUESHADOW', 'JETBLACK', 'ICYBLUE', 'BLUEBLACK'].includes(tag)) {
      return 'COLOR';
    }
    
    // Post-fix tags - Same as before
    if (['VG', 'LL', 'A', 'TEST', 'GRADE-A', 'GRADE-B', 'OPENBOX', 'LIKE-NEW', 'UL', 'ACCEPTABLE',
         'NEW', 'LN', 'NOSENSOR', 'UA', 'UV', 'PUS', 'POS', 'XFINITY', 'USCELLULAR', 'VERIZON',
         'TRACFONE', 'SPECIAL-EDI', 'BESPOKE', 'REV-SKIN', 'ROG-STRIX', 'RISER-CABLE'].includes(tag)) {
      return 'POSTFIX';
    }
    
    // Default - This will be marked as undefined for manual review
    return 'TEXT';
  }

  async storeSkuTags(skuMasterId, tags) {
    for (let i = 0; i < tags.length; i++) {
      const tagValue = tags[i];
      const position = i + 1;
      
      // Determine tag category
      const category = this.categorizeTag(tagValue);
      
      // Get or create tag
      const tagId = await this.getOrCreateTag(tagValue, category);
      
      // Store SKU-tag mapping
      await this.storeSkuTagMapping(skuMasterId, tagId, position, category);
    }
  }

  async getOrCreateTag(tagValue, category) {
    // Check if tag exists (by value only, not category)
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
    
            // Create new tag with conflict handling
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

  async updateSkuMasterTags(skuMasterId, tags) {
    // Extract specific tag types for fast querying
    const modelTags = tags.filter(tag => this.categorizeTag(tag) === 'MODEL');
    const modelTag = modelTags.length > 0 ? modelTags.join('|') : null;
    
    const capacityTag = tags.find(tag => this.categorizeTag(tag) === 'CAPACITY') || null;
    const colorTag = tags.find(tag => this.categorizeTag(tag) === 'COLOR') || null;
    const carrierTag = tags.find(tag => this.categorizeTag(tag) === 'CARRIER') || null;
    const postfixTag = tags.find(tag => this.categorizeTag(tag) === 'POSTFIX') || null;
    
    await this.db.query(`
      UPDATE sku_master 
      SET 
        model_tag = $1,
        capacity_tag = $2,
        color_tag = $3,
        carrier_tag = $4,
        postfix_tag = $5,
        tag_count = $6
      WHERE id = $7
    `, [modelTag, capacityTag, colorTag, carrierTag, postfixTag, tags.length, skuMasterId]);
  }

  async generateUndefinedReport() {
    console.log('\n📋 FAST PARSING ANALYSIS REPORT:');
    console.log(`Total SKUs with undefined tags: ${this.stats.undefined}`);
    console.log(`Percentage: ${Math.round(this.stats.undefined/this.stats.total*100)}%`);
    
    // Show examples of SKUs with undefined tags
    if (this.stats.undefinedExamples.length > 0) {
      console.log('\n🔍 Examples of SKUs with undefined tags:');
      this.stats.undefinedExamples.forEach(example => {
        console.log(`   ${example.sku_code}`);
        console.log(`     Undefined tags: [${example.undefinedTags.join(', ')}]`);
      });
    }

    // Analyze ALL undefined tags to find patterns
    console.log('\n🔍 ANALYSIS OF ALL UNDEFINED TAGS:');
    console.log(`Total unique undefined tags found: ${this.stats.allUndefinedTags.size}`);
    
    // Group undefined tags by length and pattern
    const tagAnalysis = this.analyzeUndefinedTags();
    
    console.log('\n📊 UNDEFINED TAG PATTERNS WITH SKU EXAMPLES:');
    
    // Single letters with SKU examples
    if (tagAnalysis.singleLetters.length > 0) {
      console.log('\n📱 Single letters (potential abbreviations):');
      tagAnalysis.singleLetters.forEach(tag => {
        const skus = this.stats.tagToSkus.get(tag);
        console.log(`   ${tag} (${skus.length} SKUs):`);
        // Show first 5 SKU examples
        skus.slice(0, 5).forEach(sku => console.log(`     - ${sku}`));
        if (skus.length > 5) {
          console.log(`     ... and ${skus.length - 5} more`);
        }
      });
    }
    
    // Two letters with SKU examples
    if (tagAnalysis.twoLetters.length > 0) {
      console.log('\n🎨 Two letters (potential abbreviations):');
      tagAnalysis.twoLetters.forEach(tag => {
        const skus = this.stats.tagToSkus.get(tag);
        console.log(`   ${tag} (${skus.length} SKUs):`);
        skus.slice(0, 5).forEach(sku => console.log(`     - ${sku}`));
        if (skus.length > 5) {
          console.log(`     ... and ${skus.length - 5} more`);
        }
      });
    }
    
    // Three+ letters with SKU examples
    if (tagAnalysis.threePlusLetters.length > 0) {
      console.log('\n🔍 Three+ letters (potential new categories):');
      tagAnalysis.threePlusLetters.forEach(tag => {
        const skus = this.stats.tagToSkus.get(tag);
        console.log(`   ${tag} (${skus.length} SKUs):`);
        skus.slice(0, 5).forEach(sku => console.log(`     - ${sku}`));
        if (skus.length > 5) {
          console.log(`     ... and ${skus.length - 5} more`);
        }
      });
    }
    
    // Numbers with SKU examples
    if (tagAnalysis.numbers.length > 0) {
      console.log('\n🔢 Numbers (potential capacity/model):');
      tagAnalysis.numbers.forEach(tag => {
        const skus = this.stats.tagToSkus.get(tag);
        console.log(`   ${tag} (${skus.length} SKUs):`);
        skus.slice(0, 5).forEach(sku => console.log(`     - ${sku}`));
        if (skus.length > 5) {
          console.log(`     ... and ${skus.length - 5} more`);
        }
      });
    }
  }

  analyzeUndefinedTags() {
    const analysis = {
      singleLetters: [],
      twoLetters: [],
      threePlusLetters: [],
      numbers: []
    };

    this.stats.allUndefinedTags.forEach(tag => {
      if (/^\d+$/.test(tag)) {
        analysis.numbers.push(tag);
      } else if (tag.length === 1) {
        analysis.singleLetters.push(tag);
      } else if (tag.length === 2) {
        analysis.twoLetters.push(tag);
      } else {
        analysis.threePlusLetters.push(tag);
      }
    });

    // Sort for readability
    analysis.singleLetters.sort();
    analysis.twoLetters.sort();
    analysis.threePlusLetters.sort();
    analysis.numbers.sort((a, b) => parseInt(a) - parseInt(b));

    return analysis;
  }
}

async function parseSkuMasterFast() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Create tables if they don't exist
    console.log('\n🏗️ Creating tag tables...');
    
    // Tags table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sku_tags (
        id SERIAL PRIMARY KEY,
        tag_name VARCHAR(50) UNIQUE NOT NULL,
        tag_category VARCHAR(50) NOT NULL,
        tag_value VARCHAR(50) NOT NULL,
        usage_count INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ sku_tags table created');

    // SKU Master Tags mapping table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sku_master_tags (
        id SERIAL PRIMARY KEY,
        sku_master_id INTEGER REFERENCES sku_master(id),
        tag_id INTEGER REFERENCES sku_tags(id),
        tag_position INTEGER NOT NULL,
        tag_category VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(sku_master_id, tag_id, tag_position)
      )
    `);
    console.log('✅ sku_master_tags table created');

    // Add tag columns to sku_master if they don't exist
    console.log('\n🔧 Adding tag columns to sku_master...');
    
    const alterQueries = [
      'ALTER TABLE sku_master ADD COLUMN IF NOT EXISTS model_tag VARCHAR(100)',
      'ALTER TABLE sku_master ADD COLUMN IF NOT EXISTS capacity_tag VARCHAR(50)',
      'ALTER TABLE sku_master ADD COLUMN IF NOT EXISTS color_tag VARCHAR(50)',
      'ALTER TABLE sku_master ADD COLUMN IF NOT EXISTS carrier_tag VARCHAR(50)',
      'ALTER TABLE sku_master ADD COLUMN IF NOT EXISTS postfix_tag VARCHAR(50)',
      'ALTER TABLE sku_master ADD COLUMN IF NOT EXISTS tag_count INTEGER DEFAULT 0'
    ];

    for (const query of alterQueries) {
      await client.query(query);
    }
    console.log('✅ Tag columns added to sku_master');

    // Parse ALL SKU_MASTER data with FAST approach
    console.log('\n🚀 Starting FAST parsing of ALL SKUs...');
    const parser = new FastSkuMasterTagParser(client);
    const result = await parser.parseAllSkuMaster();

    console.log('\n🎯 FAST Parsing Results:', result);

    // Generate undefined tags report with analysis
    await parser.generateUndefinedReport();

    // Show final summary
    console.log('\n📊 FINAL SUMMARY:');
    console.log(`✅ Successfully tagged: ${result.processed - result.undefined} SKUs`);
    console.log(`❓ Needs manual review: ${result.undefined} SKUs`);
    console.log(`❌ Errors: ${result.errors} SKUs`);
    console.log(`📈 Success rate: ${Math.round((result.processed - result.undefined)/result.total*100)}%`);

    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Review the undefined tag patterns above');
    console.log('2. Look at the SKU examples to understand context');
    console.log('3. Add common patterns to appropriate categories');
    console.log('4. Re-run the parser to improve coverage');

  } catch (error) {
    console.error('❌ Error during fast parsing:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the fast parser
parseSkuMasterFast();
