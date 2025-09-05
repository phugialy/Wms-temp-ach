const { Pool } = require('pg');
require('dotenv').config();

class SimpleSkuParser {
    constructor() {
        this.client = null;
        this.batchSize = 100;
        this.stats = {
            totalProcessed: 0,
            skusUpdated: 0,
            errors: 0,
            startTime: null,
            endTime: null
        };
    }

    async initialize() {
        try {
            const pool = new Pool({
                connectionString: process.env.DIRECT_URL,
                max: 1,
                idleTimeoutMillis: 0,
                connectionTimeoutMillis: 30000,
            });
            
            this.client = await pool.connect();
            console.log('✅ Simple SKU Parser initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Simple SKU Parser:', error);
            throw error;
        }
    }

    async parseAllSkus() {
        try {
            this.stats.startTime = new Date();
            console.log('🚀 Starting simple SKU parsing...');
            
            // Get all SKUs
            const result = await this.client.query(`
                SELECT id, sku_code, brand, model, capacity, color, carrier, post_fix
                FROM sku_master 
                ORDER BY id
            `);
            
            const totalSkus = result.rows.length;
            console.log(`📋 Found ${totalSkus} SKUs to process`);
            
            // Process SKUs in batches
            for (let i = 0; i < totalSkus; i += this.batchSize) {
                const batch = result.rows.slice(i, i + this.batchSize);
                const currentBatch = Math.floor(i / this.batchSize) + 1;
                const totalBatches = Math.ceil(totalSkus / this.batchSize);
                
                console.log(`  📦 Processing batch ${currentBatch}/${totalBatches} (SKUs ${i + 1}-${Math.min(i + this.batchSize, totalSkus)})`);
                
                // Process batch
                for (const sku of batch) {
                    await this.parseSingleSku(sku);
                }
                
                // Small delay to prevent overwhelming the database
                if (i + this.batchSize < totalSkus) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            console.log('  🎯 All SKUs processed, generating final report...');
            this.stats.endTime = new Date();
            await this.generateFinalReport();
            
        } catch (error) {
            console.error('❌ Failed to parse SKUs:', error);
            throw error;
        }
    }

    async parseSingleSku(skuData) {
        try {
            // Generate simple SKU tags
            const skuTags = this.generateSimpleSkuTags(skuData);
            
            // Update sku_master with tags
            await this.updateSkuMasterTags(skuData.id, skuTags);
            
            this.stats.totalProcessed++;
            
        } catch (error) {
            console.error(`❌ Failed to parse SKU ${skuData.sku_code}:`, error);
            this.stats.errors++;
        }
    }

    generateSimpleSkuTags(skuData) {
        const tags = [];
        const segments = this.parseSkuIntoSegments(skuData.sku_code);
        
        // Add meaningful segments as tags
        segments.forEach(segment => {
            if (this.isValidTag(segment)) {
                tags.push(segment.toUpperCase());
            }
        });
        
        // Add existing data as tags if not already included
        if (skuData.brand && !tags.includes(skuData.brand.toUpperCase())) {
            tags.push(skuData.brand.toUpperCase());
        }
        
        if (skuData.model && !tags.includes(skuData.model.toUpperCase())) {
            tags.push(skuData.model.toUpperCase());
        }
        
        if (skuData.capacity && !tags.includes(skuData.capacity.toUpperCase())) {
            tags.push(skuData.capacity.toUpperCase());
        }
        
        if (skuData.color && !tags.includes(skuData.color.toUpperCase())) {
            tags.push(skuData.color.toUpperCase());
        }
        
        if (skuData.carrier && !tags.includes(skuData.carrier.toUpperCase())) {
            tags.push(skuData.carrier.toUpperCase());
        }
        
        if (skuData.post_fix && !tags.includes(skuData.post_fix.toUpperCase())) {
            tags.push(skuData.post_fix.toUpperCase());
        }
        
        return tags;
    }

    parseSkuIntoSegments(sku) {
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
                if (currentSegment) {
                    currentSegment += char + sku[i + 1];
                    segments.push(currentSegment);
                    currentSegment = '';
                    i++;
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

    isValidTag(segment) {
        // Filter out segments that are too short or too long
        if (segment.length < 2 || segment.length > 20) {
            return false;
        }
        
        // Filter out segments that are just numbers (unless they're capacity)
        if (/^\d+$/.test(segment) && parseInt(segment) > 2048) {
            return false;
        }
        
        // Filter out common delimiters or meaningless segments
        const invalidSegments = ['A', 'LL', 'LL/A', 'LL-A'];
        if (invalidSegments.includes(segment)) {
            return false;
        }
        
        return true;
    }

    async updateSkuMasterTags(skuId, skuTags) {
        try {
            await this.client.query(`
                UPDATE sku_master 
                SET sku_tags = $1, 
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [skuTags, skuId]);
            
            this.stats.skusUpdated++;
            
        } catch (error) {
            console.error(`❌ Failed to update SKU ${skuId}:`, error);
            throw error;
        }
    }

    async generateFinalReport() {
        const duration = this.stats.endTime - this.stats.startTime;
        const durationSeconds = Math.round(duration / 1000);
        
        console.log('\n📊 Simple SKU Parser - Final Report');
        console.log('=====================================');
        console.log(`⏱️  Total Duration: ${durationSeconds} seconds`);
        console.log(`📋 Total SKUs Processed: ${this.stats.totalProcessed}`);
        console.log(`✅ SKUs Updated: ${this.stats.skusUpdated}`);
        console.log(`❌ Errors: ${this.stats.errors}`);
        console.log(`⚡ Average Speed: ${Math.round(this.stats.totalProcessed / durationSeconds)} SKUs/second`);
        
        console.log('\n✅ Simple SKU parsing completed successfully!');
    }

    async close() {
        if (this.client) {
            this.client.release();
        }
    }
}

module.exports = SimpleSkuParser;

