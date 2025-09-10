import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

interface ImeiData {
  imei: string;
  brand: string;
  model: string;
  capacity: string;
  color: string;
  carrier: string;
  device_notes?: string;
}

interface MatchResult {
  matches: any[];
  requiresAttention: boolean;
  totalMatches: number;
  highestScore: number;
  matchType: string;
  processingTime: number;
  isUndefined: boolean;
  undefinedReason?: string | null;
}

export class HybridSkuMatchingService {
  private pool!: Pool;
  private client: PoolClient | null = null;

  async initialize(): Promise<void> {
    try {
      this.pool = new Pool({
        connectionString: process.env['DIRECT_URL'],
        ssl: { rejectUnauthorized: false },
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      });
      
      this.client = await this.pool.connect();
      logger.info('✅ Hybrid SKU Matching Service initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Hybrid SKU Matching Service:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.client) {
        this.client.release();
        this.client = null;
      }
      if (this.pool) {
        await this.pool.end();
      }
      logger.info('✅ Hybrid SKU Matching Service cleaned up');
    } catch (error) {
      logger.error('❌ Error cleaning up Hybrid SKU Matching Service:', error);
    }
  }

  private classifyAsUndefined(imeiData: ImeiData, matches: any[]): boolean {
    if (matches.length === 0) return true;
    
    const topMatch = matches[0];
    const inputModel = imeiData.model.toLowerCase();
    const inputCapacity = imeiData.capacity.toLowerCase();
    const inputColor = imeiData.color.toLowerCase();
    const inputCarrier = imeiData.carrier.toLowerCase();
    const matchedModel = topMatch.model?.toLowerCase() || '';
    const matchedCapacity = topMatch.capacity?.toLowerCase() || '';
    const matchedColor = topMatch.color?.toLowerCase() || '';
    const matchedCarrier = topMatch.carrier?.toLowerCase() || '';
    
    // 1. Check for missing/null values that affect match quality
    const missingCriticalData = this.detectMissingCriticalData(imeiData, topMatch);
    if (missingCriticalData) {
      logger.info(`🔍 UNDEFINED: Missing critical data - ${missingCriticalData}`);
      return true;
    }
    
    // 2. Dynamic model mismatch detection
    const modelMismatch = this.detectModelMismatchDynamic(inputModel, matchedModel, imeiData, topMatch);
    if (modelMismatch) {
      logger.info(`🔍 UNDEFINED: Model mismatch - Input: ${inputModel}, Matched: ${matchedModel}`);
      return true;
    }
    
    // 3. Dynamic capacity mismatch detection
    const capacityMismatch = this.detectCapacityMismatchDynamic(inputCapacity, matchedCapacity, imeiData, topMatch);
    if (capacityMismatch) {
      logger.info(`🔍 UNDEFINED: Capacity mismatch - Input: ${inputCapacity}, Matched: ${matchedCapacity}`);
      return true;
    }
    
    // 4. Dynamic non-existent SKU pattern detection
    const nonExistentPattern = this.detectNonExistentPatternDynamic(imeiData, topMatch);
    if (nonExistentPattern) {
      logger.info(`🔍 UNDEFINED: Non-existent SKU pattern - Input: ${imeiData.model} ${imeiData.capacity}`);
      return true;
    }
    
    // 5. Confidence-based classification
    const confidenceBased = this.classifyByConfidence(imeiData, matches);
    if (confidenceBased) {
      logger.info(`🔍 UNDEFINED: Low confidence match - Score: ${topMatch.match_score}`);
      return true;
    }
    
    return false;
  }

  private detectModelMismatch(inputModel: string, matchedModel: string): boolean {
    // Check for specific model mismatches
    const modelMismatches = [
      { input: 's23 plus', matched: 's23' },
      { input: 's23 ultra', matched: 's23' },
      { input: 's24 ultra', matched: 's24' },
      { input: 's24 plus', matched: 's24' },
      { input: 'iphone 13 pro', matched: 'iphone 13' },
      { input: 'iphone 13 pro max', matched: 'iphone 13' },
      { input: 'iphone 14 pro', matched: 'iphone 14' },
      { input: 'iphone 14 pro max', matched: 'iphone 14' },
      { input: 'pixel 7 pro', matched: 'pixel 7' },
      { input: 'pixel 8 pro', matched: 'pixel 8' }
    ];
    
    // Check for cross-model contamination (completely different models)
    const crossModelContamination = [
      { input: 's23', matched: 'fold' },
      { input: 's23', matched: 'flip' },
      { input: 's24', matched: 'fold' },
      { input: 's24', matched: 'flip' },
      { input: 's23 plus', matched: 'fold' },
      { input: 's23 plus', matched: 'flip' },
      { input: 's23 ultra', matched: 'fold' },
      { input: 's23 ultra', matched: 'flip' },
      { input: 's24 ultra', matched: 'fold' },
      { input: 's24 ultra', matched: 'flip' },
      { input: 'iphone', matched: 'samsung' },
      { input: 'iphone', matched: 'galaxy' },
      { input: 'pixel', matched: 'samsung' },
      { input: 'pixel', matched: 'galaxy' },
      { input: 'oneplus', matched: 'samsung' },
      { input: 'oneplus', matched: 'galaxy' }
    ];
    
    return modelMismatches.some(mismatch => 
      inputModel.includes(mismatch.input) && matchedModel.includes(mismatch.matched)
    ) || crossModelContamination.some(contamination => 
      inputModel.includes(contamination.input) && matchedModel.includes(contamination.matched)
    );
  }

  private detectCapacityMismatch(inputCapacity: string, matchedCapacity: string): boolean {
    // Check for significant capacity mismatches
    const capacityMismatches = [
      { input: '1tb', matched: '256gb' },
      { input: '1tb', matched: '128gb' },
      { input: '1tb', matched: '64gb' },
      { input: '512gb', matched: '128gb' },
      { input: '512gb', matched: '64gb' },
      { input: '256gb', matched: '64gb' },
      { input: '128gb', matched: '32gb' }
    ];
    
    return capacityMismatches.some(mismatch => 
      inputCapacity.includes(mismatch.input) && matchedCapacity.includes(mismatch.matched)
    );
  }

