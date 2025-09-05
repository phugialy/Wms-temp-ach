import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

interface ImeiData {
  imei: string;
  model?: string;
  capacity?: string;
  color?: string;
  carrier?: string;
  brand?: string;
  original_sku?: string;
}

interface SkuMatchResult {
  skuCode: string;
  score: number;
  matchedFields: string[];
  deviceType: string;
  postFix?: string;
  skuTags: string[];
  reason: string;
}

interface MatchingOptions {
  filterPostfix?: boolean;
  minScore?: number;
  maxResults?: number;
}

interface AbbreviationMapping {
  abbreviation: string;
  full_value: string;
  category: string;
}

interface PostfixMapping {
  grade: string;
  condition: string;
}

export class CompleteSkuMatchingService {
  private client: PoolClient | null = null;
  private abbreviationMappings: Map<string, string> = new Map();
  private modelMappings: Map<string, string> = new Map();
  private carrierMappings: Map<string, string> = new Map();
  private colorMappings: Map<string, string> = new Map();
  private postfixMappings: Map<string, PostfixMapping> = new Map();

  async initialize(): Promise<void> {
    try {
      const pool = new Pool({
        connectionString: process.env['DIRECT_URL'],
        max: 1,
        idleTimeoutMillis: 0,
        connectionTimeoutMillis: 30000,
      });
      
      this.client = await pool.connect();
      
      // Load abbreviation mappings
      await this.loadAbbreviations();
      
      // Initialize smart mappings for your real data
      this.initializeSmartMappings();
      
      logger.info('✅ Complete SKU Matching Service initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Complete SKU Matching Service:', error);
      throw error;
    }
  }

