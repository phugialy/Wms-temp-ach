const { Pool } = require('pg');
require('dotenv').config();

class EnhancedSkuParser {
    constructor() {
        // Use a single direct connection for batch processing - no pooling needed
        this.client = null;
        this.batchSize = 100; // Can be larger with single connection
        this.tagBatches = [];
        this.skuTagBatches = [];
        this.skuMasterBatches = [];
        this.undefinedBatches = [];
        
        // Pattern recognition cache
        this.patternCache = new Map();
        this.brandPatterns = new Map();
        
        // Statistics
        this.stats = {
            totalProcessed: 0,
            tagsCreated: 0,
            skuTagsCreated: 0,
            undefinedQueued: 0,
            errors: 0,
            startTime: null,
            endTime: null
        };
    }

    async initialize() {
        try {
            // Create a single direct connection for the entire process
            const pool = new Pool({
                connectionString: process.env.DATABASE_URL, // Use working database URL
                max: 1,
                idleTimeoutMillis: 0, // Keep connection alive
                connectionTimeoutMillis: 30000,
            });
            
            this.client = await pool.connect();
            
            // Ensure tables exist
            await this.createTablesIfNotExist();
            
            // Initialize pattern recognition
            await this.initializePatternRecognition();
            
            console.log('✅ Enhanced SKU Parser initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Enhanced SKU Parser:', error);
            throw error;
        }
    }