  private detectNonExistentPattern(imeiData: ImeiData, topMatch: any): boolean {
    // Check for patterns that shouldn't exist
    const inputModel = imeiData.model.toLowerCase();
    const inputCapacity = imeiData.capacity.toLowerCase();
    const matchedSku = topMatch.sku_code?.toLowerCase() || '';
    
    // S24 128GB should not match S24-ULTRA patterns
    if (inputModel.includes('s24') && !inputModel.includes('ultra') && !inputModel.includes('plus') && 
        matchedSku.includes('s24-ultra')) {
      return true;
    }
    
    // S24 Ultra 128GB should not exist (only 256GB, 512GB, 1TB)
    if (inputModel.includes('s24 ultra') && inputCapacity.includes('128gb')) {
      return true;
    }
    
    // S23 Plus 512GB should not exist (only 128GB, 256GB)
    if (inputModel.includes('s23 plus') && inputCapacity.includes('512gb')) {
      return true;
    }
    
    return false;
  }

  // DYNAMIC DETECTION METHODS - Learn from data patterns
  private detectModelMismatchDynamic(inputModel: string, matchedModel: string, imeiData: ImeiData, topMatch: any): boolean {
    // 1. Check hard-coded patterns (fallback)
    if (this.detectModelMismatch(inputModel, matchedModel)) {
      return true;
    }
    
    // 2. Dynamic pattern analysis
    const inputWords = inputModel.split(/\s+/);
    const matchedWords = matchedModel.split(/\s+/);
    
    // Check for significant word differences
    const commonWords = inputWords.filter(word => matchedWords.includes(word));
    const inputUniqueWords = inputWords.filter(word => !matchedWords.includes(word));
    const matchedUniqueWords = matchedWords.filter(word => !inputWords.includes(word));
    
    // If more than 50% of words are different, likely a mismatch
    const similarityRatio = commonWords.length / Math.max(inputWords.length, matchedWords.length);
    if (similarityRatio < 0.5) {
      logger.info(`🔍 DYNAMIC: Low model similarity (${(similarityRatio * 100).toFixed(1)}%) - Input: ${inputModel}, Matched: ${matchedModel}`);
      return true;
    }
    
    // 3. Brand consistency check
    const inputBrand = imeiData.brand.toLowerCase();
    const matchedBrand = topMatch.brand?.toLowerCase() || '';
    if (inputBrand && matchedBrand && !inputBrand.includes(matchedBrand) && !matchedBrand.includes(inputBrand)) {
      logger.info(`🔍 DYNAMIC: Brand mismatch - Input: ${inputBrand}, Matched: ${matchedBrand}`);
      return true;
    }
    
    return false;
  }

  private detectCapacityMismatchDynamic(inputCapacity: string, matchedCapacity: string, imeiData: ImeiData, topMatch: any): boolean {
    // 1. Check hard-coded patterns (fallback)
    if (this.detectCapacityMismatch(inputCapacity, matchedCapacity)) {
      return true;
    }
    
    // 2. Dynamic capacity analysis
    const inputCapacityNum = this.extractCapacityNumber(inputCapacity);
    const matchedCapacityNum = this.extractCapacityNumber(matchedCapacity);
    
    if (inputCapacityNum && matchedCapacityNum) {
      // If capacity difference is more than 50%, likely a mismatch
      const capacityRatio = Math.min(inputCapacityNum, matchedCapacityNum) / Math.max(inputCapacityNum, matchedCapacityNum);
      if (capacityRatio < 0.5) {
        logger.info(`🔍 DYNAMIC: Significant capacity difference (${(capacityRatio * 100).toFixed(1)}%) - Input: ${inputCapacity}, Matched: ${matchedCapacity}`);
        return true;
      }
    }
    
    return false;
  }

  private detectNonExistentPatternDynamic(imeiData: ImeiData, topMatch: any): boolean {
    // 1. Check hard-coded patterns (fallback)
    if (this.detectNonExistentPattern(imeiData, topMatch)) {
      return true;
    }
    
    // 2. Dynamic SKU pattern analysis
    const inputModel = imeiData.model.toLowerCase();
    const inputCapacity = imeiData.capacity.toLowerCase();
    const matchedSku = topMatch.sku_code?.toLowerCase() || '';
    
    // Extract model and capacity from SKU
    const skuModel = this.extractModelFromSku(matchedSku);
    const skuCapacity = this.extractCapacityFromSku(matchedSku);
    
    // Check if SKU model matches input model
    if (skuModel && !this.modelsMatch(inputModel, skuModel)) {
      logger.info(`🔍 DYNAMIC: SKU model mismatch - Input: ${inputModel}, SKU: ${skuModel}`);
      return true;
    }
    
    // Check if SKU capacity matches input capacity
    if (skuCapacity && !this.capacitiesMatch(inputCapacity, skuCapacity)) {
      logger.info(`🔍 DYNAMIC: SKU capacity mismatch - Input: ${inputCapacity}, SKU: ${skuCapacity}`);
      return true;
    }
    
    return false;
  }

  private classifyByConfidence(imeiData: ImeiData, matches: any[]): boolean {
    if (matches.length === 0) return true;
    
    const topMatch = matches[0];
    const score = topMatch.match_score || 0;
    
    // Dynamic confidence thresholds based on match type
    let threshold = 70; // Default threshold
    
    // Adjust threshold based on match type
    switch (topMatch.match_type) {
      case 'tag':
        threshold = 80; // Tag matches should be more confident
        break;
      case 'pattern':
        threshold = 75; // Pattern matches medium confidence
        break;
      case 'field':
        threshold = 70; // Field matches lower confidence
        break;
    }
    
    // Adjust threshold based on data completeness
    const completenessScore = this.calculateDataCompleteness(imeiData);
    if (completenessScore < 0.7) {
      threshold += 10; // Higher threshold for incomplete data
    }
    
    if (score < threshold) {
      logger.info(`🔍 DYNAMIC: Low confidence (${score} < ${threshold}) - Type: ${topMatch.match_type}, Completeness: ${(completenessScore * 100).toFixed(1)}%`);
      return true;
    }
    
    return false;
  }

