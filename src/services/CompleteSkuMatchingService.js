const { Pool } = require('pg');
require('dotenv').config();

class CompleteSkuMatchingService {
    constructor() {
        this.client = null;
        this.abbreviationMappings = new Map();
        this.modelMappings = new Map();
        this.carrierMappings = new Map();
        this.colorMappings = new Map();
        this.postfixMappings = new Map();
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
            
            console.log('✅ Complete SKU Matching Service initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Complete SKU Matching Service:', error);
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
        
        // POSTFIX mappings for grades and conditions
        this.postfixMappings.set('VG', { grade: 'Grade B', condition: 'Good condition' });
        this.postfixMappings.set('UV', { grade: 'Grade B', condition: 'Good condition' });
        this.postfixMappings.set('ACCEPTABLE', { grade: 'Grade C', condition: 'Acceptable condition' });
        this.postfixMappings.set('UL', { grade: 'Grade A', condition: 'Has retail box' });
        this.postfixMappings.set('LN', { grade: 'Grade A', condition: 'Has retail box' });
        this.postfixMappings.set('NEW', { grade: 'New', condition: 'Sealed box' });
        
        console.log('🧠 Smart mappings initialized for real IMEI data');
    }

    /**
     * Main method to match IMEI device to SKUs
     * @param {Object} imeiData - IMEI device characteristics
     * @param {Object} options - Matching options
     * @param {boolean} options.filterPostfix - Filter out SKUs with postfix (default: true for bulk processing)
     * @param {number} options.minScore - Minimum score threshold (default: 70)
     * @param {number} options.maxResults - Maximum results to return (default: 10)
     * @returns {Array} Array of matched SKUs with scores and details
     */
    async matchImeiToSku(imeiData, options = {}) {
        try {
            const {
                filterPostfix = true,  // Default: filter out postfix SKUs for bulk processing
                minScore = 70,         // Default: only high-quality matches
                maxResults = 10        // Default: top 10 results
            } = options;

            console.log(`🔍 Matching IMEI device: ${JSON.stringify(imeiData)}`);
            console.log(`⚙️  Options: filterPostfix=${filterPostfix}, minScore=${minScore}, maxResults=${maxResults}`);
            
            // CORRECT: Parse device_notes to determine actual carrier status
            const actualCarrier = this.parseCarrierFromNotes(imeiData);
            console.log(`📝 device_notes OVERRIDE: carrier "${imeiData.carrier}" → "${actualCarrier}"`);
            
            // Create corrected device with proper carrier
            const correctedDevice = {
                ...imeiData,
                carrier: actualCarrier
            };
            
            // Get SKUs based on filtering options (smart filtering by device characteristics)
            const { skus, requiresAttention } = await this.getFilteredSkus(correctedDevice, filterPostfix);
            console.log(`📋 Found ${skus.length} SKUs after smart filtering`);
            
            if (requiresAttention) {
                console.log(`⚠️  ATTENTION REQUIRED: Ambiguous carrier status - no explicit lock/unlock indication`);
            }
            
            // Calculate matches
            const matches = [];
            
            for (const sku of skus) {
                const matchResult = this.calculateMatchScore(correctedDevice, sku.sku_tags);
                
                if (matchResult.totalScore >= minScore) {
                    matches.push({
                        sku,
                        ...matchResult
                    });
                }
            }
            
            // 🆕 Sort by TOTAL score (primary + tiebreaker) for better ranking
            matches.sort((a, b) => b.totalScore - a.totalScore);
            const limitedMatches = matches.slice(0, maxResults);
            
            console.log(`📊 Found ${matches.length} matches (showing top ${limitedMatches.length})`);
            
            return {
                matches: limitedMatches,
                requiresAttention: requiresAttention
            };
            
        } catch (error) {
            console.error('❌ Matching failed:', error);
            throw error;
        }
    }