  async loadAbbreviations(): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('Database client not initialized');
      }

      const result = await this.client.query(`
        SELECT abbreviation, full_value, category 
        FROM abbreviation_mappings 
        WHERE is_active = true
      `);
      
      this.abbreviationMappings.clear();
      
      result.rows.forEach((row: AbbreviationMapping) => {
        const key = `${row.category}:${row.abbreviation}`;
        this.abbreviationMappings.set(key, row.full_value);
      });
      
      logger.info(`📚 Loaded ${this.abbreviationMappings.size} abbreviation mappings`);
    } catch (error) {
      logger.error('❌ Failed to load abbreviations:', error);
    }
  }

  private initializeSmartMappings(): void {
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
    
    logger.info('🧠 Smart mappings initialized for real IMEI data');
  }

  /**
   * Main method to match IMEI device to SKUs
   * @param imeiData - IMEI device characteristics
   * @param options - Matching options
   * @returns Array of matched SKUs with scores and details
   */
  async matchImeiToSku(imeiData: ImeiData, options: MatchingOptions = {}): Promise<SkuMatchResult[]> {
    const {
      filterPostfix = true, // Default: filter out postfix SKUs for bulk processing
      minScore = 70, // Default: only high-quality matches
      maxResults = 10 // Default: top 10 results
    } = options;

    try {
      if (!this.client) {
        throw new Error('Database client not initialized');
      }

      logger.info(`🔍 Matching IMEI device: ${JSON.stringify(imeiData)}`);
      logger.info(`⚙️  Options: filterPostfix=${filterPostfix}, minScore=${minScore}, maxResults=${maxResults}`);
      
      // CORRECT: Parse device_notes to determine actual carrier status
      const actualCarrier = this.parseCarrierFromNotes(imeiData);
      logger.info(`📝 device_notes OVERRIDE: carrier "${imeiData.carrier}" → "${actualCarrier}"`);
      
      // Create corrected device with proper carrier
      const correctedDevice = {
        ...imeiData,
        carrier: actualCarrier
      };
      
      // Get SKUs based on filtering options (smart filtering by device characteristics)
      const { skus, requiresAttention } = await this.getFilteredSkus(correctedDevice, filterPostfix);
      logger.info(`📋 Found ${skus.length} SKUs after smart filtering`);
      
      if (requiresAttention) {
        logger.info(`⚠️  ATTENTION REQUIRED: Ambiguous carrier status - no explicit lock/unlock indication`);
      }
      
      // Calculate matches
      const matches: SkuMatchResult[] = [];
      
      for (const sku of skus) {
        const matchResult = this.calculateMatchScore(correctedDevice, sku.sku_tags);
        
        if (matchResult.totalScore >= minScore) {
          matches.push({
            skuCode: sku.sku_code,
            score: matchResult.score,
            matchedFields: matchResult.matchedCharacteristics,
            deviceType: sku.device_type,
            postFix: sku.post_fix,
            skuTags: sku.sku_tags || [],
            reason: `Matched on: ${matchResult.matchedCharacteristics.join(', ')} (Score: ${matchResult.totalScore})`
          });
        }
      }
      
      // Sort by TOTAL score (primary + tiebreaker) for better ranking
      matches.sort((a, b) => b.score - a.score);
      const limitedMatches = matches.slice(0, maxResults);
      
      logger.info(`📊 Found ${matches.length} matches (showing top ${limitedMatches.length})`);
      
      return limitedMatches;

    } catch (error) {
      logger.error(`❌ Error matching IMEI ${imeiData.imei}:`, error);
      throw error;
    }
  }

  /**
   * CORRECT: Parse device_notes to determine actual carrier status
   * @param device - Device data with device_notes
   * @returns Corrected carrier status
   */
  private parseCarrierFromNotes(device: any): string {
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
  private parseCarrierStatusWithTypoTolerance(deviceNotes: string): { isExplicitlyLocked: boolean, isExplicitlyUnlocked: boolean } {
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
      logger.info(`⚠️  Ambiguous carrier status: "${deviceNotes}" - unclear pattern detected`);
      return { isExplicitlyLocked: false, isExplicitlyUnlocked: false };
    }
    
    // Prevent ambiguous cases - if both could match, mark as ambiguous
    if (isLocked && isUnlocked) {
      logger.info(`⚠️  Ambiguous carrier status: "${deviceNotes}" - could be LOCK or UNLOCK`);
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
  private isUnlockVariation(word: string): boolean {
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
  private isLockVariation(word: string): boolean {
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
  private calculateEditDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
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

  private normalizeDeviceCharacteristics(imeiData: ImeiData): any {
    const normalized: any = {
      imei: imeiData.imei,
      model: this.normalizeModel(imeiData.model || ''),
      capacity: this.normalizeCapacity(imeiData.capacity || ''),
      color: this.normalizeColor(imeiData.color || ''),
      carrier: this.normalizeCarrier(imeiData.carrier || ''),
      brand: this.normalizeBrand(imeiData.brand || ''),
      original_sku: imeiData.original_sku || ''
    };

    logger.debug('📝 Normalized device characteristics:', normalized);
    return normalized;
  }

  /**
   * Get filtered SKUs based on device characteristics and postfix filtering
   * @param device - Device characteristics for smart filtering
   * @param filterPostfix - Whether to filter out SKUs with postfix
   * @returns Filtered SKUs
   */
  public async getFilteredSkus(device: any, filterPostfix: boolean): Promise<{ skus: any[], requiresAttention: boolean }> {
    if (!this.client) {
      throw new Error('Database client not initialized');
    }

    // Break device characteristics into chunks
    const modelChunks = this.breakIntoChunks(device.model || '');
    const capacityChunks = this.breakIntoChunks(device.capacity || '');
    const colorChunks = this.breakIntoChunks(device.color || '');
    const carrierChunks = this.breakIntoChunks(device.carrier || '');
    const brandChunks = this.breakIntoChunks(device.brand || '');
    
    // Combine all chunks
    const allDeviceChunks = [...modelChunks, ...capacityChunks, ...colorChunks, ...carrierChunks, ...brandChunks];
    
    logger.info(`🔍 CHUNK-BASED FILTERING DEBUG:`);
    logger.info(`  Model chunks: [${modelChunks.join(', ')}]`);
    logger.info(`  Capacity chunks: [${capacityChunks.join(', ')}]`);
    logger.info(`  Color chunks: [${colorChunks.join(', ')}]`);
    logger.info(`  Carrier chunks: [${carrierChunks.join(', ')}]`);
    logger.info(`  Brand chunks: [${brandChunks.join(', ')}]`);
    logger.info(`  All device chunks: [${allDeviceChunks.join(', ')}]`);
    
    // Get all SKUs and score them
    const query = `
      SELECT id, sku_code, sku_tags, brand, model, capacity, color, carrier, post_fix
      FROM sku_master 
      WHERE sku_tags IS NOT NULL AND array_length(sku_tags, 1) > 0
      ORDER BY id
    `;
    
    const result = await this.client.query(query);
    logger.info(`🔍 Retrieved ${result.rows.length} SKUs for chunk-based scoring`);
    
    // Score each SKU based on chunk overlap
    const scoredSkus = result.rows.map(sku => {
      const score = this.calculateChunkMatchScore(allDeviceChunks, sku.sku_tags);
      return {
        ...sku,
        chunkScore: score
      };
    });
    
    // Filter SKUs with minimum score (e.g., at least 20% match)
    const minScore = 20; // 20% of chunks must match
    const filteredSkus = scoredSkus.filter(sku => sku.chunkScore >= minScore);
    
    // Sort by score (highest first)
    filteredSkus.sort((a, b) => b.chunkScore - a.chunkScore);
    
    logger.info(`🔍 Chunk-based filtering: ${filteredSkus.length}/${result.rows.length} SKUs passed minimum score (${minScore}%)`);
    if (filteredSkus.length > 0) {
      logger.info(`🔍 Top scoring SKU: ${filteredSkus[0].sku_code} (${filteredSkus[0].chunkScore.toFixed(1)}%)`);
    }
    
    // Determine if attention is required (carrier uncertainty)
    const deviceNotes = device.device_notes ? device.device_notes.toUpperCase() : '';
    const { isExplicitlyLocked, isExplicitlyUnlocked } = this.parseCarrierStatusWithTypoTolerance(deviceNotes);
    const requiresAttention = !isExplicitlyLocked && !isExplicitlyUnlocked && !device.carrier;
    
    return {
      skus: filteredSkus,
      requiresAttention: requiresAttention
    };
  }

  private normalizeModel(model: string): string {
    if (!model) return '';
    const upper = model.toUpperCase();
    
    if (upper.includes('GALAXY') && upper.includes('FOLD3')) return 'FOLD3';
    if (upper.includes('FOLD3')) return 'FOLD3';
    
    // For S22 Ultra, return the abbreviated format as it appears in SKU tags
    if (upper.includes('GALAXY') && upper.includes('S22') && upper.includes('ULTRA')) {
      return 'S22';  // SKU tags use "S22", not the full model name
    }
    
    // For other Galaxy models, extract the model number (S21, S22, S23, etc.)
    if (upper.includes('GALAXY')) {
      const match = upper.match(/GALAXY\s+(S\d+)/);
      if (match) {
        return match[1]; // Return S21, S22, S23, etc.
      }
    }
    
    return upper;
  }

  private normalizeCapacity(capacity: string): string {
    if (!capacity) return '';
    // Extract just the number as it appears in SKU tags (e.g., "512GB" -> "512")
    const match = capacity.match(/(\d+)/);
    return match ? match[1] : capacity.toUpperCase();
  }

  private normalizeColor(color: string): string {
    if (!color) return '';
    const upper = color.toUpperCase();
    
    if (upper.includes('PHANTOM') && upper.includes('BLACK')) return 'BLK';
    if (upper.includes('PHANTOM') && upper.includes('GREEN')) return 'GREEN';  // Fixed: GREEN not GRN
    if (upper.includes('PHANTOM') && upper.includes('SILVER')) return 'SLV';
    
    // For other colors, return as-is to match SKU tags format
    // But we need to check if there's a match in the SKU tags
    // Looking at the sample, SKU tags have "BLACK", "WHITE", "PINK" but device has "BURGUNDY"
    // So we need to find a SKU that has "BURGUNDY" in the tags
    return upper;
  }

  private normalizeCarrier(carrier: string): string {
    if (!carrier) return '';
    const upper = carrier.toUpperCase();
    
    if (upper === 'T-MOBILE') return 'TMO';
    if (upper === 'VERIZON') return 'VG';
    if (upper === 'AT&T') return 'ATT';
    if (upper === 'UNLOCKED') return 'UNLOCKED';  // Keep as-is to match SKU tags
    if (upper === 'LOCKED') return 'LOCKED';      // Keep as-is to match SKU tags
    
    return upper;
  }

  private normalizeBrand(brand: string): string {
    if (!brand) return '';
    
    let normalized = brand.toUpperCase().trim();
    
    // Apply abbreviation mappings
    normalized = this.applyAbbreviationMappings(normalized, 'brand');
    
    return normalized;
  }

  /**
   * Break device characteristics into chunks for flexible matching
   */
  public breakIntoChunks(text: string): string[] {
    if (!text) return [];
    
    const upper = text.toUpperCase().trim();
    
    // Split by common separators and spaces
    const chunks = upper
      .split(/[\s\-_\.]+/)
      .filter(chunk => chunk.length > 0)
      .map(chunk => chunk.trim());
    
    // Also add some common abbreviations and variations
    const additionalChunks: string[] = [];
    
    // For model names, extract key identifiers
    if (upper.includes('GALAXY')) {
      additionalChunks.push('GALAXY');
      
      // Extract model numbers
      const modelMatch = upper.match(/(S\d+|NOTE\d+|FOLD\d+|FLIP\d+)/);
      if (modelMatch) {
        additionalChunks.push(modelMatch[1]);
      }
      
      // Extract variants
      if (upper.includes('ULTRA')) additionalChunks.push('ULTRA');
      if (upper.includes('PLUS')) additionalChunks.push('PLUS');
      if (upper.includes('PRO')) additionalChunks.push('PRO');
      if (upper.includes('5G')) additionalChunks.push('5G');
      if (upper.includes('DUOS')) additionalChunks.push('DUOS');
    }
    
    // For capacity, extract numbers
    const capacityMatch = upper.match(/(\d+)/);
    if (capacityMatch) {
      additionalChunks.push(capacityMatch[1]);
    }
    
    // For colors, add common variations
    if (upper.includes('BLACK') || upper.includes('PHANTOM BLACK')) {
      additionalChunks.push('BLACK', 'BLK');
    }
    if (upper.includes('WHITE') || upper.includes('PHANTOM WHITE')) {
      additionalChunks.push('WHITE', 'WHT');
    }
    if (upper.includes('GREEN') || upper.includes('PHANTOM GREEN')) {
      additionalChunks.push('GREEN');
    }
    if (upper.includes('SILVER') || upper.includes('PHANTOM SILVER')) {
      additionalChunks.push('SILVER', 'SLV');
    }
    if (upper.includes('PINK')) {
      additionalChunks.push('PINK');
    }
    if (upper.includes('BURGUNDY')) {
      additionalChunks.push('BURGUNDY');
    }
    
    // For carriers, add common variations
    if (upper.includes('VERIZON')) {
      additionalChunks.push('VERIZON', 'VG');
    }
    if (upper.includes('T-MOBILE') || upper.includes('TMOBILE')) {
      additionalChunks.push('T-MOBILE', 'TMO');
    }
    if (upper.includes('AT&T') || upper.includes('ATT')) {
      additionalChunks.push('AT&T', 'ATT');
    }
    if (upper.includes('UNLOCKED')) {
      additionalChunks.push('UNLOCKED');
    }
    if (upper.includes('LOCKED')) {
      additionalChunks.push('LOCKED');
    }
    
    // Combine and deduplicate
    const allChunks = [...chunks, ...additionalChunks];
    return [...new Set(allChunks)].filter(chunk => chunk.length > 0);
  }

  /**
   * Calculate match score based on chunk overlap with SKU tags
   */
  private calculateChunkMatchScore(deviceChunks: string[], skuTags: string[]): number {
    if (!deviceChunks.length || !skuTags.length) return 0;
    
    let matchCount = 0;
    const matchedChunks: string[] = [];
    
    // Count how many device chunks match SKU tags
    for (const chunk of deviceChunks) {
      if (skuTags.includes(chunk)) {
        matchCount++;
        matchedChunks.push(chunk);
      }
    }
    
    // Calculate score as percentage of matches
    const score = (matchCount / deviceChunks.length) * 100;
    
    logger.debug(`🔍 Chunk matching: ${matchCount}/${deviceChunks.length} chunks matched (${score.toFixed(1)}%)`);
    logger.debug(`🔍 Matched chunks: [${matchedChunks.join(', ')}]`);
    logger.debug(`🔍 SKU tags: [${skuTags.join(', ')}]`);
    
    return score;
  }

  private applyAbbreviationMappings(text: string, category: string): string {
    let result = text;
    
    for (const [key, value] of this.abbreviationMappings) {
      if (key.startsWith(`${category}:`)) {
        const abbreviation = key.split(':')[1];
        if (result.includes(abbreviation)) {
          result = result.replace(abbreviation, value);
        }
      }
    }
    
    return result;
  }

  private async getAllSkus(): Promise<any[]> {
    if (!this.client) {
      throw new Error('Database client not initialized');
    }

    const result = await this.client.query(`
      SELECT 
        id,
        sku_code,
        brand,
        model,
        capacity,
        color,
        carrier,
        post_fix,
        model_tag,
        capacity_tag,
        color_tag,
        carrier_tag,
        postfix_tag,
        sku_tags,
        device_type,
        is_active
      FROM sku_master 
      WHERE is_active = true
      ORDER BY id DESC
    `);

    logger.info(`📦 getAllSkus: Found ${result.rows.length} SKUs in database`);
    return result.rows;
  }

  private async scoreSkusAgainstDevice(device: any, skus: any[], filterPostfix: boolean): Promise<SkuMatchResult[]> {
    const scoredSkus: SkuMatchResult[] = [];

    logger.info(`🔍 Scoring ${skus.length} SKUs against device: ${device.imei}`);

    for (const sku of skus) {
      try {
        // Filter out SKUs with postfix if requested
        if (filterPostfix && sku.post_fix) {
          logger.debug(`⏭️ Skipping SKU ${sku.sku_code} - has postfix: ${sku.post_fix}`);
          continue;
        }

        const score = this.calculateMatchScore(device, sku);
        
        logger.info(`📊 SKU ${sku.sku_code}: score=${score}, tags=${JSON.stringify(sku.sku_tags)}`);
        
        if (score > 0) {
          scoredSkus.push({
            skuCode: sku.sku_code,
            score: score,
            matchedFields: this.getMatchedFields(device, sku),
            deviceType: sku.device_type,
            postFix: sku.post_fix,
            skuTags: sku.sku_tags || [],
            reason: this.generateMatchReason(device, sku, score)
          });
        }
      } catch (error) {
        logger.error(`Error scoring SKU ${sku.sku_code}:`, error);
      }
    }

    logger.info(`📋 Found ${scoredSkus.length} SKUs with scores > 0`);
    logger.info(`📊 Total SKUs processed: ${allSkus.length}, Scored SKUs: ${scoredSkus.length}`);
    return scoredSkus;
  }

  /**
   * Calculate match score between device and SKU tags (NEW TAG-BASED LOGIC)
   * @param device - Normalized device data
   * @param skuTags - SKU tags array
   * @returns Match result with score and details
   */
  private calculateMatchScore(device: any, skuTags: string[]): { score: number, totalScore: number, matchedCharacteristics: string[] } {
    // Break device characteristics into chunks
    const modelChunks = this.breakIntoChunks(device.model || '');
    const capacityChunks = this.breakIntoChunks(device.capacity || '');
    const colorChunks = this.breakIntoChunks(device.color || '');
    const carrierChunks = this.breakIntoChunks(device.carrier || '');
    const brandChunks = this.breakIntoChunks(device.brand || '');
    
    // Combine all chunks
    const allDeviceChunks = [...modelChunks, ...capacityChunks, ...colorChunks, ...carrierChunks, ...brandChunks];
    
    // Calculate chunk-based score
    const chunkScore = this.calculateChunkMatchScore(allDeviceChunks, skuTags);
    
    // Weight the score based on importance of characteristics
    let weightedScore = 0;
    const matchedCharacteristics: string[] = [];
    
    // Model chunks (highest weight)
    const modelMatches = modelChunks.filter(chunk => skuTags.includes(chunk));
    if (modelMatches.length > 0) {
      weightedScore += (modelMatches.length / modelChunks.length) * 40;
      matchedCharacteristics.push(`MODEL: [${modelMatches.join(', ')}]`);
    }
    
    // Capacity chunks
    const capacityMatches = capacityChunks.filter(chunk => skuTags.includes(chunk));
    if (capacityMatches.length > 0) {
      weightedScore += (capacityMatches.length / capacityChunks.length) * 30;
      matchedCharacteristics.push(`CAPACITY: [${capacityMatches.join(', ')}]`);
    }
    
    // Color chunks
    const colorMatches = colorChunks.filter(chunk => skuTags.includes(chunk));
    if (colorMatches.length > 0) {
      weightedScore += (colorMatches.length / colorChunks.length) * 20;
      matchedCharacteristics.push(`COLOR: [${colorMatches.join(', ')}]`);
    }
    
    // Carrier chunks
    const carrierMatches = carrierChunks.filter(chunk => skuTags.includes(chunk));
    if (carrierMatches.length > 0) {
      weightedScore += (carrierMatches.length / carrierChunks.length) * 10;
      matchedCharacteristics.push(`CARRIER: [${carrierMatches.join(', ')}]`);
    }
    
    // Use the higher of chunk score or weighted score
    const finalScore = Math.max(chunkScore, weightedScore);
    
    // Add notes score if available
    let notesScore = 0;
    if (device.device_notes) {
      notesScore = this.calculateNotesScore(device.device_notes, skuTags);
      if (notesScore > 0) {
        matchedCharacteristics.push(`NOTES: +${notesScore} points`);
      }
    }
    
    const totalScore = finalScore + notesScore;
    
    return {
      score: finalScore,                    // Primary score (0-100)
      totalScore: totalScore, // Combined score (0-120)
      matchedCharacteristics
    };
  }

  /**
   * Calculate tiebreaker score to differentiate between SKUs with same primary score
   * @param device - Normalized device data
   * @param skuTags - SKU tags array
   * @param tiebreakerDetails - Array to store tiebreaker details
   * @returns Tiebreaker score (0-10 points)
   */
  private calculateTiebreakerScore(device: any, skuTags: string[], tiebreakerDetails: string[]): number {
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
   * Helper: Count exact matches between device and SKU tags
   */
  private countExactMatches(device: any, skuTags: string[]): number {
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

  /**
   * Calculate additional score from device_notes
   * @param notes - Device notes
   * @param skuTags - SKU tags
   * @returns Additional score
   */
  private calculateNotesScore(notes: string, skuTags: string[]): number {
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

  // OLD METHOD - KEEP FOR BACKWARD COMPATIBILITY
  private calculateMatchScoreOld(device: any, sku: any): number {
    let score = 0;

    // Debug logging
    logger.debug(`🔍 Calculating score for device vs SKU ${sku.sku_code}`);

    // Use both direct columns AND tag columns for comprehensive matching
    
    // Brand matching (highest weight)
    if (device.brand) {
      const deviceBrand = device.brand.toUpperCase();
      
      // Check direct brand column
      if (sku.brand && deviceBrand === sku.brand.toUpperCase()) {
        score += 30;
        // Debug: Only log for S22 SKUs to avoid spam
        if (sku.sku_code.includes('S22')) {
          logger.info(`✅ Brand match: "${device.brand}" = "${sku.brand}" (+30 points, total: ${score})`);
        }
      } else if (sku.sku_code.includes('S22')) {
        logger.info(`❌ Brand mismatch: device="${device.brand}" (${typeof device.brand}) vs sku="${sku.brand}" (${typeof sku.brand})`);
        logger.info(`❌ Brand comparison: "${deviceBrand}" === "${sku.brand?.toUpperCase()}" = ${deviceBrand === sku.brand?.toUpperCase()}`);
      }
      // ALSO check sku_tags array (not else if!)
      if (sku.sku_tags && Array.isArray(sku.sku_tags)) {
        const hasBrandMatch = sku.sku_tags.some((tag: string) => 
          tag.toUpperCase().includes(deviceBrand)
        );
        if (hasBrandMatch) score += 25;
      }
    }

    // Model matching (highest weight)
    if (device.model) {
      const deviceModel = device.model.toUpperCase();
      
      // Check direct model column
      if (sku.model && deviceModel === sku.model.toUpperCase()) {
        score += 40;
      }
      // ALSO check model_tag column
      if (sku.model_tag && deviceModel.includes(sku.model_tag.toUpperCase())) {
        score += 35;
      }
      // ALSO check sku_tags array
      if (sku.sku_tags && Array.isArray(sku.sku_tags)) {
        const hasModelMatch = sku.sku_tags.some((tag: string) => 
          tag.toUpperCase().includes(deviceModel) || deviceModel.includes(tag.toUpperCase())
        );
        if (hasModelMatch) score += 30;
      }
    }

    // Capacity matching
    if (device.capacity) {
      const deviceCapacity = device.capacity.toUpperCase();
      
      // Check direct capacity column
      if (sku.capacity && deviceCapacity === sku.capacity.toUpperCase()) {
        score += 25;
      }
      // ALSO check capacity_tag column
      if (sku.capacity_tag && deviceCapacity.includes(sku.capacity_tag.toUpperCase())) {
        score += 20;
      }
      // ALSO check sku_tags array
      if (sku.sku_tags && Array.isArray(sku.sku_tags)) {
        const hasCapacityMatch = sku.sku_tags.some((tag: string) => 
          tag.toUpperCase().includes(deviceCapacity)
        );
        if (hasCapacityMatch) score += 15;
      }
    }

    // Color matching
    if (device.color) {
      const deviceColor = device.color.toUpperCase();
      
      // Check direct color column
      if (sku.color && deviceColor === sku.color.toUpperCase()) {
        score += 20;
      }
      // ALSO check color_tag column
      if (sku.color_tag && deviceColor.includes(sku.color_tag.toUpperCase())) {
        score += 15;
      }
      // ALSO check sku_tags array
      if (sku.sku_tags && Array.isArray(sku.sku_tags)) {
        const hasColorMatch = sku.sku_tags.some((tag: string) => 
          tag.toUpperCase().includes(deviceColor)
        );
        if (hasColorMatch) score += 10;
      }
    }

    // Carrier matching
    if (device.carrier) {
      const deviceCarrier = device.carrier.toUpperCase();
      
      // Check direct carrier column
      if (sku.carrier && deviceCarrier === sku.carrier.toUpperCase()) {
        score += 15;
      }
      // ALSO check carrier_tag column
      if (sku.carrier_tag && deviceCarrier.includes(sku.carrier_tag.toUpperCase())) {
        score += 12;
      }
      // ALSO check sku_tags array
      if (sku.sku_tags && Array.isArray(sku.sku_tags)) {
        const hasCarrierMatch = sku.sku_tags.some((tag: string) => 
          tag.toUpperCase().includes(deviceCarrier)
        );
        if (hasCarrierMatch) score += 8;
      }
    }

    const finalScore = Math.round(score);
    return finalScore;
  }

  private getMatchedFields(device: any, sku: any): string[] {
    const matchedFields: string[] = [];

    // Check which fields matched based on the scoring logic
    if (device.brand && sku.brand && device.brand.toUpperCase() === sku.brand.toUpperCase()) {
      matchedFields.push('brand');
    }

    if (device.model && sku.model && device.model.toUpperCase() === sku.model.toUpperCase()) {
      matchedFields.push('model');
    }

    if (device.capacity && sku.capacity && device.capacity.toUpperCase() === sku.capacity.toUpperCase()) {
      matchedFields.push('capacity');
    }

    if (device.color && sku.color && device.color.toUpperCase() === sku.color.toUpperCase()) {
      matchedFields.push('color');
    }

    if (device.carrier && sku.carrier && device.carrier.toUpperCase() === sku.carrier.toUpperCase()) {
      matchedFields.push('carrier');
    }

    return matchedFields;
  }

  private generateMatchReason(device: any, sku: any, score: number): string {
    const matchedFields = this.getMatchedFields(device, sku);
    
    if (matchedFields.length === 0) {
      return 'No specific field matches found';
    }

    return `Matched on: ${matchedFields.join(', ')} (Score: ${score})`;
  }

  async getMatchingStats(): Promise<any> {
    try {
      if (!this.client) {
        throw new Error('Database client not initialized');
      }

      const result = await this.client.query(`
        SELECT 
          COUNT(*) as total_skus,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_skus,
          COUNT(CASE WHEN post_fix IS NOT NULL THEN 1 END) as skus_with_postfix
        FROM sku_master
      `);

      return result.rows[0];
    } catch (error) {
      logger.error('❌ Error getting matching stats:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.release();
      this.client = null;
      logger.info('🔌 SKU Matching Service connection closed');
    }
  }
}

export default CompleteSkuMatchingService;