  // Helper methods for dynamic analysis
  private extractCapacityNumber(capacity: string): number | null {
    const match = capacity.match(/(\d+)/);
    return match && match[1] ? parseInt(match[1]) : null;
  }

  private extractModelFromSku(sku: string): string | null {
    // Extract model from SKU patterns like S24-ULTRA-256-BLK
    const parts = sku.split('-');
    if (parts.length >= 2) {
      return parts[0] + '-' + parts[1]; // e.g., "S24-ULTRA"
    }
    return null;
  }

  private extractCapacityFromSku(sku: string): string | null {
    // Extract capacity from SKU patterns like S24-ULTRA-256-BLK
    const parts = sku.split('-');
    for (const part of parts) {
      if (part.match(/\d+gb|\d+tb/i)) {
        return part.toUpperCase();
      }
    }
    return null;
  }

  private modelsMatch(inputModel: string, skuModel: string): boolean {
    // Check if input model matches SKU model
    const inputWords = inputModel.split(/\s+/);
    const skuWords = skuModel.split('-');
    
    // Enhanced model matching with fuzzy logic
    return inputWords.some(word => skuWords.some(skuWord => {
      const inputLower = word.toLowerCase();
      const skuLower = skuWord.toLowerCase();
      
      // Exact match
      if (inputLower === skuLower) return true;
      
      // Contains match
      if (inputLower.includes(skuLower) || skuLower.includes(inputLower)) return true;
      
      // Model variation matching (e.g., PIXEL-6-PRO vs PIXEL-7-PRO)
      if (this.isModelVariation(inputLower, skuLower)) return true;
      
      // Fuzzy matching for similar models
      if (this.calculateSimilarity(inputLower, skuLower) > 0.7) return true;
      
      return false;
    }));
  }

  private isModelVariation(inputModel: string, skuModel: string): boolean {
    // Check for SKU formatting variations like PIXEL-6PRO vs PIXEL-6-PRO (same model, different separator formatting)
    const inputParts = inputModel.split(/[-_\s]+/);
    const skuParts = skuModel.split(/[-_\s]+/);
    
    // Only check if they have the same number of parts (same model structure)
    if (inputParts.length !== skuParts.length) {
      return false; // Different structure (e.g., S23-ULTRA vs S23-ULTRA-256)
    }
    
    // Normalize both models by removing separators and comparing
    const inputNormalized = inputParts.join('').toLowerCase();
    const skuNormalized = skuParts.join('').toLowerCase();
    
    // Check if they're the same model with different separator formatting
    if (inputNormalized === skuNormalized) {
      return true; // Same model, different formatting (e.g., PIXEL-6PRO vs PIXEL-6-PRO)
    }
    
    return false;
  }

  private isNumberDifference(str1: string, str2: string): boolean {
    const num1 = parseInt(str1);
    const num2 = parseInt(str2);
    
    // Check if both are numbers and close to each other
    if (!isNaN(num1) && !isNaN(num2)) {
      return Math.abs(num1 - num2) <= 2; // Allow up to 2 number difference
    }
    
    return false;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple similarity calculation based on common characters
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    // Simple character-based similarity
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (shorter[i] && longer.includes(shorter[i]!)) {
        matches++;
      }
    }
    