    /**
     * CORRECT: Parse device_notes to determine actual carrier status
     * @param {Object} device - Device data with device_notes
     * @returns {string} Corrected carrier status
     */
    parseCarrierFromNotes(device) {
        if (!device.device_notes) {
            return device.carrier; // No notes, use original carrier
        }
        
        const upperNotes = device.device_notes.toUpperCase();
        
        // Check for UNLOCKED status
        if (upperNotes.includes('CARRIER UNLOCKED') || upperNotes.includes('UNLOCKED')) {
            return 'UNLOCKED';
        }
        
        // Check for LOCKED status
        if (upperNotes.includes('CARRIER LOCKED') || upperNotes.includes('LOCKED')) {
            return device.carrier; // Keep original carrier (locked to that carrier)
        }
        
        // Check for specific carrier mentions in notes
        if (upperNotes.includes('T-MOBILE') || upperNotes.includes('TMO')) {
            return 'T-MOBILE';
        }
        if (upperNotes.includes('VERIZON') || upperNotes.includes('VG')) {
            return 'VERIZON';
        }
        if (upperNotes.includes('AT&T') || upperNotes.includes('ATT')) {
            return 'AT&T';
        }
        
        // Default: use original carrier
        return device.carrier;
    }

    /**
     * Parse carrier status from device notes with typo tolerance
     * Only focuses on CARRIER, LOCK, LOCKED, UNLOCKED keywords
     * Allows 1-2 character typos but prevents ambiguous cases
     */
    parseCarrierStatusWithTypoTolerance(deviceNotes) {
        if (!deviceNotes) {
            return { isExplicitlyLocked: false, isExplicitlyUnlocked: false };
        }
        
        const notes = deviceNotes.toUpperCase();
        
        // Look for "CARRIER" keyword first - must be present
        if (!notes.includes('CARRIER')) {
            return { isExplicitlyLocked: false, isExplicitlyUnlocked: false };
        }
        
        // Extract the part after "CARRIER" and before any other major words
        const carrierPart = notes.split('CARRIER')[1]?.trim() || '';
        
        // Split by common separators to get individual words
        const words = carrierPart.split(/[\s,;.-]+/).filter(word => word.length > 0);
        
        // Check each word for LOCK/UNLOCK variations
        let isUnlocked = false;
        let isLocked = false;
        
        for (const word of words) {
            // Skip very short words that are likely ambiguous
            if (word.length < 3) continue;
            
            // Check for UNLOCK variations (must start with "UN")
            if (word.startsWith('UN')) {
                if (this.isUnlockVariation(word)) {
                    isUnlocked = true;
                    break; // Found UNLOCK, stop checking
                }
            }
            // Check for LOCK variations (must NOT start with "UN")
            else if (this.isLockVariation(word)) {
                isLocked = true;
                break; // Found LOCK, stop checking
            }
        }
        
        // Check for specific ambiguous patterns that should be flagged
        // Only flag patterns that are truly ambiguous (not part of valid words)
        const ambiguousPatterns = ['NLOC', 'LOKC'];
        const hasAmbiguousPattern = ambiguousPatterns.some(pattern => {
            // Only flag if the pattern appears as a standalone word, not as part of a larger word
            const words = carrierPart.split(/[\s,;.-]+/);
            return words.some(word => word === pattern);
        });
        
        if (hasAmbiguousPattern) {
            console.log(`⚠️  Ambiguous carrier status: "${deviceNotes}" - unclear pattern detected`);
            return { isExplicitlyLocked: false, isExplicitlyUnlocked: false };
        }
        
        // Prevent ambiguous cases - if both could match, mark as ambiguous
        if (isLocked && isUnlocked) {
            console.log(`⚠️  Ambiguous carrier status: "${deviceNotes}" - could be LOCK or UNLOCK`);
            return { isExplicitlyLocked: false, isExplicitlyUnlocked: false };
        }
        
        return {
            isExplicitlyLocked: isLocked,
            isExplicitlyUnlocked: isUnlocked
        };
    }
    
    /**
     * Check if a word is an UNLOCK variation (with typo tolerance)
     * Must be close enough to be clearly UNLOCK
     */
    isUnlockVariation(word) {
        // Must start with "UN" and be close to UNLOCK
        if (!word.startsWith('UN')) return false;
        
        const unlockVariations = [
            'UNLOCKED', 'UNLOCK', 'UNLOKED', 'UNLCKED', 'UNLOK', 'UNLCK', 'UNLOKD', 'UNLC'
        ];
        
        // Check if word matches any variation (exact or close match)
        return unlockVariations.some(variation => {
            // Exact match
            if (word === variation) return true;
            
            // Close match - allow 1-2 character differences
            const distance = this.calculateEditDistance(word, variation);
            return distance <= 2 && word.length >= 4; // Must be at least 4 chars to be meaningful
        });
    }
    
