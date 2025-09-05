const { Pool } = require('pg');
require('dotenv').config();

class SkuMatchingService {
    constructor() {
        this.client = null;
        this.abbreviationMappings = new Map();
        this.stats = {
            totalMatches: 0,
            exactMatches: 0,
            abbreviationMatches: 0,
            tokenMatches: 0,
            noMatches: 0
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
            
            // Load abbreviation mappings
            await this.loadAbbreviations();
            
            console.log('✅ SKU Matching Service initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize SKU Matching Service:', error);
            throw error;
        }
    }

    async loadAbbreviations() {
        try {
            const result = await this.client.query(`
                SELECT abbreviation, full_value, category 
                FROM abbreviation_mappings 
                WHERE is_active = true
            `);
            
            this.abbreviationMappings.clear();
            
            result.rows.forEach(row => {
                const key = `${row.category}:${row.abbreviation}`;
                this.abbreviationMappings.set(key, row.full_value);
            });
            
            console.log(`📚 Loaded ${this.abbreviationMappings.size} abbreviation mappings`);
        } catch (error) {
            console.error('❌ Failed to load abbreviations:', error);
        }
    }

    async matchDeviceToSku(deviceCharacteristics) {
        try {
            console.log(`🔍 Matching device: ${JSON.stringify(deviceCharacteristics)}`);
            
            // Get all SKUs with their tags
            const skus = await this.getAllSkusWithTags();
            
            const matches = [];
            
            for (const sku of skus) {
                const matchResult = this.calculateMatchScore(deviceCharacteristics, sku.sku_tags);
                
                if (matchResult.score > 0) {
                    matches.push({
                        sku,
                        ...matchResult
                    });
                }
            }
            
            // Sort by score (highest first)
            matches.sort((a, b) => b.score - a.score);
            
            // Update stats
            this.stats.totalMatches += matches.length;
            if (matches.length > 0) {
                if (matches[0].method === 'exact') this.stats.exactMatches++;
                else if (matches[0].method === 'abbreviation') this.stats.abbreviationMatches++;
                else if (matches[0].method === 'token') this.stats.tokenMatches++;
            } else {
                this.stats.noMatches++;
            }
            
            console.log(`📊 Found ${matches.length} matches (best score: ${matches[0]?.score || 0})`);
            
            return matches;
            
        } catch (error) {
            console.error('❌ Matching failed:', error);
            throw error;
        }
    }

    async getAllSkusWithTags() {
        const result = await this.client.query(`
            SELECT id, sku_code, sku_tags, brand, model, capacity, color, carrier, post_fix
            FROM sku_master 
            WHERE sku_tags IS NOT NULL AND array_length(sku_tags, 1) > 0
            ORDER BY id
        `);
        
        return result.rows;
    }

    calculateMatchScore(device, skuTags) {
        let score = 0;
        let method = 'none';
        let matchedCharacteristics = [];
        
        // Match each device characteristic
        if (device.model) {
            const modelMatch = this.matchValue(device.model, skuTags, 'MODEL');
            if (modelMatch.match) {
                score += 30;
                matchedCharacteristics.push(`MODEL: ${modelMatch.matched}`);
                if (modelMatch.method === 'exact') method = 'exact';
                else if (method !== 'exact') method = modelMatch.method;
            }
        }
        
        if (device.capacity) {
            const capacityMatch = this.matchValue(device.capacity, skuTags, 'CAPACITY');
            if (capacityMatch.match) {
                score += 25;
                matchedCharacteristics.push(`CAPACITY: ${capacityMatch.matched}`);
                if (capacityMatch.method === 'exact') method = 'exact';
                else if (method !== 'exact') method = capacityMatch.method;
            }
        }
        
        if (device.color) {
            const colorMatch = this.matchValue(device.color, skuTags, 'COLOR');
            if (colorMatch.match) {
                score += 20;
                matchedCharacteristics.push(`COLOR: ${colorMatch.matched}`);
                if (colorMatch.method === 'exact') method = 'exact';
                else if (method !== 'exact') method = colorMatch.method;
            }
        }
        
        if (device.carrier) {
            const carrierMatch = this.matchValue(device.carrier, skuTags, 'CARRIER');
            if (carrierMatch.match) {
                score += 15;
                matchedCharacteristics.push(`CARRIER: ${carrierMatch.matched}`);
                if (carrierMatch.method === 'exact') method = 'exact';
                else if (method !== 'exact') method = carrierMatch.method;
            }
        }
        
        if (device.postfix) {
            const postfixMatch = this.matchValue(device.postfix, skuTags, 'POSTFIX');
            if (postfixMatch.match) {
                score += 10;
                matchedCharacteristics.push(`POSTFIX: ${postfixMatch.matched}`);
                if (postfixMatch.method === 'exact') method = 'exact';
                else if (method !== 'exact') method = postfixMatch.method;
            }
        }
        
        return {
            score,
            method,
            matchedCharacteristics,
            totalCharacteristics: Object.keys(device).filter(key => device[key]).length
        };
    }

    matchValue(value, skuTags, category) {
        if (!value || !skuTags) {
            return { match: false, method: 'none' };
        }
        
        const upperValue = value.toUpperCase();
        
        // Check exact match
        if (skuTags.includes(upperValue)) {
            return { 
                match: true, 
                method: 'exact', 
                matched: upperValue 
            };
        }
        
        // Check abbreviation match
        const normalized = this.normalizeValue(upperValue, category);
        if (normalized && skuTags.includes(normalized)) {
            return { 
                match: true, 
                method: 'abbreviation', 
                matched: normalized 
            };
        }
        
        // Check token match (for multi-word values)
        if (upperValue.includes(' ')) {
            const tokens = upperValue.split(' ');
            for (const token of tokens) {
                if (skuTags.includes(token)) {
                    return { 
                        match: true, 
                        method: 'token', 
                        matched: token 
                    };
                }
                
                // Check normalized token
                const normalizedToken = this.normalizeValue(token, category);
                if (normalizedToken && skuTags.includes(normalizedToken)) {
                    return { 
                        match: true, 
                        method: 'token', 
                        matched: normalizedToken 
                    };
                }
            }
        }
        
        return { match: false, method: 'none' };
    }

    normalizeValue(value, category) {
        // Check abbreviation mappings for this category
        const key = `${category}:${value}`;
        return this.abbreviationMappings.get(key) || null;
    }

    async getMatchingStats() {
        return {
            ...this.stats,
            totalMatches: this.stats.totalMatches,
            successRate: this.stats.totalMatches > 0 ? 
                ((this.stats.exactMatches + this.stats.abbreviationMatches + this.stats.tokenMatches) / this.stats.totalMatches * 100).toFixed(1) : 0
        };
    }

    async close() {
        if (this.client) {
            this.client.release();
        }
    }
}

module.exports = SkuMatchingService; 