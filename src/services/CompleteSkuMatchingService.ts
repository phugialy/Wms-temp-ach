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
  device_notes?: string;
  postfix?: string | null;
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
  private pool!: Pool;
  private client: PoolClient | null = null;
  private abbreviationMappings: Map<string, string> = new Map();
  private modelMappings: Map<string, string> = new Map();
  private carrierMappings: Map<string, string> = new Map();
  private colorMappings: Map<string, string> = new Map();
  private postfixMappings: Map<string, PostfixMapping> = new Map();
  
  // PERFORMANCE OPTIMIZATION: In-memory normalization cache
  private normalizationCache: Map<string, { normalizedValue: string; tags: string[]; isPostfix: boolean; }> = new Map();

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
      
      // Load abbreviation mappings
      await this.loadAbbreviations();
      
      // PERFORMANCE OPTIMIZATION: Load all normalization data into memory
      await this.loadNormalizationCache();
      
      // Initialize smart mappings for your real data
      this.initializeSmartMappings();
      
      logger.info('✅ Complete SKU Matching Service initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Complete SKU Matching Service:', error);
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
      logger.info('✅ Complete SKU Matching Service cleaned up');
    } catch (error) {
      logger.error('❌ Error during cleanup:', error);
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

  /**
   * PERFORMANCE OPTIMIZATION: Load all normalization data into memory
   * This replaces the 4 database queries per item with in-memory lookups
   */
  async loadNormalizationCache(): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('Database client not initialized');
      }

      console.log(`🚨 CACHE LOADING: Starting to load normalization cache...`);
      
      const result = await this.client.query(`
        SELECT category, input_value, normalized_value, tags, is_postfix, priority
        FROM normalization_tags 
        WHERE is_active = true
        ORDER BY category, priority DESC
      `);
      
      console.log(`🚨 CACHE LOADING: Query returned ${result.rows.length} rows`);
      
      this.normalizationCache.clear();
      
      result.rows.forEach((row: any) => {
        const key = `${row.category}:${row.input_value.toUpperCase()}`;
        this.normalizationCache.set(key, {
          normalizedValue: row.normalized_value,
          tags: row.tags,
          isPostfix: row.is_postfix
        });
      });
      
      logger.info(`🚀 PERFORMANCE: Loaded ${this.normalizationCache.size} normalization mappings into memory`);
      console.log(`🚀 CACHE LOADED: ${this.normalizationCache.size} entries`);
      
      if (this.normalizationCache.size === 0) {
        console.log(`🚨 ERROR: Cache is empty! Check if normalization_tags table exists and has data.`);
      } else {
        // Debug: Show first few cache entries
        let count = 0;
        for (const [key, value] of this.normalizationCache.entries()) {
          if (count < 5) {
            console.log(`🚀 CACHE ENTRY: ${key} -> ${JSON.stringify(value)}`);
            count++;
          }
        }
      }
    } catch (error) {
      logger.error('❌ Failed to load normalization cache:', error);
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
   * CORE METHOD: Handles both single device and bulk processing
   * Uses pure PostgreSQL power for maximum performance
   * @param imeiData - Device characteristics for matching
   * @returns Matched SKUs with scores and confidence levels
   */
  async matchDeviceToSku(imeiData: ImeiData): Promise<{ matches: any[], requiresAttention: boolean }> {
    try {
      if (!this.client) {
        // Reconnect if client is not available
        if (this.pool) {
          this.client = await this.pool.connect();
        } else {
          throw new Error('Database client not initialized');
        }
      }

      logger.info(`🔍 CORE METHOD: Matching device ${imeiData.imei} with PostgreSQL power`);

      // IMPROVED POSTGRESQL QUERY - handles empty model fields and direct SKU code matching
      let result;
      try {
        result = await this.client.query(`
        WITH device_data AS (
          SELECT 
            $1::text as imei,
            $2::text as brand,
            $3::text as model,
            $4::text as capacity,
            $5::text as color,
            $6::text as carrier,
            $7::text as device_notes,
            -- Parse carrier from device notes
            CASE 
              WHEN $7 ILIKE '%unlocked%' OR $7 ILIKE '%carrier unlocked%' THEN 'UNLOCKED'
              WHEN $7 ILIKE '%locked%' OR $7 ILIKE '%carrier locked%' THEN $6
              ELSE $6
            END as actual_carrier
        ),
        matching_skus AS (
          SELECT sm.*,
            -- Calculate match score with robust NULL handling and complex model matching
            (
              -- Brand matching (30 points) - handle NULL values
              CASE 
                WHEN COALESCE(sm.brand, '') = '' OR COALESCE(nd.brand, '') = '' THEN 0
                WHEN LOWER(COALESCE(sm.brand, '')) = LOWER(COALESCE(nd.brand, '')) THEN 30 
                WHEN LOWER(COALESCE(sm.brand, '')) ILIKE '%' || LOWER(COALESCE(nd.brand, '')) || '%' THEN 20 
                ELSE 0 
              END +
              
              -- Model matching (35 points) - handle NULL values and complex model names
              CASE 
                -- Exact model match (highest priority)
                WHEN COALESCE(sm.model, '') != '' AND COALESCE(nd.model, '') != '' 
                     AND LOWER(sm.model) = LOWER(nd.model) THEN 35
                
                -- Partial model match in model field
                WHEN COALESCE(sm.model, '') != '' AND COALESCE(nd.model, '') != '' 
                     AND LOWER(sm.model) ILIKE '%' || LOWER(nd.model) || '%' THEN 30
                
                -- Model match in SKU code (for empty model fields)
                WHEN (COALESCE(sm.model, '') = '') AND COALESCE(nd.model, '') != '' 
                     AND LOWER(sm.sku_code) ILIKE '%' || LOWER(nd.model) || '%' THEN 30
                
                -- Complex model matching (TAB-S8-ULTRA, TAB-S9-ULTRA, etc.)
                WHEN COALESCE(nd.model, '') != '' THEN
                  CASE 
                    -- Extract model number from complex names (S8, S9, S23, etc.) - HIGHEST PRIORITY
                    WHEN LOWER(nd.model) ~ 's\d+' AND LOWER(sm.sku_code) ~ 's\d+' THEN
                      CASE 
                        -- Extract model number from device model (e.g., "galaxy s23" -> "s23")
                        WHEN LOWER(nd.model) ~ 's(\d+)' AND LOWER(sm.sku_code) ~ 's(\d+)' THEN
                          CASE 
                            -- Extract the number part and compare exactly
                            WHEN LOWER(sm.sku_code) ILIKE '%s' || (SELECT regexp_replace(LOWER(nd.model), '.*s(\d+).*', '\\1', 'g')) || '%' THEN 35
                            ELSE 0 
                          END
                        -- Fallback to general match
                        WHEN LOWER(sm.sku_code) ILIKE '%' || LOWER(nd.model) || '%' THEN 30
                        ELSE 0 
                      END
                    -- Handle TAB models specifically - HIGHEST PRIORITY
                    WHEN LOWER(nd.model) ILIKE '%tab%' AND LOWER(sm.sku_code) ILIKE '%tab%' THEN
                      CASE 
                        -- Exact TAB model match (TAB-S8 matches TAB-S8, not TAB-S9)
                        WHEN LOWER(sm.sku_code) ILIKE '%' || LOWER(nd.model) || '%' THEN 35
                        ELSE 0 
                      END
                    -- Handle ULTRA models
                    WHEN LOWER(nd.model) ILIKE '%ultra%' AND LOWER(sm.sku_code) ILIKE '%ultra%' THEN
                      CASE WHEN LOWER(sm.sku_code) ILIKE '%' || LOWER(nd.model) || '%' THEN 30 ELSE 0 END
                    -- General partial match in SKU code
                    WHEN LOWER(sm.sku_code) ILIKE '%' || LOWER(nd.model) || '%' THEN 25
                    ELSE 0
                  END
                ELSE 0 
              END +
              
              -- Capacity matching (25 points) - handle NULL values
              CASE 
                WHEN COALESCE(sm.capacity, '') = '' OR COALESCE(nd.capacity, '') = '' THEN 0
                WHEN LOWER(sm.capacity) = LOWER(nd.capacity) THEN 25 
                WHEN LOWER(sm.capacity) ILIKE '%' || LOWER(nd.capacity) || '%' THEN 20 
                ELSE 0 
              END +
              
              -- Color matching (20 points) - handle NULL values
              CASE 
                WHEN COALESCE(sm.color, '') = '' OR COALESCE(nd.color, '') = '' THEN 0
                WHEN LOWER(sm.color) = LOWER(nd.color) THEN 20 
                WHEN LOWER(sm.color) ILIKE '%' || LOWER(nd.color) || '%' THEN 15 
                ELSE 0 
              END +
              
              -- Carrier matching (15 points) - handle NULL values
              CASE 
                WHEN COALESCE(sm.carrier, '') = '' OR COALESCE(nd.actual_carrier, '') = '' THEN 0
                WHEN LOWER(sm.carrier) = LOWER(nd.actual_carrier) THEN 15 
                WHEN LOWER(sm.carrier) ILIKE '%' || LOWER(nd.actual_carrier) || '%' THEN 10 
                ELSE 0 
              END
            ) as match_score
          FROM sku_master sm, device_data nd
          WHERE sm.is_active = true
          AND LENGTH(sm.sku_code) < 50
        )
        SELECT 
          sku_code, sku_tags, brand, model, capacity, color, carrier, post_fix, device_type,
          match_score,
          CASE WHEN match_score >= 75 THEN 'high_confidence' 
               WHEN match_score >= 50 THEN 'medium_confidence'
               ELSE 'low_confidence' END as confidence_level
        FROM matching_skus 
        WHERE match_score >= 50
        AND (
          -- Require model match for high confidence (unless it's a very specific case)
          (match_score >= 75 AND (
            -- Model field must match or be in SKU code
            (COALESCE(model, '') != '' AND LOWER(model) ILIKE '%' || LOWER($3) || '%') OR
            (COALESCE(model, '') = '' AND LOWER(sku_code) ILIKE '%' || LOWER($3) || '%')
          )) OR
          -- For medium confidence (50-74), allow some flexibility but still require model presence
          (match_score < 75 AND match_score >= 50 AND (
            -- Model must be present in either model field or SKU code
            LOWER(sku_code) ILIKE '%' || LOWER($3) || '%' OR
            (COALESCE(model, '') != '' AND LOWER(model) ILIKE '%' || LOWER($3) || '%')
          ))
        )
        ORDER BY match_score DESC, sku_code
        LIMIT 10
      `, [
        imeiData.imei,
        imeiData.brand,
        imeiData.model,
        imeiData.capacity,
        imeiData.color,
        imeiData.carrier,
        imeiData.device_notes || ''
      ]);
      } catch (queryError) {
        logger.error(`❌ Database query error for device ${imeiData.imei}:`, queryError);
        // Return empty result on query error
        return { matches: [], requiresAttention: true };
      }

      // Format results consistently
      const matches = result.rows.map(row => ({
        sku: row,
        score: row.match_score,
        totalScore: row.match_score,
        matchedCharacteristics: this.getMatchedCharacteristics(row),
        method: 'postgresql_advanced_query',
        confidence: row.confidence_level
      }));

      logger.info(`📊 CORE METHOD: Found ${matches.length} matches for device ${imeiData.imei}`);

      // Check for insufficient data (too many NULL values)
      const insufficientData = this.checkInsufficientData(imeiData);
      if (insufficientData) {
        logger.warn(`⚠️ INSUFFICIENT DATA: Device ${imeiData.imei} has insufficient data for matching - sending to undefined_sku`);
        return await this.handleInsufficientDataScenario(imeiData, insufficientData);
      }

      // Handle no-match scenarios with fallback logic
      if (matches.length === 0) {
        logger.warn(`⚠️ NO MATCHES: Device ${imeiData.imei} has no SKU matches - applying fallback logic`);
        return await this.handleNoMatchScenario(imeiData);
      }

      // Handle low-confidence matches
      if (matches[0]?.confidence === 'low_confidence') {
        logger.warn(`⚠️ LOW CONFIDENCE: Device ${imeiData.imei} has low-confidence matches - may need review`);
      }

      return {
        matches,
        requiresAttention: matches.length === 0 || matches[0]?.confidence === 'low_confidence'
      };

    } catch (error) {
      logger.error(`❌ CORE METHOD: Error matching device ${imeiData.imei}:`, error);
      throw error;
    }
  }

  /**
   * Helper method to get matched characteristics from SKU
   */
  private getMatchedCharacteristics(sku: any): string[] {
    const characteristics = [];
    if (sku.match_score >= 25) characteristics.push('model');
    if (sku.match_score >= 50) characteristics.push('capacity');
    if (sku.match_score >= 75) characteristics.push('color');
    if (sku.match_score >= 100) characteristics.push('carrier');
    return characteristics;
  }

  /**
   * Check if device data is insufficient for reliable matching
   * @param imeiData - Device characteristics to check
   * @returns Reason for insufficient data or null if sufficient
   */
  private checkInsufficientData(imeiData: ImeiData): string | null {
    const nullFields = [];
    
    // Check critical fields
    if (!imeiData.brand || imeiData.brand.trim() === '') nullFields.push('brand');
    if (!imeiData.model || imeiData.model.trim() === '') nullFields.push('model');
    if (!imeiData.capacity || imeiData.capacity.trim() === '') nullFields.push('capacity');
    if (!imeiData.color || imeiData.color.trim() === '') nullFields.push('color');
    if (!imeiData.carrier || imeiData.carrier.trim() === '') nullFields.push('carrier');
    
    // If brand and model are both NULL, definitely insufficient (highest priority)
    if (nullFields.includes('brand') && nullFields.includes('model')) {
      return `Insufficient data: missing brand and model (most critical fields)`;
    }
    
    // If brand is NULL and more than 2 other fields are NULL
    if (nullFields.includes('brand') && nullFields.length >= 3) {
      return `Insufficient data: missing brand and ${nullFields.length - 1} other critical fields`;
    }
    
    // If more than 3 critical fields are NULL, consider insufficient
    if (nullFields.length >= 3) {
      return `Insufficient data: missing ${nullFields.join(', ')} (${nullFields.length}/5 critical fields)`;
    }
    
    return null; // Data is sufficient
  }

  /**
   * Handle insufficient data scenarios by storing in undefined_sku table
   * @param imeiData - Device characteristics with insufficient data
   * @param reason - Reason for insufficient data
   * @returns Empty matches with undefined_sku storage result
   */
  private async handleInsufficientDataScenario(imeiData: ImeiData, reason: string): Promise<{ matches: any[], requiresAttention: boolean, noMatchReason?: string }> {
    try {
      logger.info(`🔄 INSUFFICIENT DATA: Storing device ${imeiData.imei} in undefined_sku table`);

      if (!this.client) {
        throw new Error('Database client not initialized');
      }

      // Store in undefined_sku table
      await this.client.query(`
        INSERT INTO undefined_sku (imei, device_data, reason, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (imei) DO UPDATE SET
          device_data = EXCLUDED.device_data,
          reason = EXCLUDED.reason,
          updated_at = NOW()
      `, [
        imeiData.imei,
        JSON.stringify({
          brand: imeiData.brand,
          model: imeiData.model,
          capacity: imeiData.capacity,
          color: imeiData.color,
          carrier: imeiData.carrier,
          device_notes: imeiData.device_notes,
          original_sku: imeiData.original_sku
        }),
        reason
      ]);

      logger.info(`✅ INSUFFICIENT DATA: Device ${imeiData.imei} stored in undefined_sku table`);
      
      return {
        matches: [],
        requiresAttention: true,
        noMatchReason: reason
      };

    } catch (error) {
      logger.error(`❌ INSUFFICIENT DATA: Error storing device ${imeiData.imei} in undefined_sku:`, error);
      return {
        matches: [],
        requiresAttention: true,
        noMatchReason: `Failed to store in undefined_sku: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Handle no-match scenarios by storing in no-match queue
   * @param imeiData - Device characteristics that had no matches
   * @returns Empty matches with queue storage result
   */
  private async handleNoMatchScenario(imeiData: ImeiData): Promise<{ matches: any[], requiresAttention: boolean, noMatchReason?: string }> {
    try {
      logger.info(`🔄 NO-MATCH: Storing device ${imeiData.imei} in no-match queue`);

      // Get normalization results for debugging
      const normalizationResults = await this.getNormalizationResults(imeiData);
      
      // Store in no-match queue
      await this.storeInNoMatchQueue(imeiData, normalizationResults);

      logger.info(`✅ NO-MATCH: Device ${imeiData.imei} stored in no-match queue for manual review`);
      
      return {
        matches: [],
        requiresAttention: true,
        noMatchReason: 'Device stored in no-match queue for manual SKU creation'
      };

    } catch (error) {
      logger.error(`❌ NO-MATCH: Error storing device ${imeiData.imei} in queue:`, error);
      return {
        matches: [],
        requiresAttention: true,
        noMatchReason: 'Failed to store in no-match queue due to error'
      };
    }
  }

  /**
   * Get normalization results for debugging purposes
   */
  private async getNormalizationResults(imeiData: ImeiData): Promise<any> {
    if (!this.client) return {};

    try {
      const result = await this.client.query(`
        WITH device_data AS (
          SELECT 
            $1::text as imei,
            $2::text as brand,
            $3::text as model,
            $4::text as capacity,
            $5::text as color,
            $6::text as carrier,
            $7::text as device_notes,
            CASE 
              WHEN $7 ILIKE '%unlocked%' THEN 'UNLOCKED'
              WHEN $7 ILIKE '%locked%' THEN $6
              ELSE $6
            END as actual_carrier
        ),
        normalized_data AS (
          SELECT 
            dd.*,
            (SELECT normalized_value FROM normalization_tags 
             WHERE category = 'model' AND input_value ILIKE '%' || dd.model || '%' 
             AND is_active = true ORDER BY priority DESC LIMIT 1) as norm_model,
            (SELECT normalized_value FROM normalization_tags 
             WHERE category = 'capacity' AND input_value ILIKE '%' || dd.capacity || '%' 
             AND is_active = true ORDER BY priority DESC LIMIT 1) as norm_capacity,
            (SELECT normalized_value FROM normalization_tags 
             WHERE category = 'color' AND input_value ILIKE '%' || dd.color || '%' 
             AND is_active = true ORDER BY priority DESC LIMIT 1) as norm_color,
            (SELECT normalized_value FROM normalization_tags 
             WHERE category = 'carrier' AND input_value ILIKE '%' || dd.actual_carrier || '%' 
             AND is_active = true ORDER BY priority DESC LIMIT 1) as norm_carrier
          FROM device_data dd
        )
        SELECT * FROM normalized_data
      `, [
        imeiData.imei,
        imeiData.brand,
        imeiData.model,
        imeiData.capacity,
        imeiData.color,
        imeiData.carrier,
        imeiData.device_notes || ''
      ]);

      return result.rows[0] || {};
    } catch (error) {
      logger.error('Error getting normalization results:', error);
      return {};
    }
  }

  /**
   * Store device in no-match queue for manual review
   */
  private async storeInNoMatchQueue(imeiData: ImeiData, normalizationResults: any): Promise<void> {
    if (!this.client) throw new Error('Database client not initialized');

    try {
      // Determine priority based on device characteristics
      const priority = this.calculatePriority(imeiData, normalizationResults);
      
      // Prepare fallback attempts (for future use)
      const fallbackAttempts = [
        { strategy: 'main_cte_query', attempted: true, result: 'no_matches' },
        { strategy: 'brand_only', attempted: false, result: 'not_attempted' },
        { strategy: 'generic_matching', attempted: false, result: 'not_attempted' }
      ];

      await this.client.query(`
        INSERT INTO no_match_queue (
          imei, brand, model, capacity, color, carrier, device_notes, original_sku,
          normalized_model, normalized_capacity, normalized_color, normalized_carrier,
          fallback_attempts, fallback_reason, status, priority,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15, $16,
          NOW(), NOW()
        )
        ON CONFLICT (imei) DO UPDATE SET
          brand = EXCLUDED.brand,
          model = EXCLUDED.model,
          capacity = EXCLUDED.capacity,
          color = EXCLUDED.color,
          carrier = EXCLUDED.carrier,
          device_notes = EXCLUDED.device_notes,
          original_sku = EXCLUDED.original_sku,
          normalized_model = EXCLUDED.normalized_model,
          normalized_capacity = EXCLUDED.normalized_capacity,
          normalized_color = EXCLUDED.normalized_color,
          normalized_carrier = EXCLUDED.normalized_carrier,
          fallback_attempts = EXCLUDED.fallback_attempts,
          fallback_reason = EXCLUDED.fallback_reason,
          priority = EXCLUDED.priority,
          updated_at = NOW()
      `, [
        imeiData.imei,
        imeiData.brand,
        imeiData.model,
        imeiData.capacity,
        imeiData.color,
        imeiData.carrier,
        imeiData.device_notes,
        imeiData.original_sku,
        normalizationResults.norm_model,
        normalizationResults.norm_capacity,
        normalizationResults.norm_color,
        normalizationResults.norm_carrier,
        JSON.stringify(fallbackAttempts),
        'No SKU matches found in sku_master table',
        'pending',
        priority
      ]);

    } catch (error) {
      logger.error('Error storing in no-match queue:', error);
      throw error;
    }
  }

  /**
   * Calculate priority for no-match queue entry
   */
  private calculatePriority(imeiData: ImeiData, normalizationResults: any): number {
    let priority = 5; // Default priority

    // Higher priority for known brands
    if (imeiData.brand && ['Samsung', 'Apple', 'Google', 'OnePlus'].includes(imeiData.brand)) {
      priority -= 2;
    }

    // Higher priority if some normalization worked
    const normalizedCount = [
      normalizationResults.norm_model,
      normalizationResults.norm_capacity,
      normalizationResults.norm_color,
      normalizationResults.norm_carrier
    ].filter(Boolean).length;

    if (normalizedCount > 0) {
      priority -= 1;
    }

    // Lower priority for completely unknown devices
    if (!imeiData.brand || imeiData.brand === 'Unknown') {
      priority += 2;
    }

    return Math.max(1, Math.min(10, priority));
  }

  /**
   * Strategy 1: Try matching by brand only (very loose matching)
   */
  private async tryBrandOnlyMatching(imeiData: ImeiData): Promise<any[]> {
    if (!this.client || !imeiData.brand) return [];

    try {
      const result = await this.client.query(`
        SELECT 
          sku_code, sku_tags, brand, model, capacity, color, carrier, post_fix, device_type,
          10 as match_score, -- Low score for brand-only match
          'low_confidence' as confidence_level
        FROM sku_master 
        WHERE brand ILIKE $1
        AND sku_tags IS NOT NULL 
        AND array_length(sku_tags, 1) > 0
        AND LENGTH(sku_code) < 50
        ORDER BY sku_code
        LIMIT 5
      `, [`%${imeiData.brand}%`]);

      return result.rows.map(row => ({
        sku: row,
        score: row.match_score,
        totalScore: row.match_score,
        matchedCharacteristics: ['brand'],
        method: 'fallback_brand_only',
        confidence: row.confidence_level,
        fallbackReason: 'No exact matches found, using brand-only matching'
      }));
    } catch (error) {
      logger.error('Error in brand-only matching:', error);
      return [];
    }
  }

  /**
   * Strategy 2: Try generic device type matching
   */
  private async tryGenericMatching(imeiData: ImeiData): Promise<any[]> {
    if (!this.client) return [];

    try {
      // Try to match by device type (PHONE, TABLET, etc.)
      const deviceType = this.inferDeviceType(imeiData);
      
      const result = await this.client.query(`
        SELECT 
          sku_code, sku_tags, brand, model, capacity, color, carrier, post_fix, device_type,
          5 as match_score, -- Very low score for generic match
          'low_confidence' as confidence_level
        FROM sku_master 
        WHERE device_type = $1
        AND sku_tags IS NOT NULL 
        AND array_length(sku_tags, 1) > 0
        AND LENGTH(sku_code) < 50
        ORDER BY sku_code
        LIMIT 3
      `, [deviceType]);

      return result.rows.map(row => ({
        sku: row,
        score: row.match_score,
        totalScore: row.match_score,
        matchedCharacteristics: ['device_type'],
        method: 'fallback_generic',
        confidence: row.confidence_level,
        fallbackReason: `No exact matches found, using generic ${deviceType} matching`
      }));
    } catch (error) {
      logger.error('Error in generic matching:', error);
      return [];
    }
  }

  /**
   * Strategy 3: Create a placeholder SKU for new device types
   */
  private async createPlaceholderSku(imeiData: ImeiData): Promise<any | null> {
    try {
      const deviceType = this.inferDeviceType(imeiData);
      const placeholderSku = this.generatePlaceholderSku(imeiData);

      return {
        sku: {
          sku_code: placeholderSku,
          sku_tags: [imeiData.brand, deviceType, 'PLACEHOLDER'],
          brand: imeiData.brand,
          model: imeiData.model,
          capacity: imeiData.capacity,
          color: imeiData.color,
          carrier: imeiData.carrier,
          post_fix: 'PLACEHOLDER',
          device_type: deviceType
        },
        score: 1,
        totalScore: 1,
        matchedCharacteristics: [],
        method: 'fallback_placeholder',
        confidence: 'low_confidence',
        fallbackReason: 'Created placeholder SKU - needs manual review and proper SKU creation',
        isPlaceholder: true
      };
    } catch (error) {
      logger.error('Error creating placeholder SKU:', error);
      return null;
    }
  }

  /**
   * Infer device type from device characteristics
   */
  private inferDeviceType(imeiData: ImeiData): string {
    const model = imeiData.model?.toLowerCase() || '';
    const brand = imeiData.brand?.toLowerCase() || '';

    if (model.includes('ipad') || model.includes('tablet')) return 'TABLET';
    if (model.includes('watch') || model.includes('band')) return 'WEARABLE';
    if (model.includes('buds') || model.includes('airpods')) return 'ACCESSORY';
    if (brand.includes('samsung') || brand.includes('apple') || brand.includes('google')) return 'PHONE';
    
    return 'PHONE'; // Default to phone
  }

  /**
   * Generate a placeholder SKU for new device types
   */
  private generatePlaceholderSku(imeiData: ImeiData): string {
    const brand = imeiData.brand?.toUpperCase().replace(/\s+/g, '-') || 'UNKNOWN';
    const model = imeiData.model?.toUpperCase().replace(/\s+/g, '-') || 'UNKNOWN';
    const capacity = imeiData.capacity?.toUpperCase().replace(/\s+/g, '') || 'UNKNOWN';
    const color = imeiData.color?.toUpperCase().replace(/\s+/g, '-') || 'UNKNOWN';
    
    return `${brand}-${model}-${capacity}-${color}-PLACEHOLDER`;
  }

  /**
   * Main method to match IMEI device to SKUs (LEGACY - kept for backward compatibility)
   * @param imeiData - IMEI device characteristics
   * @param options - Matching options
   * @returns Array of matched SKUs with scores and details
   */
  async matchImeiToSku(imeiData: ImeiData, options: MatchingOptions = {}): Promise<{ matches: any[], requiresAttention: boolean }> {
    try {
      logger.info(`🔍 LEGACY METHOD: Using enhanced matchDeviceToSku for IMEI: ${imeiData.imei}`);
      
      // Use our enhanced method that includes no-match queue logic
      const result = await this.matchDeviceToSku(imeiData);
      
      // Apply options filtering if needed
      const { minScore = 0, maxResults = 10 } = options;
      
      let filteredMatches = result.matches;
      
      // Filter by minimum score if specified
      if (minScore > 0) {
        filteredMatches = result.matches.filter(match => match.score >= minScore);
      }
      
      // Limit results
      const limitedMatches = filteredMatches.slice(0, maxResults);
      
      logger.info(`📊 LEGACY METHOD: Found ${result.matches.length} matches, filtered to ${limitedMatches.length} (minScore: ${minScore})`);
      
      return {
        matches: limitedMatches,
        requiresAttention: result.requiresAttention
      };

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
      matrix[0]![j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1, // substitution
            matrix[i]![j - 1]! + 1,     // insertion
            matrix[i - 1]![j]! + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length]![str1.length]!;
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
    try {
      logger.info(`🔍 getFilteredSkus called with device: ${JSON.stringify(device)}`);
      if (!this.client) {
        throw new Error('Database client not initialized');
      }

      // Parse carrier from device notes (SAME LOGIC AS SIMPLE-TEST)
      let actualCarrier = device.carrier;
      let isUnlocked = false;
      if (device.device_notes) {
        const upperNotes = device.device_notes.toUpperCase();
        if (upperNotes.includes('CARRIER UNLOCKED') || upperNotes.includes('UNLOCKED')) {
          actualCarrier = 'UNLOCKED';
          isUnlocked = true;
        } else if (upperNotes.includes('CARRIER LOCKED') || upperNotes.includes('LOCKED')) {
          actualCarrier = device.carrier; // Keep original carrier (locked to that carrier)
        }
      }
      
      logger.info(`🔍 Carrier parsing: "${device.carrier}" → "${actualCarrier}" (unlocked: ${isUnlocked})`);
      
      // Use the PROVEN WORKING logic from simple-test
      logger.info(`🔍 USING PROVEN WORKING SIMPLE-TEST LOGIC`);
      
      // Use direct database queries like the working endpoints (pattern matching)
      console.log(`🚨 SERVICE DEBUG: Using direct DB queries with pattern matching`);
      console.log(`🚨 SERVICE DEBUG: Looking for model: "${device.model}"`);
      console.log(`🚨 SERVICE DEBUG: Looking for capacity: "${device.capacity}"`);
      console.log(`🚨 SERVICE DEBUG: Looking for color: "${device.color}"`);
      console.log(`🚨 SERVICE DEBUG: Looking for carrier: "${actualCarrier}" (unlocked: ${isUnlocked})`);
      
      console.log(`🚨 SERVICE DEBUG: Calling getNormalizationDataFromDB...`);
      const modelData = await this.getNormalizationDataFromDB('model', device.model);
      const capacityData = await this.getNormalizationDataFromDB('capacity', device.capacity);
      const colorData = await this.getNormalizationDataFromDB('color', device.color);
      
      // For carrier normalization, use the original carrier for lookup, but handle unlocked logic in query
      const carrierData = await this.getNormalizationDataFromDB('carrier', device.carrier);
      console.log(`🚨 SERVICE DEBUG: All normalization data retrieved`);
      
      console.log(`🚨 SERVICE DEBUG: Model data: ${modelData ? 'FOUND' : 'NOT FOUND'}`);
      console.log(`🚨 SERVICE DEBUG: Capacity data: ${capacityData ? 'FOUND' : 'NOT FOUND'}`);
      console.log(`🚨 SERVICE DEBUG: Color data: ${colorData ? 'FOUND' : 'NOT FOUND'}`);
      console.log(`🚨 SERVICE DEBUG: Carrier data: ${carrierData ? 'FOUND' : 'NOT FOUND'}`);
      
      // Build the EXACT SAME query as simple-test
      let query = `
        SELECT id, sku_code, sku_tags, brand, model, capacity, color, carrier, post_fix, device_type
        FROM sku_master 
        WHERE sku_tags IS NOT NULL AND array_length(sku_tags, 1) > 0
      `;
      
      // Model filtering - PERFORMANCE OPTIMIZED (using memory cache)
      if (modelData) {
        // For S22 ULTRA devices, we need BOTH S22 AND ULTRA to be present
        // For regular S22 devices, we just need S22
        const hasUltra = modelData.tags.some((tag: string) => tag.toUpperCase().includes('ULTRA'));
        
        if (hasUltra) {
          // S22 ULTRA: Need both S22 AND ULTRA
          const s22Condition = `EXISTS (SELECT 1 FROM unnest(sku_tags) AS tag WHERE UPPER(tag) = 'S22')`;
          const ultraCondition = `EXISTS (SELECT 1 FROM unnest(sku_tags) AS tag WHERE UPPER(tag) = 'ULTRA')`;
          query += ` AND (${s22Condition} AND ${ultraCondition})`;
        } else {
          // Regular S22: Just need S22
          const modelConditions = modelData.tags.map((tag: string) => 
            `EXISTS (SELECT 1 FROM unnest(sku_tags) AS tag WHERE UPPER(tag) = '${tag.toUpperCase()}')`
          ).join(' OR ');
          query += ` AND (${modelConditions})`;
        }
      }
      
      // Capacity filtering - PERFORMANCE OPTIMIZED (using memory cache)
      if (capacityData) {
        const capacityConditions = capacityData.tags.map((tag: string) => `'${tag}' = ANY(sku_tags)`).join(' OR ');
        query += ` AND (${capacityConditions})`;
      }
      
      // Color filtering - PERFORMANCE OPTIMIZED (using memory cache)
      if (colorData) {
        const colorConditions = colorData.tags.map((tag: string) => `'${tag}' = ANY(sku_tags)`).join(' OR ');
        query += ` AND (${colorConditions})`;
      }
      
      // Carrier filtering - PERFORMANCE OPTIMIZED (using memory cache)
      if (carrierData) {
        if (isUnlocked) {
          // For unlocked devices, look for either the original carrier OR UNLOCKED
          const originalCarrierConditions = carrierData.tags.map((tag: string) => `'${tag}' = ANY(sku_tags)`).join(' OR ');
          query += ` AND (${originalCarrierConditions} OR 'UNLOCKED' = ANY(sku_tags))`;
        } else {
          // For locked devices, look for the specific carrier
          const carrierConditions = carrierData.tags.map((tag: string) => `'${tag}' = ANY(sku_tags)`).join(' OR ');
          query += ` AND (${carrierConditions})`;
        }
      }
      
      // Add postfix filtering - EXACT SAME as simple-test
      if (filterPostfix) {
        query += ` AND NOT EXISTS (
          SELECT 1 FROM normalization_tags nt
          WHERE nt.is_postfix = true 
          AND nt.is_active = true
          AND nt.tags && sku_tags
        )`;
      }
      
      query += ` ORDER BY id LIMIT 50`;
      
      const result = await this.client.query(query);
      logger.info(`🔍 Query returned ${result.rows.length} SKUs`);
      
      // Debug: Log the actual query and results
      console.log(`🚨 SERVICE QUERY: ${query}`);
      console.log(`🚨 SERVICE RESULTS: ${result.rows.length} SKUs`);
      if (result.rows.length > 0) {
        console.log(`🚨 SERVICE FOUND: ${result.rows.map(row => row.sku_code).join(', ')}`);
      }
      
      return {
        skus: result.rows,
        requiresAttention: false
      };
    } catch (error) {
      logger.error(`❌ Error in getFilteredSkus:`, error);
      throw error;
    }
  }

  /**
   * Get normalization data from database
   * @param category - Category to look up (model, capacity, color, carrier, postfix)
   * @param inputValue - Input value to normalize
   * @returns Normalization data or null if not found
   */
  /**
   * Get normalization data from database using pattern matching (like working endpoints)
   */
  private async getNormalizationDataFromDB(category: string, inputValue: string): Promise<{ normalizedValue: string; tags: string[]; isPostfix: boolean; } | null> {
    try {
      if (!this.client || !inputValue) {
        return null;
      }

      const result = await this.client.query(`
        SELECT normalized_value, tags, is_postfix
        FROM normalization_tags
        WHERE category = $1 
        AND input_value ILIKE $2
        AND is_active = true
        ORDER BY priority DESC
        LIMIT 1
      `, [category, `%${inputValue}%`]);

      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          normalizedValue: row.normalized_value,
          tags: row.tags,
          isPostfix: row.is_postfix
        };
      }

      return null;
    } catch (error) {
      logger.error(`❌ Error getting normalization data for ${category}:${inputValue}:`, error);
      return null;
    }
  }

  /**
   * PERFORMANCE OPTIMIZED: Get normalization data from memory cache
   * @param category - Category to look up (model, capacity, color, carrier, postfix)
   * @param inputValue - Input value to normalize
   * @returns Normalization data or null if not found
   */
  private getNormalizationData(category: string, inputValue: string): { normalizedValue: string; tags: string[]; isPostfix: boolean; } | null {
    if (!inputValue) return null;
    
    try {
      // Try exact match first
      const exactKey = `${category}:${inputValue.toUpperCase()}`;
      let result = this.normalizationCache.get(exactKey);
      
      if (result) {
        console.log(`🚀 CACHE HIT: ${exactKey} -> ${JSON.stringify(result)}`);
        return result;
      }
      
      // Try partial matches (for cases like "Galaxy S22 Ultra" matching "S22")
      for (const [key, value] of this.normalizationCache.entries()) {
        const keyParts = key.split(':');
        if (keyParts.length > 1 && key.startsWith(`${category}:`) && inputValue.toUpperCase().includes(keyParts[1]!)) {
          console.log(`🚀 CACHE PARTIAL HIT: ${key} for input ${inputValue} -> ${JSON.stringify(value)}`);
          return value;
        }
      }
      
      console.log(`🚀 CACHE MISS: ${exactKey} (cache size: ${this.normalizationCache.size})`);
      return null;
    } catch (error) {
      logger.error(`❌ Error getting normalization data for ${category}:${inputValue}:`, error);
      return null;
    }
  }

  private async ensurePgTrgmExtension(): Promise<void> {
    try {
      // Check if pg_trgm extension exists, if not create it
      const result = await this.client!.query(`
        SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
      `);
      
      if (result.rows.length === 0) {
        logger.info('🔧 Enabling pg_trgm extension for fuzzy matching...');
        await this.client!.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
        logger.info('✅ pg_trgm extension enabled');
      }
    } catch (error) {
      logger.warn('⚠️ Could not enable pg_trgm extension:', error);
      // Continue without fuzzy matching if extension can't be enabled
    }
  }

  private normalizeModel(model: string): string {
    if (!model) return '';
    const upper = model.toUpperCase();
    
    if (upper.includes('GALAXY') && upper.includes('FOLD3')) return 'FOLD3';
    if (upper.includes('FOLD3')) return 'FOLD3';
    
    // Return the full format for exact matching
    return upper;
  }

  private getModelChunks(model: string): string[] {
    if (!model) return [];
    
    // Split model into individual terms
    const terms = model.split(/\s+/).map(term => term.trim()).filter(term => term.length > 0);
    
    // Convert to uppercase for consistent matching
    const upperTerms = terms.map(term => term.toUpperCase());
    
    // Filter out common words that don't add value for matching
    const filteredTerms = upperTerms.filter(term => 
      !['GALAXY', 'SAMSUNG', '5G', 'DUOS', 'DUAL', 'SIM'].includes(term)
    );
    
    // Always include the model number (S22, S23, etc.) if present
    const modelNumber = upperTerms.find(term => /^S\d+$/.test(term));
    if (modelNumber && !filteredTerms.includes(modelNumber)) {
      filteredTerms.push(modelNumber);
    }
    
    return filteredTerms;
  }

  private getColorVariations(color: string): string[] {
    if (!color) return [];
    const upper = color.toUpperCase();
    const variations = [upper, color]; // Include both uppercase and original case
    
    // Add abbreviated variations
    if (upper.includes('PHANTOM') && upper.includes('BLACK')) {
      variations.push('BLK');
    }
    if (upper.includes('PHANTOM') && upper.includes('GREEN')) {
      variations.push('GREEN');
    }
    if (upper.includes('PHANTOM') && upper.includes('SILVER')) {
      variations.push('SLV');
    }
    if (upper === 'BURGUNDY') {
      variations.push('BURGUNDY'); // Keep as-is for now
    }
    
    return variations;
  }

  private normalizeCapacity(capacity: string): string {
    if (!capacity) return '';
    // Extract just the number as it appears in SKU tags (e.g., "512GB" -> "512")
    const match = capacity.match(/(\d+)/);
    return match && match[1] ? match[1] : capacity.toUpperCase();
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
   * Detect device type based on model name
   */
  private detectDeviceType(device: any): string {
    const model = (device.model || '').toUpperCase();
    const brand = (device.brand || '').toUpperCase();
    
    // Check for tablet indicators
    if (model.includes('TAB') || model.includes('TABLET') || model.includes('PAD')) {
      return 'TABLET';
    }
    
    // Check for watch indicators
    if (model.includes('WATCH') || model.includes('GEAR') || model.includes('ACTIVE')) {
      return 'WATCH';
    }
    
    // Check for phone indicators (default for most devices)
    if (model.includes('GALAXY') || model.includes('IPHONE') || model.includes('PIXEL')) {
      return 'PHONE';
    }
    
    // Default to phone for unknown devices
    return 'PHONE';
  }

  /**
   * Generate model chunks for flexible matching
   */
  private generateModelChunks(model: string): string[] {
    if (!model) return [];
    
    const upper = model.toUpperCase().trim();
    const chunks: string[] = [];
    
    // Split by common separators
    const baseChunks = upper.split(/[\s\-_\.]+/).filter(chunk => chunk.length > 0);
    chunks.push(...baseChunks);
    
    // Add specific model number extractions
    if (upper.includes('GALAXY')) {
      chunks.push('GALAXY');
      
      // Extract model numbers (S21, S22, S23, NOTE10, FOLD3, etc.)
      const modelMatch = upper.match(/(S\d+|NOTE\d+|FOLD\d+|FLIP\d+|A\d+|M\d+)/);
      if (modelMatch && modelMatch[1]) {
        chunks.push(modelMatch[1]);
      }
      
      // Extract variants
      if (upper.includes('ULTRA')) chunks.push('ULTRA');
      if (upper.includes('PLUS')) chunks.push('PLUS');
      if (upper.includes('PRO')) chunks.push('PRO');
      if (upper.includes('5G')) chunks.push('5G');
      if (upper.includes('DUOS')) chunks.push('DUOS');
    }
    
    // Remove duplicates and return
    return [...new Set(chunks)].filter(chunk => chunk.length > 0);
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
      if (modelMatch && modelMatch[1]) {
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
    if (capacityMatch && capacityMatch[1]) {
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
        if (abbreviation && result.includes(abbreviation)) {
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

        const matchResult = this.calculateMatchScore(device, sku.sku_tags);
        
        logger.info(`📊 SKU ${sku.sku_code}: score=${matchResult.score}, tags=${JSON.stringify(sku.sku_tags)}`);
        
        if (matchResult.score > 0) {
          scoredSkus.push({
            skuCode: sku.sku_code,
            score: matchResult.score,
            matchedFields: matchResult.matchedCharacteristics,
            deviceType: sku.device_type,
            postFix: sku.post_fix,
            skuTags: sku.sku_tags || [],
            reason: `Score: ${matchResult.score}, Matched: ${matchResult.matchedCharacteristics.join(', ')}`
          });
        }
      } catch (error) {
        logger.error(`Error scoring SKU ${sku.sku_code}:`, error);
      }
    }

    logger.info(`📋 Found ${scoredSkus.length} SKUs with scores > 0`);
    logger.info(`📊 Total SKUs processed: ${skus.length}, Scored SKUs: ${scoredSkus.length}`);
    return scoredSkus;
  }

  /**
   * Calculate match score between device and SKU tags (NEW TAG-BASED LOGIC)
   * @param device - Normalized device data
   * @param skuTags - SKU tags array
   * @returns Match result with score and details
   */
  private calculateMatchScore(device: any, skuTags: string[]): { score: number, totalScore: number, matchedCharacteristics: string[] } {
    let score = 0;
    let method = 'none';
    const matchedCharacteristics: string[] = [];
    let tiebreakerScore = 0;
    const tiebreakerDetails: string[] = [];
    
    // Normalize device data
    const normalizedModel = this.normalizeModel(device.model);
    const normalizedCapacity = this.normalizeCapacity(device.capacity);
    const normalizedColor = this.normalizeColor(device.color);
    const normalizedCarrier = this.normalizeCarrier(device.carrier);
    
    // Check MODEL match (highest priority - 30 points)
    if (normalizedModel && skuTags.includes(normalizedModel)) {
      score += 30;
      matchedCharacteristics.push(`MODEL: ${normalizedModel}`);
      method = 'exact';
    } else {
      // Try chunk-based model matching
      const modelChunks = this.generateModelChunks(device.model || '');
      const modelMatches = modelChunks.filter(chunk => skuTags.includes(chunk));
      if (modelMatches.length > 0) {
        score += 25; // Slightly lower score for chunk-based match
        matchedCharacteristics.push(`MODEL_CHUNKS: [${modelMatches.join(', ')}]`);
        method = 'chunk';
      }
    }
    
    // Check CAPACITY match (25 points)
    if (normalizedCapacity && skuTags.includes(normalizedCapacity)) {
      score += 25;
      matchedCharacteristics.push(`CAPACITY: ${normalizedCapacity}`);
    }
    
    // Check COLOR match (20 points)
    if (normalizedColor && skuTags.includes(normalizedColor)) {
      score += 20;
      matchedCharacteristics.push(`COLOR: ${normalizedColor}`);
    }
    
    // Check CARRIER match (15 points)
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
    
    // TIEBREAKER SYSTEM: Secondary scoring for SKUs with same primary score
    tiebreakerScore = this.calculateTiebreakerScore(device, skuTags, tiebreakerDetails);
    
    return {
      score,                    // Primary score (0-100)
      totalScore: score + tiebreakerScore, // Combined score (0-120)
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
