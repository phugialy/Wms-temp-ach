const { Pool } = require('pg');
require('dotenv').config();

class EnhancedMatchingService {
    constructor() {
        this.client = null;
        this.abbreviationMappings = new Map();
        this.modelMappings = new Map();
        this.carrierMappings = new Map();
        this.colorMappings = new Map();
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
            
            // Initialize smart mappings for your real data
            this.initializeSmartMappings();
            
            console.log('✅ Enhanced Matching Service initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Enhanced Matching Service:', error);
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

    initializeSmartMappings() {
        // Model mappings for your real IMEI data
        this.modelMappings.set('GALAXY Z FOLD3 DUOS', 'FOLD3');
        this.modelMappings.set('GALAXY Z FOLD3', 'FOLD3');
        this.modelMappings.set('GALAXY FOLD3', 'FOLD3');
        this.modelMappings.set('FOLD3 DUOS', 'FOLD3');
        
        // Carrier mappings for your real IMEI data
        this.carrierMappings.set('T-MOBILE', 'TMO');
        this.carrierMappings.set('VERIZON', 'VG');
        this.carrierMappings.set('AT&T', 'ATT');
        this.carrierMappings.set('UNLOCKED', 'UNL');
        this.carrierMappings.set('LOCKED', 'LKD');
        
        // Color mappings for your real IMEI data
        this.colorMappings.set('PHANTOM BLACK', 'BLK');
        this.colorMappings.set('PHANTOM GREEN', 'GRN');
        this.colorMappings.set('PHANTOM SILVER', 'SLV');
        this.colorMappings.set('PHANTOM GOLD', 'GLD');
        this.colorMappings.set('PHANTOM WHITE', 'WHT');
        
        console.log('🧠 Smart mappings initialized for real IMEI data');
    }

    async matchImeiToSku(imeiData) {
        try {
            console.log(`🔍 Matching IMEI device: ${JSON.stringify(imeiData)}`);
            
            // Normalize IMEI data to match SKU tag format
            const normalizedData = this.normalizeImeiData(imeiData);
            console.log(`📝 Normalized to: ${JSON.stringify(normalizedData)}`);
            
            // Get all SKUs with their tags
            const skus = await this.getAllSkusWithTags();
            
            const matches = [];
            
            for (const sku of skus) {
                const matchResult = this.calculateMatchScore(normalizedData, sku.sku_tags);
                
                if (matchResult.score > 0) {
                    matches.push({
                        sku,
                        ...matchResult
                    });
                }
            }
            
            // Sort by score (highest first)
            matches.sort((a, b) => b.score - a.score);
            
            console.log(`📊 Found ${matches.length} matches (best score: ${matches[0]?.score || 0})`);
            
            return matches;
            
        } catch (error) {
            console.error('❌ Matching failed:', error);
            throw error;
        }
    }

    normalizeImeiData(imeiData) {
        const normalized = {};
        
        // Normalize model
        if (imeiData.model) {
            const upperModel = imeiData.model.toUpperCase();
            normalized.model = this.modelMappings.get(upperModel) || upperModel;
        }
        
        // Normalize capacity (remove GB suffix)
        if (imeiData.capacity) {
            normalized.capacity = imeiData.capacity.replace(/GB$/i, '');
        }
        
        // Normalize color
        if (imeiData.color) {
            const upperColor = imeiData.color.toUpperCase();
            normalized.color = this.colorMappings.get(upperColor) || upperColor;
        }
        
        // Normalize carrier
        if (imeiData.carrier) {
            const upperCarrier = imeiData.carrier.toUpperCase();
            normalized.carrier = this.carrierMappings.get(upperCarrier) || upperCarrier;
        }
        
        // Keep other fields as-is
        normalized.postfix = imeiData.postfix;
        normalized.device_notes = imeiData.device_notes;
        
        return normalized;
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
        
        // Enhanced: Parse device_notes for additional matching
        if (device.device_notes) {
            const notesScore = this.parseDeviceNotes(device.device_notes, skuTags);
            if (notesScore > 0) {
                score += notesScore;
                if (method === 'exact') method = 'notes_enhanced';
                else method = 'notes_enhanced';
                matchedCharacteristics.push(`NOTES: +${notesScore} points`);
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

    parseDeviceNotes(notes, skuTags) {
        if (!notes || !skuTags) return 0;
        
        let score = 0;
        const upperNotes = notes.toUpperCase();
        
        // Split notes into tokens and check for matches
        const tokens = upperNotes.split(/[\s,.-]+/).filter(token => token.length > 2);
        
        for (const token of tokens) {
            if (skuTags.includes(token)) {
                score += 5; // Small bonus for each token match
            }
            
            // Check for common abbreviations from your real data
            if (token === 'SLV' && skuTags.includes('SILVER')) score += 5;
            if (token === 'BLK' && skuTags.includes('BLACK')) score += 5;
            if (token === 'GRN' && skuTags.includes('GREEN')) score += 5;
            if (token === 'WHT' && skuTags.includes('WHITE')) score += 5;
            if (token === 'GLD' && skuTags.includes('GOLD')) score += 5;
            if (token === 'TMO' && skuTags.includes('T-MOBILE')) score += 5;
            if (token === 'VG' && skuTags.includes('VERIZON')) score += 5;
            if (token === 'ATT' && skuTags.includes('AT&T')) score += 5;
            
            // Handle your specific carrier cases
            if (token === 'UNLOCKED' && skuTags.includes('UNLOCKED')) score += 5;
            if (token === 'LOCKED' && skuTags.includes('LOCKED')) score += 5;
            
            // Handle condition notes
            if (token === 'SCRATCHES' && skuTags.includes('SCRATCHES')) score += 3;
            if (token === 'OIL' && skuTags.includes('OIL')) score += 3;
            if (token === 'SCREEN' && skuTags.includes('SCREEN')) score += 3;
        }
        
        return Math.min(score, 25); // Cap at 25 points for notes matching
    }

    async close() {
        if (this.client) {
            this.client.release();
        }
    }
}

module.exports = EnhancedMatchingService;