    async createTablesIfNotExist() {
        try {
            // Check if undefined_tag_review table exists
            const tableExists = await this.client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'undefined_tag_review'
                );
            `);
            
            if (!tableExists.rows[0].exists) {
                console.log('Creating undefined_tag_review table...');
                await this.client.query(`
                    CREATE TABLE undefined_tag_review (
                        id SERIAL PRIMARY KEY,
                        tag_value VARCHAR(100) NOT NULL,
                        original_sku VARCHAR(200) NOT NULL,
                        status VARCHAR(50) DEFAULT 'UNDEFINED',
                        suggested_type VARCHAR(50),
                        suggested_category VARCHAR(50),
                        product_description TEXT,
                        reviewed_by VARCHAR(100),
                        reviewed_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);
            }
        } catch (error) {
            console.error('❌ Failed to create tables:', error);
            throw error;
        }
    }

    async initializePatternRecognition() {
        try {
            // Get total count
            const countResult = await this.client.query('SELECT COUNT(*) FROM sku_master');
            const totalSkus = parseInt(countResult.rows[0].count);
            
            console.log(`📊 Analyzing ${totalSkus} SKUs for pattern recognition...`);
            
            // Analyze SKU patterns in chunks
            const chunkSize = 1000;
            let processed = 0;
            
            for (let offset = 0; offset < totalSkus; offset += chunkSize) {
                const result = await this.client.query(`
                    SELECT sku_code, brand, model, capacity, color, carrier, post_fix
                    FROM sku_master 
                    ORDER BY id 
                    LIMIT $1 OFFSET $2
                `, [chunkSize, offset]);
                
                for (const row of result.rows) {
                    this.analyzeSkuPattern(row);
                    processed++;
                }
                
                if (processed % 1000 === 0) {
                    console.log(`  Processed ${processed}/${totalSkus} SKUs...`);
                }
            }
            
            console.log(`✅ Pattern recognition initialized with ${this.patternCache.size} patterns`);
            console.log(`   Brand patterns: ${this.brandPatterns.size}`);
            
        } catch (error) {
            console.error('❌ Failed to initialize pattern recognition:', error);
            throw error;
        }
    }

    analyzeSkuPattern(skuData) {
        const sku = skuData.sku_code;
        const brand = skuData.brand;
        
        // Analyze SKU structure
        const segments = this.parseSkuIntoSegments(sku);
        const pattern = this.generatePatternKey(segments);
        
        // Cache pattern
        if (!this.patternCache.has(pattern)) {
            this.patternCache.set(pattern, {
                count: 0,
                examples: [],
                segments: segments,
                brand: brand
            });
        }
        
        const patternInfo = this.patternCache.get(pattern);
        patternInfo.count++;
        if (patternInfo.examples.length < 5) {
            patternInfo.examples.push(sku);
        }
        
        // Analyze brand patterns
        if (brand && !this.brandPatterns.has(brand)) {
            this.brandPatterns.set(brand, {
                patterns: new Set(),
                totalSkus: 0,
                commonSegments: new Map()
            });
        }
        
        if (brand) {
            const brandInfo = this.brandPatterns.get(brand);
            brandInfo.patterns.add(pattern);
            brandInfo.totalSkus++;
            
            // Track common segments for this brand
            segments.forEach((segment, index) => {
                const segmentKey = `${index}:${segment}`;
                brandInfo.commonSegments.set(segmentKey, 
                    (brandInfo.commonSegments.get(segmentKey) || 0) + 1);
            });
        }
    }

    parseSkuIntoSegments(sku) {
        // Split by common delimiters but preserve certain patterns
        const segments = [];
        let currentSegment = '';
        
        for (let i = 0; i < sku.length; i++) {
            const char = sku[i];
            
            if (char === '-' || char === '_' || char === ' ') {
                if (currentSegment) {
                    segments.push(currentSegment);
                    currentSegment = '';
                }
            } else if (char === '/' && sku[i + 1] === 'A') {
                // Handle /A suffix as part of segment
                if (currentSegment) {
                    currentSegment += char + sku[i + 1];
                    segments.push(currentSegment);
                    currentSegment = '';
                    i++; // Skip next character
                }
            } else {
                currentSegment += char;
            }
        }
        
        if (currentSegment) {
            segments.push(currentSegment);
        }
        
        return segments.filter(segment => segment.length > 0);
    }

    generatePatternKey(segments) {
        // Generate a pattern key based on segment count and types
        const segmentTypes = segments.map(segment => {
            if (/^\d+$/.test(segment)) return 'N'; // Number
            if (/^\d+[A-Z]$/.test(segment)) return 'NA'; // Number + Alpha
            if (/^[A-Z]+\d+$/.test(segment)) return 'AN'; // Alpha + Number
            if (/^[A-Z]+$/.test(segment)) return 'A'; // Alpha only
            return 'M'; // Mixed
        });
        
        return `${segments.length}:${segmentTypes.join('')}`;
    }

    async parseAllSkus() {
        try {
            this.stats.startTime = new Date();
            console.log('🚀 Starting enhanced SKU parsing...');
            
            // Get all SKUs
            const result = await this.client.query(`
                SELECT id, sku_code, brand, model, capacity, color, carrier, post_fix
                FROM sku_master 
                ORDER BY id
            `);
            
            const totalSkus = result.rows.length;
            console.log(`📋 Found ${totalSkus} SKUs to process`);
            
            // Process SKUs in batches with better progress logging
            for (let i = 0; i < totalSkus; i += this.batchSize) {
                const batch = result.rows.slice(i, i + this.batchSize);
                const currentBatch = Math.floor(i / this.batchSize) + 1;
                const totalBatches = Math.ceil(totalSkus / this.batchSize);
                
                console.log(`  📦 Processing batch ${currentBatch}/${totalBatches} (SKUs ${i + 1}-${Math.min(i + this.batchSize, totalSkus)})`);
                
                // Process batch
                for (const sku of batch) {
                    await this.parseSingleSku(sku);
                }
                
                // Flush batches after each batch
                await this.flushAllBatches();
                console.log(`  ✅ Completed batch ${currentBatch}/${totalBatches}`);
                
                // Small delay to prevent overwhelming the database
                if (i + this.batchSize < totalSkus) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            console.log('  🎯 All batches processed, generating final report...');
            this.stats.endTime = new Date();
            await this.generateFinalReport();
            
        } catch (error) {
            console.error('❌ Failed to parse SKUs:', error);
            throw error;
        }
    }

    async parseSingleSku(skuData) {
        try {
            const sku = skuData.sku_code;
            const segments = this.parseSkuIntoSegments(sku);
            
            // Detect device type based on brand and pattern
            const deviceType = this.detectDeviceType(skuData, segments);
            
            // Parse tags based on device type and position
            const tags = await this.parseTagsByDeviceType(skuData, segments, deviceType);
            
            // Debug: Log tags being created
            if (tags.some(tag => !tag.tag_category)) {
                console.warn(`⚠️  SKU ${sku} has tags without category:`, tags.filter(tag => !tag.tag_category));
            }
            
            // Store tags
            for (const tag of tags) {
                await this.addToBatches(tag, skuData.id);
            }
            
            // Update sku_master with device type and tag count
            this.addToSkuMasterBatch(skuData.id, deviceType, tags.length);
            
            this.stats.totalProcessed++;
            
        } catch (error) {
            console.error(`❌ Failed to parse SKU ${skuData.sku_code}:`, error);
            this.stats.errors++;
        }
    }

    detectDeviceType(skuData, segments) {
        const brand = skuData.brand?.toUpperCase();
        const sku = skuData.sku_code.toUpperCase();
        
        // Brand-based detection
        if (brand === 'APPLE') {
            if (sku.includes('IPAD')) return 'TABLET';
            if (sku.includes('WATCH') || sku.includes('AW')) return 'WATCH';
            if (sku.includes('MAC') || sku.includes('IMAC') || sku.includes('MACBOOK')) return 'DESKTOP';
            return 'PHONE';
        }
        
        if (brand === 'SAMSUNG') {
            if (sku.includes('TAB') || sku.includes('GALAXY TAB')) return 'TABLET';
            if (sku.includes('WATCH') || sku.includes('GEAR')) return 'WATCH';
            return 'PHONE';
        }
        
        // Pattern-based detection
        const pattern = this.generatePatternKey(segments);
        const patternInfo = this.patternCache.get(pattern);
        
        if (patternInfo) {
            // Use most common device type for this pattern
            const deviceTypes = patternInfo.examples.map(example => {
                if (example.includes('TAB') || example.includes('IPAD')) return 'TABLET';
                if (example.includes('WATCH')) return 'WATCH';
                if (example.includes('MAC') || example.includes('IMAC')) return 'DESKTOP';
                return 'PHONE';
            });
            
            // Return most common
            const counts = {};
            deviceTypes.forEach(type => counts[type] = (counts[type] || 0) + 1);
            return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
        }
        
        // Default fallback
        return 'PHONE';
    }

    async parseTagsByDeviceType(skuData, segments, deviceType) {
        // Use flexible parsing that combines DB data with SKU extraction
        const combinedData = this.combineDataSources(skuData);
        const tags = this.generateTagsFromCombinedData(combinedData, skuData.sku_code, deviceType);
        return tags;
    }

    combineDataSources(skuData) {
        const sku = skuData.sku_code.toUpperCase();
        const segments = this.parseSkuIntoSegments(sku);
        
        // Start with existing database data
        const combined = {
            brand: skuData.brand,
            model: skuData.model,
            capacity: skuData.capacity,
            color: skuData.color,
            carrier: skuData.carrier,
            post_fix: skuData.post_fix
        };
        
        // Extract missing data from SKU code
        const extracted = this.extractDataFromSku(sku, segments);
        
        // Fill in missing values with extracted data
        if (!combined.brand && extracted.brand) {
            combined.brand = extracted.brand;
        }
        
        if (!combined.model && extracted.model) {
            combined.model = extracted.model;
        }
        
        if (!combined.capacity && extracted.capacity) {
            combined.capacity = extracted.capacity;
        }
        
        if (!combined.color && extracted.color) {
            combined.color = extracted.color;
        }
        
        if (!combined.carrier && extracted.carrier) {
            combined.carrier = extracted.carrier;
        }
        
        if (!combined.post_fix && extracted.post_fix) {
            combined.post_fix = extracted.post_fix;
        }
        
        return combined;
    }

    extractDataFromSku(sku, segments) {
        const extracted = {
            brand: null,
            model: null,
            capacity: null,
            color: null,
            carrier: null,
            post_fix: null
        };
        
        // Brand detection
        if (sku.includes('IPAD') || sku.includes('IPHONE') || sku.includes('MAC') || sku.includes('WATCH')) {
            extracted.brand = 'APPLE';
        } else if (sku.includes('GALAXY') || sku.includes('SAMSUNG') || sku.includes('FOLD')) {
            extracted.brand = 'SAMSUNG';
        } else if (sku.includes('PIXEL')) {
            extracted.brand = 'GOOGLE';
        } else if (sku.includes('ONEPLUS')) {
            extracted.brand = 'ONEPLUS';
        }
        
        // Model detection
        if (sku.includes('IPAD')) {
            if (sku.includes('PRO')) {
                extracted.model = 'IPAD PRO';
            } else if (sku.includes('AIR')) {
                extracted.model = 'IPAD AIR';
            } else if (sku.includes('MINI')) {
                extracted.model = 'IPAD MINI';
            } else {
                extracted.model = 'IPAD';
            }
        } else if (sku.includes('IPHONE')) {
            extracted.model = 'IPHONE';
        } else if (sku.includes('MAC')) {
            extracted.model = 'MAC';
        } else if (sku.includes('WATCH')) {
            extracted.model = 'APPLE WATCH';
        } else if (sku.includes('FOLD')) {
            extracted.model = 'GALAXY FOLD';
        }
        
        // Capacity detection
        const capacityMatch = sku.match(/(\d+)(?:GB|TB|MB)/i);
        if (capacityMatch) {
            extracted.capacity = capacityMatch[0];
        } else {
            // Look for just numbers that could be capacity
            const numberMatch = sku.match(/(\d{2,4})/);
            if (numberMatch && parseInt(numberMatch[1]) <= 2048) {
                extracted.capacity = numberMatch[1] + 'GB';
            }
        }
        
        // Color detection
        const colors = ['BLACK', 'WHITE', 'BLUE', 'RED', 'GREEN', 'GOLD', 'SILVER', 'ROSE', 'PURPLE', 'ORANGE', 'SLV', 'SG', 'BLK'];
        for (const color of colors) {
            if (sku.includes(color)) {
                if (color === 'SLV' || color === 'SG') extracted.color = 'SILVER';
                else if (color === 'BLK') extracted.color = 'BLACK';
                else extracted.color = color;
                break;
            }
        }
        
        // Carrier detection
        const carriers = ['WIFI', '4G', '5G', 'LTE', 'CDMA', 'GSM', 'GLOBAL', 'INTERNATIONAL', 'VG', 'TMO'];
        for (const carrier of carriers) {
            if (sku.includes(carrier)) {
                if (carrier === 'VG') extracted.carrier = 'VERIZON';
                else if (carrier === 'TMO') extracted.carrier = 'T-MOBILE';
                else extracted.carrier = carrier;
                break;
            }
        }
        
        // Post fix detection
        const lastSegment = segments[segments.length - 1];
        if (lastSegment && 
            !extracted.capacity && 
            !extracted.color && 
            !extracted.carrier && 
            !extracted.model &&
            lastSegment.length <= 10) {
            extracted.post_fix = lastSegment;
        }
        
        return extracted;
    }

    generateTagsFromCombinedData(combinedData, skuCode, deviceType) {
        const tags = [];
        const segments = this.parseSkuIntoSegments(skuCode);
        
        // Brand tag
        if (combinedData.brand) {
            tags.push({
                tag_name: combinedData.brand,
                tag_category: 'BRAND',
                tag_value: combinedData.brand
            });
        }
        
        // Device type tag
        tags.push({
            tag_name: deviceType,
            tag_category: 'DEVICE_TYPE',
            tag_value: deviceType
        });
        
        // Model tag
        if (combinedData.model) {
            tags.push({
                tag_name: combinedData.model,
                tag_category: 'MODEL',
                tag_value: combinedData.model
            });
        } else {
            // Fallback: use first few segments as model
            const modelSegments = segments.slice(0, 3).filter(segment => 
                !this.isCapacity(segment) && !this.isColor(segment) && !this.isCarrier(segment)
            );
            modelSegments.forEach(segment => {
                tags.push({
                    tag_name: segment,
                    tag_category: 'MODEL',
                    tag_value: segment
                });
            });
        }
        
        // Capacity tag
        if (combinedData.capacity) {
            tags.push({
                tag_name: combinedData.capacity,
                tag_category: 'CAPACITY',
                tag_value: combinedData.capacity
            });
        }
        
        // Color tag
        if (combinedData.color) {
            tags.push({
                tag_name: combinedData.color,
                tag_category: 'COLOR',
                tag_value: combinedData.color
            });
        }
        
        // Carrier tag
        if (combinedData.carrier) {
            tags.push({
                tag_name: combinedData.carrier,
                tag_category: 'CARRIER',
                tag_value: combinedData.carrier
            });
        }
        
        // Post fix tag
        if (combinedData.post_fix) {
            tags.push({
                tag_name: combinedData.post_fix,
                tag_category: 'POSTFIX',
                tag_value: combinedData.post_fix
            });
        }
        
        return tags;
    }

    // Old parsing methods removed - replaced with flexible parsing logic above

    isCapacity(segment) {
        // Check if segment looks like capacity
        return /^\d+[GM]B?$|^\d+TB?$/i.test(segment) || 
               /^\d+$/.test(segment) && parseInt(segment) <= 2048;
    }

    isColor(segment) {
        // Check if segment looks like color
        const colorKeywords = ['BLACK', 'WHITE', 'BLUE', 'RED', 'GREEN', 'GOLD', 'SILVER', 'ROSE', 'PURPLE', 'ORANGE'];
        return colorKeywords.some(color => segment.toUpperCase().includes(color));
    }

    isCarrier(segment) {
        // Check if segment looks like carrier
        const carrierKeywords = ['4G', '5G', 'LTE', 'CDMA', 'GSM', 'WIFI', 'GLOBAL', 'INTERNATIONAL'];
        return carrierKeywords.some(carrier => segment.toUpperCase().includes(carrier));
    }

    isSize(segment) {
        // Check if segment looks like size (for watches)
        return /^\d+mm$|^\d+\.\d+"$|^\d+"$/.test(segment);
    }

    async addToBatches(tag, skuMasterId) {
        try {
            // Validate tag has required fields
            if (!tag.tag_name || !tag.tag_category || !tag.tag_value) {
                console.warn(`⚠️  Skipping invalid tag: ${JSON.stringify(tag)}`);
                return;
            }
            
            // Add to tag batch
            this.tagBatches.push({
                tag_name: tag.tag_name,
                tag_category: tag.tag_category,
                tag_value: tag.tag_value
            });
            
            // Flush tag batch if full
            if (this.tagBatches.length >= this.batchSize) {
                await this.flushTagBatch();
            }
            
            // Add to sku tag batch
            this.skuTagBatches.push({
                sku_master_id: skuMasterId,
                tag_name: tag.tag_name,
                tag_category: tag.tag_category,
                tag_position: 0 // Will be calculated during flush
            });
            
            // Flush sku tag batch if full
            if (this.skuTagBatches.length >= this.batchSize) {
                await this.flushSkuTagBatch();
            }
            
        } catch (error) {
            console.error('❌ Failed to add to batches:', error);
            throw error;
        }
    }

    addToSkuMasterBatch(skuMasterId, deviceType, tagCount) {
        this.skuMasterBatches.push({
            id: skuMasterId,
            device_type: deviceType,
            tag_count: tagCount
        });
        
        // Flush if batch is full
        if (this.skuMasterBatches.length >= this.batchSize) {
            this.flushSkuMasterBatch();
        }
    }

    async flushAllBatches() {
        try {
            await Promise.all([
                this.flushTagBatch(),
                this.flushSkuTagBatch(),
                this.flushSkuMasterBatch(),
                this.flushUndefinedBatch()
            ]);
        } catch (error) {
            console.error('❌ Failed to flush batches:', error);
            throw error;
        }
    }

    async flushTagBatch() {
        if (this.tagBatches.length === 0) return;
        
        try {
            for (const tag of this.tagBatches) {
                try {
                    // Check if tag already exists
                    const existingTag = await this.client.query(`
                        SELECT id, usage_count FROM sku_tags 
                        WHERE tag_name = $1 AND tag_category = $2
                    `, [tag.tag_name, tag.tag_category]);
                    
                    if (existingTag.rows.length > 0) {
                        // Tag exists, increment usage count
                        await this.client.query(`
                            UPDATE sku_tags 
                            SET usage_count = usage_count + 1
                            WHERE id = $1
                        `, [existingTag.rows[0].id]);
                        
                        // Store the existing tag ID for later use
                        tag.existing_id = existingTag.rows[0].id;
                    } else {
                        // Tag doesn't exist, create new one
                        const result = await this.client.query(`
                            INSERT INTO sku_tags (tag_name, tag_category, tag_value, usage_count)
                            VALUES ($1, $2, $3, 1)
                            RETURNING id
                        `, [tag.tag_name, tag.tag_category, tag.tag_value]);
                        
                        tag.existing_id = result.rows[0].id;
                        this.stats.tagsCreated++;
                    }
                    
                } catch (error) {
                    console.error(`❌ Failed to process tag ${tag.tag_name}:`, error);
                    // If tag creation fails, queue for manual review
                    await this.queueForManualReview(tag.tag_value, tag.tag_name, tag.tag_category);
                }
            }
            
            const batchSize = this.tagBatches.length;
            this.tagBatches = [];
            console.log(`  ✅ Flushed ${batchSize} tag batches`);
            
        } catch (error) {
            console.error('❌ Failed to flush tag batch:', error);
            throw error;
        }
    }

    async flushSkuTagBatch() {
        if (this.skuTagBatches.length === 0) return;
        
        try {
            for (const skuTag of this.skuTagBatches) {
                try {
                    // Validate skuTag has required fields
                    if (!skuTag.tag_name || !skuTag.tag_category) {
                        console.warn(`⚠️  Skipping invalid skuTag: ${JSON.stringify(skuTag)}`);
                        continue;
                    }
                    
                    // Get tag ID
                    const tagResult = await this.client.query(`
                        SELECT id FROM sku_tags 
                        WHERE tag_name = $1 AND tag_category = $2
                    `, [skuTag.tag_name, skuTag.tag_category]);
                    
                    if (tagResult.rows.length > 0) {
                        const tagId = tagResult.rows[0].id;
                        
                        // Check if this relationship already exists
                        const existingRelation = await this.client.query(`
                            SELECT id FROM sku_master_tags 
                            WHERE sku_master_id = $1 AND tag_id = $2
                        `, [skuTag.sku_master_id, tagId]);
                        
                        if (existingRelation.rows.length === 0) {
                            // Insert sku tag relationship (avoid duplicates)
                            await this.client.query(`
                                INSERT INTO sku_master_tags (sku_master_id, tag_id, tag_position, tag_category)
                                VALUES ($1, $2, $3, $4)
                            `, [skuTag.sku_master_id, tagId, skuTag.tag_position, skuTag.tag_category]);
                            
                            this.stats.skuTagsCreated++;
                        } else {
                            console.log(`  ⚠️  Skipping duplicate relationship: SKU ${skuTag.sku_master_id} already has tag ${tagId}`);
                        }
                    }
                } catch (error) {
                    console.error('❌ Failed to create sku tag relationship:', error);
                }
            }
            
            const batchSize = this.skuTagBatches.length;
            this.skuTagBatches = [];
            console.log(`  ✅ Flushed ${batchSize} SKU tag batches`);
            
        } catch (error) {
            console.error('❌ Failed to flush SKU tag batch:', error);
            throw error;
        }
    }

    async flushSkuMasterBatch() {
        if (this.skuMasterBatches.length === 0) return;
        
        try {
            for (const skuMaster of this.skuMasterBatches) {
                try {
                    await this.client.query(`
                        UPDATE sku_master 
                        SET device_type = $1, tag_count = $2
                        WHERE id = $3
                    `, [skuMaster.device_type, skuMaster.tag_count, skuMaster.id]);
                } catch (error) {
                    console.error('❌ Failed to update sku master:', error);
                }
            }
            
            this.skuMasterBatches = [];
            
        } catch (error) {
            console.error('❌ Failed to flush sku master batch:', error);
            throw error;
        }
    }

    async flushUndefinedBatch() {
        if (this.undefinedBatches.length === 0) return;
        
        try {
            for (const undefinedTag of this.undefinedBatches) {
                try {
                    await this.client.query(`
                        INSERT INTO undefined_tag_review 
                        (tag_value, original_sku, status, suggested_type, suggested_category, product_description)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        ON CONFLICT (tag_value, original_sku) DO NOTHING
                    `, [
                        undefinedTag.tag_value,
                        undefinedTag.original_sku,
                        'UNDEFINED',
                        undefinedTag.suggested_type,
                        undefinedTag.suggested_category,
                        undefinedTag.product_description
                    ]);
                    
                    this.stats.undefinedQueued++;
                } catch (error) {
                    console.error('❌ Failed to queue undefined tag:', error);
                }
            }
            
            this.undefinedBatches = [];
            
        } catch (error) {
            console.error('❌ Failed to flush undefined batch:', error);
            throw error;
        }
    }

    async queueForManualReview(tagValue, tagName, tagCategory) {
        this.undefinedBatches.push({
            tag_value: tagValue,
            original_sku: tagName,
            suggested_type: tagCategory,
            suggested_category: tagCategory,
            product_description: `Tag: ${tagValue} (${tagCategory})`
        });
        
        // Flush if batch is full
        if (this.undefinedBatches.length >= this.batchSize) {
            await this.flushUndefinedBatch();
        }
    }

    async generateFinalReport() {
        const duration = this.stats.endTime - this.stats.startTime;
        const durationSeconds = Math.round(duration / 1000);
        
        console.log('\n📊 Enhanced SKU Parser - Final Report');
        console.log('=====================================');
        console.log(`⏱️  Total Duration: ${durationSeconds} seconds`);
        console.log(`📋 Total SKUs Processed: ${this.stats.totalProcessed}`);
        console.log(`🏷️  Tags Created: ${this.stats.tagsCreated}`);
        console.log(`🔗 SKU-Tag Relationships: ${this.stats.skuTagsCreated}`);
        console.log(`❓ Undefined Tags Queued: ${this.stats.undefinedQueued}`);
        console.log(`❌ Errors: ${this.stats.errors}`);
        console.log(`⚡ Average Speed: ${Math.round(this.stats.totalProcessed / durationSeconds)} SKUs/second`);
        
        // Pattern recognition summary
        console.log(`\n🔍 Pattern Recognition Summary:`);
        console.log(`   Total Patterns: ${this.patternCache.size}`);
        console.log(`   Brand Patterns: ${this.brandPatterns.size}`);
        
        // Top patterns
        const topPatterns = Array.from(this.patternCache.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5);
        
        console.log(`\n🏆 Top 5 Patterns:`);
        topPatterns.forEach(([pattern, info], index) => {
            console.log(`   ${index + 1}. ${pattern} (${info.count} SKUs) - ${info.brand || 'Unknown'}`);
        });
        
        console.log('\n✅ Enhanced SKU parsing completed successfully!');
    }

    async close() {
        if (this.client) {
            this.client.release();
        }
    }
}

module.exports = EnhancedSkuParser;