    return matches / longer.length;
  }

  private capacitiesMatch(inputCapacity: string, skuCapacity: string): boolean {
    // Check if input capacity matches SKU capacity
    const inputNum = this.extractCapacityNumber(inputCapacity);
    const skuNum = this.extractCapacityNumber(skuCapacity);
    
    if (inputNum && skuNum) {
      return inputNum === skuNum;
    }
    
    return inputCapacity.toLowerCase().includes(skuCapacity.toLowerCase()) ||
           skuCapacity.toLowerCase().includes(inputCapacity.toLowerCase());
  }

  private colorsMatch(inputColor: string, skuColor: string): boolean {
    // Enhanced color matching for uncommon colors like Hazel
    const inputLower = inputColor.toLowerCase();
    const skuLower = skuColor.toLowerCase();
    
    // Exact match
    if (inputLower === skuLower) return true;
    
    // Contains match
    if (inputLower.includes(skuLower) || skuLower.includes(inputLower)) return true;
    
    // Color alias matching
    if (this.isColorAlias(inputLower, skuLower)) return true;
    
    // Fuzzy color matching for similar colors
    if (this.calculateSimilarity(inputLower, skuLower) > 0.6) return true;
    
    return false;
  }

  private isColorAlias(inputColor: string, skuColor: string): boolean {
    // Color aliases and variations
    const colorAliases = {
      'hazel': ['hazelnut', 'brown', 'tan', 'beige'],
      'obsidian': ['black', 'dark', 'charcoal'],
      'titanium': ['silver', 'gray', 'grey', 'metallic'],
      'graphite': ['gray', 'grey', 'dark', 'charcoal'],
      'mystic': ['purple', 'violet', 'lavender'],
      'phantom': ['black', 'dark', 'shadow'],
      'titan': ['silver', 'gray', 'grey', 'metallic'],
      'natural': ['beige', 'tan', 'nude', 'cream'],
      'deep': ['dark', 'rich', 'vivid'],
      'mint': ['green', 'light green', 'pastel green'],
      'snow': ['white', 'light', 'ivory', 'cream']
    };
    
    // Check if colors are aliases of each other
    for (const [baseColor, aliases] of Object.entries(colorAliases)) {
      if ((inputColor === baseColor && aliases.includes(skuColor)) ||
          (skuColor === baseColor && aliases.includes(inputColor))) {
        return true;
      }
    }
    
    return false;
  }

  private calculateDataCompleteness(imeiData: ImeiData): number {
    // Calculate how complete the input data is
    let score = 0;
    const fields = ['brand', 'model', 'capacity', 'color', 'carrier'];
    
    fields.forEach(field => {
      const value = imeiData[field as keyof ImeiData];
      if (value && value.trim().length > 0) {
        score += 1;
      }
    });
    
    return score / fields.length;
  }

  private enhanceMatchesWithFuzzyLogic(imeiData: ImeiData, matches: any[]): any[] {
    // Enhance matches with fuzzy logic for better color and model matching
    return matches.map(match => {
      let enhancedScore = match.match_score || 0;
      const inputModel = imeiData.model.toLowerCase();
      const inputColor = imeiData.color.toLowerCase();
      const matchedModel = match.model?.toLowerCase() || '';
      const matchedColor = match.color?.toLowerCase() || '';
      const matchedSku = match.sku_code?.toLowerCase() || '';
      
      // Enhanced color matching bonus
      if (inputColor && matchedColor && this.colorsMatch(inputColor, matchedColor)) {
        enhancedScore += 5; // Bonus for color match
        logger.info(`🎨 COLOR MATCH BONUS: ${inputColor} ↔ ${matchedColor} (+5 points)`);
      }
      
      // Enhanced model matching bonus
      if (inputModel && matchedModel && this.modelsMatch(inputModel, matchedModel)) {
        enhancedScore += 3; // Bonus for model match
        logger.info(`📱 MODEL MATCH BONUS: ${inputModel} ↔ ${matchedModel} (+3 points)`);
      }
      
      // SKU pattern matching bonus
      if (this.isSkuPatternMatch(imeiData, matchedSku)) {
        enhancedScore += 8; // Bonus for SKU pattern match
        logger.info(`🏷️ SKU PATTERN BONUS: ${matchedSku} (+8 points)`);
      }
      
      // Core device characteristics bonus (Model + Color + Capacity)
      if (this.hasCoreDeviceMatch(imeiData, match)) {
        enhancedScore += 15; // High bonus for core device match
        logger.info(`🎯 CORE DEVICE BONUS: Model+Color+Capacity match (+15 points)`);
      }
      
      return {
        ...match,
        match_score: Math.min(enhancedScore, 100), // Cap at 100
        enhanced: enhancedScore > match.match_score
      };
    }).sort((a, b) => b.match_score - a.match_score); // Re-sort by enhanced score
  }

  private isSkuPatternMatch(imeiData: ImeiData, skuCode: string): boolean {
    // Check if SKU pattern matches the input data
    const inputBrand = imeiData.brand.toLowerCase();
    const inputModel = imeiData.model.toLowerCase();
    const inputCapacity = imeiData.capacity.toLowerCase();
    const inputColor = imeiData.color.toLowerCase();
    const inputCarrier = imeiData.carrier.toLowerCase();
    
    const skuLower = skuCode.toLowerCase();
    
    // Check brand match
    if (!skuLower.includes(inputBrand)) return false;
    
    // Check model match (with variations)
    const modelWords = inputModel.split(/\s+/);
    const modelMatch = modelWords.some(word => {
      if (skuLower.includes(word)) return true;
      // Check for model variations
      return this.checkModelVariationInSku(word, skuLower);
    });
    if (!modelMatch) return false;
    
    // Check capacity match
    const capacityMatch = skuLower.includes(inputCapacity) || 
                         this.extractCapacityNumber(inputCapacity) === this.extractCapacityFromSkuNumber(skuCode);
    if (!capacityMatch) return false;
    
    // Check color match (with aliases)
    const colorMatch = skuLower.includes(inputColor) || this.isColorAlias(inputColor, this.extractColorFromSku(skuCode));
    if (!colorMatch) return false;
    
    return true;
  }

  private checkModelVariationInSku(modelWord: string, skuCode: string): boolean {
    // Check if model word has variations in SKU (separator formatting differences only)
    const skuParts = skuCode.split(/[-_\s]+/);
    
    // Check exact match first
    if (skuParts.some(part => part.toLowerCase() === modelWord.toLowerCase())) {
      return true;
    }
    
    // Check for separator formatting variations (e.g., "6PRO" vs "6-PRO")
    // Only if the model word contains separators
    if (modelWord.includes('-') || modelWord.includes('_') || modelWord.includes(' ')) {
      const modelNormalized = modelWord.replace(/[-_\s]/g, '').toLowerCase();
      return skuParts.some(part => {
        const partNormalized = part.replace(/[-_\s]/g, '').toLowerCase();
        return partNormalized === modelNormalized;
      });
    }
    
    return false;
  }

  private extractColorFromSku(skuCode: string): string {
    // Extract color from SKU pattern
    const parts = skuCode.split(/[-_\s]+/);
    const colorKeywords = ['hazel', 'obsidian', 'titanium', 'graphite', 'mystic', 'phantom', 'titan', 'natural', 'deep', 'mint', 'snow', 'black', 'white', 'blue', 'red', 'green', 'purple', 'pink', 'gray', 'grey', 'silver', 'gold'];
    
    for (const part of parts) {
      if (colorKeywords.some(keyword => part.toLowerCase().includes(keyword))) {
        return part.toLowerCase();
      }
    }
    
    return '';
  }

  private extractCapacityFromSkuNumber(skuCode: string): number | null {
    // Extract capacity number from SKU
    const parts = skuCode.split(/[-_\s]+/);
    for (const part of parts) {
      const match = part.match(/(\d+)(gb|tb)/i);
      if (match && match[1] && match[2]) {
        const num = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        return unit === 'tb' ? num * 1024 : num; // Convert TB to GB equivalent
      }
    }
    return null;
  }

  private hasCoreDeviceMatch(imeiData: ImeiData, match: any): boolean {
    // Check if the match has the core device characteristics (Model + Color + Capacity)
    const inputModel = imeiData.model.toLowerCase();
    const inputColor = imeiData.color.toLowerCase();
    const inputCapacity = imeiData.capacity.toLowerCase();
    
    const matchedModel = match.model?.toLowerCase() || '';
    const matchedColor = match.color?.toLowerCase() || '';
    const matchedCapacity = match.capacity?.toLowerCase() || '';
    
    // Check if all three core characteristics match
    const modelMatch = this.modelsMatch(inputModel, matchedModel);
    const colorMatch = this.colorsMatch(inputColor, matchedColor);
    const capacityMatch = this.capacitiesMatch(inputCapacity, matchedCapacity);
    
    return modelMatch && colorMatch && capacityMatch;
  }

  private detectMissingCriticalData(imeiData: ImeiData, match: any): string | null {
    // Check for missing/null values that should trigger undefined classification
    // Use the same carrier processing logic as the SQL query
    const processedCarrier = this.processCarrierFromNotes(imeiData.carrier, imeiData.device_notes);
    const inputCarrier = processedCarrier?.trim() || '';
    const inputColor = imeiData.color?.trim() || '';
    const inputCapacity = imeiData.capacity?.trim() || '';
    
    const matchedCarrier = match.carrier?.trim() || '';
    const matchedColor = match.color?.trim() || '';
    const matchedCapacity = match.capacity?.trim() || '';
    
    // Check if input has carrier but match doesn't (or vice versa)
    // Exception: If input carrier is 'UNLOCKED', it means "no carrier field needed"
    if (inputCarrier && inputCarrier !== 'UNLOCKED' && !matchedCarrier) {
      return `Input has carrier '${inputCarrier}' but match has no carrier`;
    }
    
    // Special case: If input carrier is 'UNLOCKED' and match has no carrier, that's OK
    if (inputCarrier === 'UNLOCKED' && !matchedCarrier) {
      // This is a valid match, don't flag as undefined
      return null;
    }
    
    if (!inputCarrier && matchedCarrier) {
      return `Input has no carrier but match has carrier '${matchedCarrier}'`;
    }
    
    // Check if input has color but match doesn't (or vice versa)
    if (inputColor && !matchedColor) {
      return `Input has color '${inputColor}' but match has no color`;
    }
    
    if (!inputColor && matchedColor) {
      return `Input has no color but match has color '${matchedColor}'`;
    }
    
    // Check if input has capacity but match doesn't (or vice versa)
    if (inputCapacity && !matchedCapacity) {
      return `Input has capacity '${inputCapacity}' but match has no capacity`;
    }
    
    if (!inputCapacity && matchedCapacity) {
      return `Input has no capacity but match has capacity '${matchedCapacity}'`;
    }
    
    // Check for empty/null critical fields in input
    // Exception: "UNLOCKED" is a valid carrier, not missing
    if (!inputCarrier || inputCarrier === '') {
      return `Input carrier is missing/null`;
    }
    
    if (!inputColor || inputColor === '') {
      return `Input color is missing/null`;
    }
    
    if (!inputCapacity || inputCapacity === '') {
      return `Input capacity is missing/null`;
    }
    
    return null; // No missing critical data
  }

  private processCarrierFromNotes(carrier: string, device_notes?: string): string {
    // Original device_notes logic:
    // IF "CARRIER" 
    //   IF "UNLOCKED" then override as "UNLOCKED" 
    //   IF "LOCKED" then leave CARRIER AS IS 
    // IF "UNLOCKED" THEN No CARRIER FIELD NEEDED
    
    const notes = device_notes?.toLowerCase() || '';
    const carrierUpper = carrier?.toUpperCase() || '';
    
    // If device_notes contains "unlocked", override carrier to "UNLOCKED"
    if (notes.includes('unlocked')) {
      return 'UNLOCKED';
    }
    
    // If device_notes contains "locked", keep the original carrier
    if (notes.includes('locked')) {
      return carrier;
    }
    
    // If carrier is already "UNLOCKED", it's a valid carrier
    if (carrierUpper === 'UNLOCKED') {
      return 'UNLOCKED';
    }
    
    // Default: return original carrier
    return carrier;
  }

  private getUndefinedReason(imeiData: ImeiData, matches: any[]): string {
    if (matches.length === 0) {
      return "No matches found";
    }
    
    const topMatch = matches[0];
    
    // Check for missing critical data first
    const missingData = this.detectMissingCriticalData(imeiData, topMatch);
    if (missingData) {
      return missingData;
    }
    
    // Check for model mismatch
    const inputModel = imeiData.model.toLowerCase();
    const matchedModel = topMatch.model?.toLowerCase() || '';
    if (this.detectModelMismatchDynamic(inputModel, matchedModel, imeiData, topMatch)) {
      return `Model mismatch: Input '${imeiData.model}' vs Match '${topMatch.model}'`;
    }
    
    // Check for capacity mismatch
    const inputCapacity = imeiData.capacity.toLowerCase();
    const matchedCapacity = topMatch.capacity?.toLowerCase() || '';
    if (this.detectCapacityMismatchDynamic(inputCapacity, matchedCapacity, imeiData, topMatch)) {
      return `Capacity mismatch: Input '${imeiData.capacity}' vs Match '${topMatch.capacity}'`;
    }
    
    // Check for non-existent pattern
    if (this.detectNonExistentPatternDynamic(imeiData, topMatch)) {
      return `Non-existent SKU pattern for ${imeiData.model} ${imeiData.capacity}`;
    }
    
    // Check for low confidence
    if (this.classifyByConfidence(imeiData, matches)) {
      return `Low confidence match (Score: ${topMatch.match_score})`;
    }
    
    return "Unknown undefined reason";
  }

  /**
   * CORE METHOD: Tag-first hybrid matching with single query
   * Uses sku_tags array and individual tag columns for maximum accuracy
   */
  async matchImeiToSku(imeiData: ImeiData, options: any = {}): Promise<MatchResult> {
    const startTime = Date.now();
    
    try {
      if (!this.client) {
        if (this.pool) {
          this.client = await this.pool.connect();
        } else {
          throw new Error('Database client not initialized');
        }
      }

      logger.info(`🔍 HYBRID MATCHING: Processing device ${imeiData.imei}`);

      const minScore = options.minScore || 40;
      const maxResults = options.maxResults || 10;

      const result = await this.executeHybridQuery(imeiData, minScore, maxResults);
      
      const processingTime = Date.now() - startTime;
      let matches = result.rows || [];
      
      // Filter out SKUs with post-fix values (should not be selected)
      matches = matches.filter((sku: any) => {
        const postfix = sku.post_fix || '';
        // Filter out any post-fix values (VG, UV, ACCEPTABLE, etc.)
        return !postfix || postfix.trim() === '';
      });
      
      // Post-process matches with enhanced logic
      matches = this.enhanceMatchesWithFuzzyLogic(imeiData, matches);
      
      const highestScore = matches.length > 0 ? matches[0].match_score : 0;
      
      // Enhanced undefined classification logic
      const isUndefined = this.classifyAsUndefined(imeiData, matches);
      const requiresAttention = isUndefined || highestScore < 70 || matches.length === 0;

      logger.info(`✅ HYBRID MATCHING: Found ${matches.length} matches for ${imeiData.imei} (${processingTime}ms)`);

      return {
        matches,
        requiresAttention,
        totalMatches: matches.length,
        highestScore,
        matchType: 'hybrid_tag_first',
        processingTime,
        isUndefined,
        undefinedReason: isUndefined ? this.getUndefinedReason(imeiData, matches) : null
      };

    } catch (error) {
      logger.error(`❌ HYBRID MATCHING ERROR for ${imeiData.imei}:`, error);
      throw error;
    }
  }

  /**
   * SINGLE QUERY: Tag-first hybrid matching with progressive scoring
   * Combines sku_tags array matching with individual tag columns and pattern matching
   */
  private async executeHybridQuery(imeiData: ImeiData, minScore: number, maxResults: number) {
    return await this.client!.query(`
      WITH device_data AS (
        SELECT 
          $1::text as imei,
          $2::text as brand,
          $3::text as model,
          $4::text as capacity,
          $5::text as color,
          $6::text as carrier,
          $7::text as device_notes,
          -- Original device_notes logic:
          -- IF "CARRIER" 
          --   IF "UNLOCKED" then override as "UNLOCKED" 
          --   IF "LOCKED" then leave CARRIER AS IS 
          -- IF "UNLOCKED" THEN No CARRIER FIELD NEEDED
          CASE 
            WHEN $7 ILIKE '%unlocked%' THEN 'UNLOCKED'
            WHEN $7 ILIKE '%locked%' THEN $6
            WHEN $6 ILIKE '%UNLOCKED%' THEN 'UNLOCKED'
            ELSE $6
          END as actual_carrier
      ),
      normalized_device AS (
        SELECT 
          dd.*,
          -- Use normalization_tags for fuzzy matching
          COALESCE(nt_model.normalized_value, dd.model) as norm_model,
          COALESCE(nt_capacity.normalized_value, dd.capacity) as norm_capacity,
          COALESCE(nt_color.normalized_value, dd.color) as norm_color,
          COALESCE(nt_carrier.normalized_value, dd.actual_carrier) as norm_carrier,
          COALESCE(nt_brand.normalized_value, dd.brand) as norm_brand,
          -- Enhanced capacity normalization for common variations
          CASE 
            WHEN UPPER(dd.capacity) LIKE '%1TB%' OR UPPER(dd.capacity) LIKE '%1024GB%' THEN '1TB'
            WHEN UPPER(dd.capacity) LIKE '%512GB%' THEN '512GB'
            WHEN UPPER(dd.capacity) LIKE '%256GB%' THEN '256GB'
            WHEN UPPER(dd.capacity) LIKE '%128GB%' THEN '128GB'
            WHEN UPPER(dd.capacity) LIKE '%64GB%' THEN '64GB'
            WHEN UPPER(dd.capacity) LIKE '%32GB%' THEN '32GB'
            ELSE COALESCE(nt_capacity.normalized_value, dd.capacity)
          END as enhanced_capacity
        FROM device_data dd
        LEFT JOIN normalization_tags nt_model ON nt_model.category = 'model' 
          AND nt_model.input_value ILIKE '%' || dd.model || '%'
          AND nt_model.is_active = true
        LEFT JOIN normalization_tags nt_capacity ON nt_capacity.category = 'capacity' 
          AND nt_capacity.input_value ILIKE '%' || dd.capacity || '%'
          AND nt_capacity.is_active = true
        LEFT JOIN normalization_tags nt_color ON nt_color.category = 'color' 
          AND nt_color.input_value ILIKE '%' || dd.color || '%'
          AND nt_color.is_active = true
        LEFT JOIN normalization_tags nt_carrier ON nt_carrier.category = 'carrier' 
          AND nt_carrier.input_value ILIKE '%' || dd.actual_carrier || '%'
          AND nt_carrier.is_active = true
        LEFT JOIN normalization_tags nt_brand ON nt_brand.category = 'brand' 
          AND nt_brand.input_value ILIKE '%' || dd.brand || '%'
          AND nt_brand.is_active = true
      ),
      tag_matches AS (
        SELECT sm.*,
          -- Enhanced tag array matching with strict model requirements
          CASE 
            -- Perfect match: Brand + Model + Capacity + Color + Carrier
            WHEN (
              (sm.sku_tags && ARRAY[nd.norm_brand::text] AND nd.norm_brand IS NOT NULL AND nd.norm_brand != '')::int +
              (sm.sku_tags && ARRAY[nd.norm_model::text] AND nd.norm_model IS NOT NULL AND nd.norm_model != '')::int +
              ((sm.sku_tags && ARRAY[nd.norm_capacity::text] AND nd.norm_capacity IS NOT NULL AND nd.norm_capacity != '') OR 
               (sm.sku_tags && ARRAY[nd.enhanced_capacity::text] AND nd.enhanced_capacity IS NOT NULL AND nd.enhanced_capacity != ''))::int +
              (sm.sku_tags && ARRAY[nd.norm_color::text] AND nd.norm_color IS NOT NULL AND nd.norm_color != '')::int +
              (sm.sku_tags && ARRAY[nd.norm_carrier::text] AND nd.norm_carrier IS NOT NULL AND nd.norm_carrier != '')::int
            ) = 5 THEN 100
            
            -- Excellent match: Brand + Model + Capacity + (Color OR Carrier)
            WHEN (
              (sm.sku_tags && ARRAY[nd.norm_brand::text] AND nd.norm_brand IS NOT NULL AND nd.norm_brand != '')::int +
              (sm.sku_tags && ARRAY[nd.norm_model::text] AND nd.norm_model IS NOT NULL AND nd.norm_model != '')::int +
              ((sm.sku_tags && ARRAY[nd.norm_capacity::text] AND nd.norm_capacity IS NOT NULL AND nd.norm_capacity != '') OR 
               (sm.sku_tags && ARRAY[nd.enhanced_capacity::text] AND nd.enhanced_capacity IS NOT NULL AND nd.enhanced_capacity != ''))::int
            ) = 3 AND (
              (sm.sku_tags && ARRAY[nd.norm_color::text] AND nd.norm_color IS NOT NULL AND nd.norm_color != '')::int +
              (sm.sku_tags && ARRAY[nd.norm_carrier::text] AND nd.norm_carrier IS NOT NULL AND nd.norm_carrier != '')::int
            ) >= 1 THEN 95
            
            -- Very good match: Brand + Model + Capacity
            WHEN (
              (sm.sku_tags && ARRAY[nd.norm_brand::text] AND nd.norm_brand IS NOT NULL AND nd.norm_brand != '')::int +
              (sm.sku_tags && ARRAY[nd.norm_model::text] AND nd.norm_model IS NOT NULL AND nd.norm_model != '')::int +
              ((sm.sku_tags && ARRAY[nd.norm_capacity::text] AND nd.norm_capacity IS NOT NULL AND nd.norm_capacity != '') OR 
               (sm.sku_tags && ARRAY[nd.enhanced_capacity::text] AND nd.enhanced_capacity IS NOT NULL AND nd.enhanced_capacity != ''))::int
            ) = 3 THEN 90
            
            -- Good match: Brand + Model + (Color OR Carrier)
            WHEN (
              (sm.sku_tags && ARRAY[nd.norm_brand::text] AND nd.norm_brand IS NOT NULL AND nd.norm_brand != '')::int +
              (sm.sku_tags && ARRAY[nd.norm_model::text] AND nd.norm_model IS NOT NULL AND nd.norm_model != '')::int
            ) = 2 AND (
              (sm.sku_tags && ARRAY[nd.norm_color::text] AND nd.norm_color IS NOT NULL AND nd.norm_color != '')::int +
              (sm.sku_tags && ARRAY[nd.norm_carrier::text] AND nd.norm_carrier IS NOT NULL AND nd.norm_carrier != '')::int
            ) >= 1 THEN 80
            
            -- Acceptable match: Brand + Model only
            WHEN (
              (sm.sku_tags && ARRAY[nd.norm_brand::text] AND nd.norm_brand IS NOT NULL AND nd.norm_brand != '')::int +
              (sm.sku_tags && ARRAY[nd.norm_model::text] AND nd.norm_model IS NOT NULL AND nd.norm_model != '')::int
            ) = 2 THEN 70
            
            -- Individual tag column matching (fallback) - Using correct column names
            WHEN sm.model_tag = nd.norm_model AND sm.capacity_tag = nd.norm_capacity AND sm.color_tag = nd.norm_color THEN 85
            WHEN sm.model_tag = nd.norm_model AND sm.capacity_tag = nd.norm_capacity THEN 75
            WHEN sm.model_tag = nd.norm_model AND sm.color_tag = nd.norm_color THEN 70
            WHEN sm.model_tag = nd.norm_model AND sm.carrier_tag = nd.norm_carrier THEN 65
            WHEN sm.capacity_tag = nd.norm_capacity AND sm.color_tag = nd.norm_color THEN 60
            
            -- Single tag matches (lower priority) with brand requirement
            WHEN sm.model_tag = nd.norm_model AND sm.sku_tags && ARRAY[nd.norm_brand::text] THEN 50
            WHEN sm.capacity_tag = nd.norm_capacity AND sm.sku_tags && ARRAY[nd.norm_brand::text] THEN 45
            WHEN sm.color_tag = nd.norm_color AND sm.sku_tags && ARRAY[nd.norm_brand::text] THEN 40
            WHEN sm.carrier_tag = nd.norm_carrier AND sm.sku_tags && ARRAY[nd.norm_brand::text] THEN 35
            
            ELSE 0
          END as match_score,
          'tag' as match_type
        FROM sku_master sm, normalized_device nd
        WHERE sm.is_active = true
          AND (
            -- Require brand match for all tag-based matching to prevent cross-brand contamination
            (sm.sku_tags && ARRAY[nd.norm_brand::text] AND nd.norm_brand IS NOT NULL AND nd.norm_brand != '') OR
            -- Allow individual tag matching only if brand matches
            (sm.model_tag = nd.norm_model AND sm.sku_tags && ARRAY[nd.norm_brand::text]) OR 
            (sm.capacity_tag = nd.norm_capacity AND sm.sku_tags && ARRAY[nd.norm_brand::text])
          )
      ),
      pattern_matches AS (
        -- SKU pattern matching for manual entries
        SELECT sm.*,
          CASE 
            -- SKU code contains all device components
            WHEN LOWER(sm.sku_code) ~ LOWER(nd.norm_brand || '.*' || nd.norm_model || '.*' || nd.norm_capacity || '.*' || nd.norm_carrier) THEN 80
            WHEN LOWER(sm.sku_code) ~ LOWER(nd.norm_brand || '.*' || nd.norm_model || '.*' || nd.norm_capacity) THEN 70
            WHEN LOWER(sm.sku_code) ~ LOWER(nd.norm_brand || '.*' || nd.norm_model) THEN 60
            ELSE 0
          END as match_score,
          'pattern' as match_type
        FROM sku_master sm, normalized_device nd
        WHERE sm.is_active = true
          AND LOWER(sm.sku_code) ~ LOWER(nd.norm_brand)
      ),
      field_matches AS (
        -- Traditional field matching as final fallback
        SELECT sm.*,
          (
            -- Brand matching (15 points) - Reduced weight
            CASE 
              WHEN COALESCE(sm.brand, '') = '' OR COALESCE(nd.norm_brand, '') = '' THEN 0
              WHEN LOWER(sm.brand) = LOWER(nd.norm_brand) THEN 15
              WHEN LOWER(sm.brand) ILIKE '%' || LOWER(nd.norm_brand) || '%' THEN 12
              ELSE 0 
            END +
            
            -- Model matching (40 points) - Increased weight (most important)
            CASE 
              WHEN COALESCE(sm.model, '') != '' AND COALESCE(nd.norm_model, '') != '' 
                   AND LOWER(sm.model) = LOWER(nd.norm_model) THEN 40
              WHEN COALESCE(sm.model, '') != '' AND COALESCE(nd.norm_model, '') != '' 
                   AND LOWER(sm.model) ILIKE '%' || LOWER(nd.norm_model) || '%' THEN 35
              WHEN (COALESCE(sm.model, '') = '') AND COALESCE(nd.norm_model, '') != '' 
                   AND LOWER(sm.sku_code) ILIKE '%' || LOWER(nd.norm_model) || '%' THEN 30
              ELSE 0
            END +
            
            -- Capacity matching (30 points) - Increased weight (very important)
            CASE 
              WHEN COALESCE(sm.capacity, '') = '' OR COALESCE(nd.norm_capacity, '') = '' THEN 0
              WHEN LOWER(sm.capacity) = LOWER(nd.norm_capacity) THEN 30
              WHEN LOWER(sm.capacity) ILIKE '%' || LOWER(nd.norm_capacity) || '%' THEN 25
              ELSE 0 
            END +
            
            -- Color matching (25 points) - Increased weight (important)
             CASE 
               WHEN COALESCE(sm.color, '') = '' OR COALESCE(nd.norm_color, '') = '' THEN 0
               WHEN LOWER(sm.color) = LOWER(nd.norm_color) THEN 25
               WHEN LOWER(sm.color) ILIKE '%' || LOWER(nd.norm_color) || '%' THEN 20
               WHEN LOWER(nd.norm_color) ILIKE '%' || LOWER(sm.color) || '%' THEN 20
               ELSE 0 
             END +
            
            -- Carrier matching (15 points) - Reduced weight (least important)
            CASE 
              WHEN COALESCE(sm.carrier, '') = '' OR COALESCE(nd.norm_carrier, '') = '' THEN 0
              WHEN LOWER(sm.carrier) = LOWER(nd.norm_carrier) THEN 15
              WHEN LOWER(sm.carrier) ILIKE '%' || LOWER(nd.norm_carrier) || '%' THEN 12
              ELSE 0 
            END
          ) as match_score,
          'field' as match_type
        FROM sku_master sm, normalized_device nd
        WHERE sm.is_active = true
          AND (
            -- Require brand match for field-based matching to prevent cross-brand contamination
            (COALESCE(sm.brand, '') != '' AND COALESCE(nd.norm_brand, '') != '' AND 
             LOWER(sm.brand) ILIKE '%' || LOWER(nd.norm_brand) || '%') OR
            -- Allow capacity-only matches for very specific cases
            (COALESCE(sm.brand, '') = '' AND COALESCE(nd.norm_brand, '') = '' AND
             COALESCE(sm.capacity, '') != '' AND COALESCE(nd.norm_capacity, '') != '' AND
             LOWER(sm.capacity) = LOWER(nd.norm_capacity))
          )
      )
      -- Combine all matching strategies
      SELECT 
        sku_code, sku_tags, brand, model, capacity, color, carrier, post_fix, device_type,
        model_tag, capacity_tag, color_tag, carrier_tag, postfix_tag,
        match_score, match_type,
        -- Additional metadata
        CASE 
          WHEN match_score >= 90 THEN 'HIGH'
          WHEN match_score >= 70 THEN 'MEDIUM'
          WHEN match_score >= 50 THEN 'LOW'
          ELSE 'VERY_LOW'
        END as confidence_level
      FROM (
        SELECT * FROM tag_matches WHERE match_score >= $8
        UNION ALL
        SELECT * FROM pattern_matches WHERE match_score >= $9
        UNION ALL
        SELECT * FROM field_matches WHERE match_score >= $10
      ) combined_matches
      ORDER BY match_score DESC, sku_code
      LIMIT $11
    `, [
      imeiData.imei, imeiData.brand, imeiData.model, imeiData.capacity,
      imeiData.color, imeiData.carrier, imeiData.device_notes || '',
      minScore, minScore, minScore, maxResults
    ]);
  }

  /**
   * Get filtered SKUs with postfix filtering
   */
  async getFilteredSkus(device: any, filterPostfix: boolean): Promise<{ skus: any[], requiresAttention: boolean }> {
    try {
      const imeiData: ImeiData = {
        imei: device.imei,
        brand: device.brand,
        model: device.model,
        capacity: device.capacity,
        color: device.color,
        carrier: device.carrier,
        device_notes: device.device_notes
      };

      const result = await this.matchImeiToSku(imeiData, { minScore: 40, maxResults: 20 });
      
      let filteredSkus = result.matches;

      if (filterPostfix) {
        // Filter out low-grade postfixes
        filteredSkus = filteredSkus.filter((sku: any) => {
          const postfix = sku.post_fix || '';
          const isLowGrade = ['VG', 'UV', 'ACCEPTABLE'].includes(postfix.toUpperCase());
          return !isLowGrade;
        });
      }

      return {
        skus: filteredSkus,
        requiresAttention: result.requiresAttention || filteredSkus.length === 0
      };

    } catch (error) {
      logger.error('❌ Error getting filtered SKUs:', error);
      throw error;
    }
  }
}