    /**
     * Check if a word is a LOCK variation (with typo tolerance)
     * Must be close enough to be clearly LOCK
     */
    isLockVariation(word) {
        // Must NOT start with "UN" and be close to LOCK
        if (word.startsWith('UN')) return false;
        
        const lockVariations = [
            'LOCKED', 'LOCK', 'LOKED', 'LOK', 'LCKED', 'LCK'
        ];
        
        // Check if word matches any variation (exact or close match)
        return lockVariations.some(variation => {
            // Exact match
            if (word === variation) return true;
            
            // Close match - allow 1-2 character differences
            const distance = this.calculateEditDistance(word, variation);
            return distance <= 2 && word.length >= 3; // Must be at least 3 chars to be meaningful
        });
    }
    
    /**
     * Calculate edit distance between two strings (Levenshtein distance)
     */
    calculateEditDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }
    
    /**
     * Generate typo variations for a word (1-2 character differences)
     * This helps catch common typos while preventing ambiguous matches
     */
    generateTypoVariations(word, maxChanges = 2) {
        const variations = new Set([word]); // Always include the exact word
        
        // Single character substitutions
        for (let i = 0; i < word.length; i++) {
            for (let j = 0; j < 26; j++) {
                const char = String.fromCharCode(65 + j); // A-Z
                if (char !== word[i]) {
                    const variation = word.substring(0, i) + char + word.substring(i + 1);
                    variations.add(variation);
                }
            }
        }
        
        // Single character deletions
        for (let i = 0; i < word.length; i++) {
            const variation = word.substring(0, i) + word.substring(i + 1);
            variations.add(variation);
        }
        
        // Single character insertions
        for (let i = 0; i <= word.length; i++) {
            for (let j = 0; j < 26; j++) {
                const char = String.fromCharCode(65 + j); // A-Z
                const variation = word.substring(0, i) + char + word.substring(i);
                variations.add(variation);
            }
        }
        
        // If maxChanges > 1, add double variations (but be more selective)
        if (maxChanges > 1) {
            const singleVariations = Array.from(variations);
            
            // Only add double variations for common typos
            const commonTypos = {
                'UNLOCK': ['UNLOKED', 'UNLCKED', 'UNLOK', 'UNLCK', 'UNLOKD'],
                'LOCK': ['LOK', 'LCK', 'LOKD', 'LCKD', 'LOKED', 'LCKED']
            };
            
            if (commonTypos[word]) {
                commonTypos[word].forEach(typo => variations.add(typo));
            }
        }
        
        return Array.from(variations);
    }

    /**
     * Get filtered SKUs based on device characteristics and postfix filtering
     * @param {Object} device - Device characteristics for smart filtering
     * @param {boolean} filterPostfix - Whether to filter out SKUs with postfix
     * @returns {Array} Filtered SKUs
     */
    async getFilteredSkus(device, filterPostfix) {
        // Smart filtering: Start with most specific characteristics
        const normalizedModel = this.normalizeModel(device.model);
        const normalizedCapacity = this.normalizeCapacity(device.capacity);
        const normalizedColor = this.normalizeColor(device.color);
        
            // Check carrier status from device_notes with typo tolerance
    const deviceNotes = device.device_notes ? device.device_notes.toUpperCase() : '';
    const { isExplicitlyLocked, isExplicitlyUnlocked } = this.parseCarrierStatusWithTypoTolerance(deviceNotes);
        
        // Determine carrier status and attention requirement
        let isCarrierLocked;
        let requiresAttention = false;
        
        if (isExplicitlyLocked) {
            isCarrierLocked = true;
        } else if (isExplicitlyUnlocked) {
            isCarrierLocked = false;
        } else if (device.carrier && device.carrier.toUpperCase() === 'UNLOCKED') {
            // SPECIAL CASE: Carrier is "UNLOCKED" with no device_notes
            // Treat as UNLOCKED (not ambiguous)
            isCarrierLocked = false;
        } else {
            // AMBIGUOUS CASE: No explicit carrier status and carrier is not "UNLOCKED"
            // Default to LOCKED (conservative approach) but flag for attention
            isCarrierLocked = true;
            requiresAttention = true;
        }
        
        let query = `
            SELECT id, sku_code, sku_tags, brand, model, capacity, color, carrier, post_fix
            FROM sku_master 
            WHERE sku_tags IS NOT NULL AND array_length(sku_tags, 1) > 0
        `;
        
        // Step 1: Filter by MODEL (most restrictive)
        if (normalizedModel) {
            query += ` AND '${normalizedModel}' = ANY(sku_tags)`;
        }
        
        // Step 2: Filter by CAPACITY (if available)
        if (normalizedCapacity) {
            query += ` AND '${normalizedCapacity}' = ANY(sku_tags)`;
        }
        
        // Step 3: Filter by COLOR (if available)
        if (normalizedColor) {
            query += ` AND '${normalizedColor}' = ANY(sku_tags)`;
        }
        
        // Step 4: CARRIER LOCKED LOGIC - Prioritize SKUs with carrier tags
        if (isCarrierLocked) {
            // For carrier locked devices, prioritize SKUs WITH carrier tags
            query += ` AND (
                sku_code LIKE '%-ATT' OR 
                sku_code LIKE '%-TMO' OR 
                sku_code LIKE '%-VRZ' OR
                sku_code LIKE '%-VZ' OR
                sku_code LIKE '%-XFI' OR
                sku_code LIKE '%-XFINITY' OR
                sku_code LIKE '%-SPECTRUM' OR
                sku_code LIKE '%-SPRINT' OR
                sku_code LIKE '%-TRACFONE'
            )`;
        } else {
            // For unlocked devices, prioritize SKUs WITHOUT carrier tags
            query += ` AND (
                sku_code NOT LIKE '%-ATT' AND 
                sku_code NOT LIKE '%-TMO' AND 
                sku_code NOT LIKE '%-VRZ' AND
                sku_code NOT LIKE '%-VZ' AND
                sku_code NOT LIKE '%-XFI' AND
                sku_code NOT LIKE '%-XFINITY' AND
                sku_code NOT LIKE '%-SPECTRUM' AND
                sku_code NOT LIKE '%-SPRINT' AND
                sku_code NOT LIKE '%-TRACFONE'
            )`;
        }
        
        // Step 5: Filter by POSTFIX (if requested)
        if (filterPostfix) {
            // Filter out SKUs with postfix (for bulk processing)
            query += `
                AND sku_code NOT LIKE '%-VG'
                AND sku_code NOT LIKE '%-UV'
                AND sku_code NOT LIKE '%-ACCEPTABLE'
                AND sku_code NOT LIKE '%-UL'
                AND sku_code NOT LIKE '%-LN'
                AND sku_code NOT LIKE '%-NEW'
            `;
        }
        
        query += ` ORDER BY id`;
        
        const result = await this.client.query(query);
        return {
            skus: result.rows,
            requiresAttention: requiresAttention
        };
    }

    /**
     * Calculate match score between device and SKU tags
     * @param {Object} device - Normalized device data
     * @param {Array} skuTags - SKU tags array
     * @returns {Object} Match result with score and details
     */
    calculateMatchScore(device, skuTags) {
        let score = 0;
        let method = 'none';
        let matchedCharacteristics = [];
        let tiebreakerScore = 0;
        let tiebreakerDetails = [];
        
        // Normalize device data
        const normalizedModel = this.normalizeModel(device.model);
        const normalizedCapacity = this.normalizeCapacity(device.capacity);
        const normalizedColor = this.normalizeColor(device.color);
        const normalizedCarrier = this.normalizeCarrier(device.carrier);
        
        // Check MODEL match (highest priority)
        if (normalizedModel && skuTags.includes(normalizedModel)) {
            score += 30;
            matchedCharacteristics.push(`MODEL: ${normalizedModel}`);
            method = 'exact';
        }
        
        // Check CAPACITY match
        if (normalizedCapacity && skuTags.includes(normalizedCapacity)) {
            score += 25;
            matchedCharacteristics.push(`CAPACITY: ${normalizedCapacity}`);
        }
        
        // Check COLOR match
        if (normalizedColor && skuTags.includes(normalizedColor)) {
            score += 20;
            matchedCharacteristics.push(`COLOR: ${normalizedColor}`);
        }
        
        // Check CARRIER match (using corrected carrier from device_notes)
        if (normalizedCarrier && skuTags.includes(normalizedCarrier)) {
            score += 15;
            matchedCharacteristics.push(`CARRIER: ${normalizedCarrier}`);
        }
        
        // Check device_notes for additional context
        if (device.device_notes) {
            const notesScore = this.calculateNotesScore(device.device_notes, skuTags);
            if (notesScore > 0) {
                score += notesScore;
                matchedCharacteristics.push(`NOTES: +${notesScore} points`);
            }
        }
        
        // 🆕 TIEBREAKER SYSTEM: Secondary scoring for SKUs with same primary score
        tiebreakerScore = this.calculateTiebreakerScore(device, skuTags, tiebreakerDetails);
        
        return {
            score,                    // Primary score (0-100)
            tiebreakerScore,          // 🆕 Secondary score (0-20)
            totalScore: score + tiebreakerScore, // 🆕 Combined score (0-120)
            method,
            matchedCharacteristics,
            tiebreakerDetails,        // 🆕 Details about tiebreaker scoring
            totalCharacteristics: Object.keys(device).filter(key => device[key]).length
        };
    }

    /**
     * 🆕 Calculate tiebreaker score to differentiate between SKUs with same primary score
     * @param {Object} device - Normalized device data
     * @param {Array} skuTags - SKU tags array
     * @param {Array} tiebreakerDetails - Array to store tiebreaker details
     * @returns {number} Tiebreaker score (0-10 points)
     */
    calculateTiebreakerScore(device, skuTags, tiebreakerDetails) {
        let tiebreakerScore = 0;
        
        // 1. POSTFIX MATCHING (5 points)
        // Check if device has postfix and SKU matches it
        if (device.postfix && skuTags.includes(device.postfix)) {
            tiebreakerScore += 5;
            tiebreakerDetails.push(`POSTFIX: ${device.postfix} match (+5)`);
        }
        
        // 2. EXACT CHARACTERISTIC MATCHES (5 points)
        // Bonus for SKUs that match more characteristics exactly
        const exactMatches = this.countExactMatches(device, skuTags);
        if (exactMatches >= 4) {
            tiebreakerScore += 5;
            tiebreakerDetails.push(`EXACT: ${exactMatches}/4 characteristics (+5)`);
        } else if (exactMatches >= 3) {
            tiebreakerScore += 3;
            tiebreakerDetails.push(`EXACT: ${exactMatches}/4 characteristics (+3)`);
        } else if (exactMatches >= 2) {
            tiebreakerScore += 1;
            tiebreakerDetails.push(`EXACT: ${exactMatches}/4 characteristics (+1)`);
        }
        
        return Math.min(tiebreakerScore, 10); // Cap at 10 points
    }

    /**
     * Helper: Check if SKU has carrier postfix
     */
    hasCarrierPostfix(skuTags) {
        const carrierPostfixes = ['TMO', 'ATT', 'VG', 'VRZ', 'SPECTRUM'];
        return skuTags.some(tag => carrierPostfixes.includes(tag));
    }

    /**
     * Helper: Get POSTFIX grade from SKU tags
     */
    getPostfixGrade(skuTags) {
        const postfixGradeMap = {
            'VG': 'Grade B',
            'UV': 'Grade B', 
            'ACCEPTABLE': 'Grade C',
            'UL': 'Grade A',
            'LN': 'Grade A',
            'NEW': 'New'
        };
        
        for (const tag of skuTags) {
            if (postfixGradeMap[tag]) {
                return postfixGradeMap[tag];
            }
        }
        return 'Grade A'; // Default: no postfix = Grade A
    }

    /**
     * Helper: Get SKU code from tags (for segment counting)
     */
    getSkuCodeFromTags(skuTags) {
        // This would need to be implemented based on your SKU structure
        // For now, return a placeholder
        return skuTags.join('-');
    }

    /**
     * Helper: Count exact matches between device and SKU tags
     */
    countExactMatches(device, skuTags) {
        let count = 0;
        
        const normalizedModel = this.normalizeModel(device.model);
        const normalizedCapacity = this.normalizeCapacity(device.capacity);
        const normalizedColor = this.normalizeColor(device.color);
        const normalizedCarrier = this.normalizeCarrier(device.carrier);
        
        if (normalizedModel && skuTags.includes(normalizedModel)) count++;
        if (normalizedCapacity && skuTags.includes(normalizedCapacity)) count++;
        if (normalizedColor && skuTags.includes(normalizedColor)) count++;
        if (normalizedCarrier && skuTags.includes(normalizedCarrier)) count++;
        
        return count;
    }

    // Normalization methods
    normalizeModel(model) {
        if (!model) return null;
        const upper = model.toUpperCase();
        
        if (upper.includes('GALAXY') && upper.includes('FOLD3')) return 'FOLD3';
        if (upper.includes('FOLD3')) return 'FOLD3';
        
        return upper;
    }

    normalizeCapacity(capacity) {
        if (!capacity) return null;
        return capacity.replace(/GB$/i, '');
    }

    normalizeColor(color) {
        if (!color) return null;
        const upper = color.toUpperCase();
        
        if (upper.includes('PHANTOM') && upper.includes('BLACK')) return 'BLK';
        if (upper.includes('PHANTOM') && upper.includes('GREEN')) return 'GREEN';  // Fixed: GREEN not GRN
        if (upper.includes('PHANTOM') && upper.includes('SILVER')) return 'SLV';
        
        return upper;
    }

    normalizeCarrier(carrier) {
        if (!carrier) return null;
        const upper = carrier.toUpperCase();
        
        if (upper === 'T-MOBILE') return 'TMO';
        if (upper === 'VERIZON') return 'VG';
        if (upper === 'AT&T') return 'ATT';
        if (upper === 'UNLOCKED') return 'UNL';
        if (upper === 'LOCKED') return 'LKD';
        
        return upper;
    }

    /**
     * Calculate additional score from device_notes
     * @param {string} notes - Device notes
     * @param {Array} skuTags - SKU tags
     * @returns {number} Additional score
     */
    calculateNotesScore(notes, skuTags) {
        if (!notes || !skuTags) return 0;
        
        let score = 0;
        const upperNotes = notes.toUpperCase();
        const tokens = upperNotes.split(/[\s,.-]+/).filter(token => token.length > 2);
        
        for (const token of tokens) {
            if (skuTags.includes(token)) {
                score += 5;
            }
            
            // Check abbreviations
            if (token === 'SLV' && skuTags.includes('SILVER')) score += 5;
            if (token === 'BLK' && skuTags.includes('BLACK')) score += 5;
            if (token === 'GRN' && skuTags.includes('GREEN')) score += 5;
            if (token === 'TMO' && skuTags.includes('T-MOBILE')) score += 5;
            if (token === 'VG' && skuTags.includes('VERIZON')) score += 5;
            if (token === 'ATT' && skuTags.includes('AT&T')) score += 5;
            if (token === 'UNLOCKED' && skuTags.includes('UNLOCKED')) score += 5;
            if (token === 'LOCKED' && skuTags.includes('LOCKED')) score += 5;
        }
        
        return Math.min(score, 25); // Cap at 25 points
    }

    /**
     * Decode POSTFIX meaning for a SKU
     * @param {string} skuCode - SKU code
     * @returns {Object|null} POSTFIX information
     */
    decodePostfix(skuCode) {
        const parts = skuCode.split('-');
        if (parts.length < 4) return null; // No postfix
        
        const postfix = parts[parts.length - 1];
        return this.postfixMappings.get(postfix) || { 
            grade: 'Unknown', 
            condition: `Postfix: ${postfix}` 
        };
    }

    /**
     * Get matching statistics
     * @returns {Object} Statistics object
     */
    async getMatchingStats() {
        try {
            const totalSkus = await this.client.query('SELECT COUNT(*) FROM sku_master WHERE sku_tags IS NOT NULL');
            const totalTags = await this.client.query('SELECT COUNT(*) FROM sku_tags');
            
            return {
                totalSkus: parseInt(totalSkus.rows[0].count),
                totalTags: parseInt(totalTags.rows[0].count),
                serviceStatus: 'active'
            };
        } catch (error) {
            console.error('❌ Failed to get stats:', error);
            return { error: error.message };
        }
    }

    /**
     * Close the service and release resources
     */
    async close() {
        if (this.client) {
            this.client.release();
        }
    }
}

module.exports = CompleteSkuMatchingService;
