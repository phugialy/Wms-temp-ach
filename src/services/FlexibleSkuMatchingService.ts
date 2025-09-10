import { Pool } from 'pg';
import { logger } from '../utils/logger';

interface ImeiData {
  imei: string;
  brand: string;
  model: string;
  capacity: string;
  color: string;
  carrier: string;
  device_notes?: string;
  original_sku?: string;
}

interface MatchResult {
  matches: any[];
  requiresAttention: boolean;
  noMatchReason?: string;
  confidence: 'high' | 'medium' | 'low' | 'very_low';
}

interface FlexibleMatchOptions {
  minScore?: number;
  maxResults?: number;
  useFuzzyMatching?: boolean;
  allowPartialMatches?: boolean;
  strictMode?: boolean;
}

export class FlexibleSkuMatchingService {
  private pool!: Pool;
  private client: any;
  private normalizationCache: Map<string, any> = new Map();

  async initialize(): Promise<void> {
    try {
      this.pool = new Pool({
        connectionString: process.env['DIRECT_URL'],
        connectionTimeoutMillis: 10000,
      });
      
      this.client = await this.pool.connect();
      await this.loadNormalizationCache();
      logger.info('✅ Flexible SKU Matching Service initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize Flexible SKU Matching Service:', error);
      throw error;
    }
  }

  /**
   * Main flexible matching method with multiple strategies
   */
  async matchImeiToSku(imeiData: ImeiData, options: FlexibleMatchOptions = {}): Promise<MatchResult> {
    try {
      logger.info(`🔍 FLEXIBLE MATCHING: Processing device ${imeiData.imei}`);

      const {
        minScore = 40, // Lower threshold for flexibility
        maxResults = 10,
        useFuzzyMatching = true,
        allowPartialMatches = true,
        strictMode = false
      } = options;

      // Strategy 1: Exact/High Confidence Matching
      let matches = await this.executeExactMatching(imeiData, minScore, maxResults);
      
      if (matches.length > 0 && !strictMode) {
        logger.info(`📊 FLEXIBLE MATCHING: Found ${matches.length} exact matches for device ${imeiData.imei}`);
        return this.formatResult(matches, 'high');
      }

      // Strategy 2: Flexible Pattern Matching
      if (allowPartialMatches) {
        matches = await this.executeFlexibleMatching(imeiData, Math.max(minScore - 10, 20), maxResults);
        
        if (matches.length > 0) {
          logger.info(`📊 FLEXIBLE MATCHING: Found ${matches.length} flexible matches for device ${imeiData.imei}`);
          return this.formatResult(matches, 'medium');
        }
      }

      // Strategy 3: Fuzzy Matching (for manual entries)
      if (useFuzzyMatching) {
        matches = await this.executeFuzzyMatching(imeiData, Math.max(minScore - 20, 15), maxResults);
        
        if (matches.length > 0) {
          logger.info(`📊 FLEXIBLE MATCHING: Found ${matches.length} fuzzy matches for device ${imeiData.imei}`);
          return this.formatResult(matches, 'low');
        }
      }

      // Strategy 4: Fallback Matching (very loose)
      matches = await this.executeFallbackMatching(imeiData, 10, maxResults);
      
      if (matches.length > 0) {
        logger.info(`📊 FLEXIBLE MATCHING: Found ${matches.length} fallback matches for device ${imeiData.imei}`);
        return this.formatResult(matches, 'very_low');
      }

      // No matches found - store for manual review
      logger.warn(`⚠️ NO MATCHES: Device ${imeiData.imei} - storing for manual review`);
      await this.storeForManualReview(imeiData, 'No matches found with any strategy');
      
      return {
        matches: [],
        requiresAttention: true,
        noMatchReason: 'No matches found with any strategy',
        confidence: 'very_low'
      };

    } catch (error) {
      logger.error(`❌ FLEXIBLE MATCHING: Error processing device ${imeiData.imei}:`, error);
      throw error;
    }
  }

  /**
   * Strategy 1: Exact/High Confidence Matching
   */
  private async executeExactMatching(imeiData: ImeiData, minScore: number, maxResults: number): Promise<any[]> {
    return await this.client.query(`
      WITH device_data AS (
        SELECT 
          $1::text as imei,
          $2::text as brand,
          $3::text as model,
          $4::text as capacity,
          $5::text as color,
          $6::text as carrier,
          $7::text as device_notes,
          -- Smart carrier parsing
          CASE 
            WHEN $7 ILIKE '%unlocked%' AND $6 ILIKE '%UNLOCKED%' THEN 'UNLOCKED'
            WHEN $7 ILIKE '%unlocked%' AND $6 NOT ILIKE '%UNLOCKED%' THEN $6
            WHEN $7 ILIKE '%locked%' AND $6 ILIKE '%UNLOCKED%' THEN $6
            WHEN $7 ILIKE '%locked%' AND $6 NOT ILIKE '%UNLOCKED%' THEN $6
            ELSE $6
          END as actual_carrier
      ),
      exact_matches AS (
        SELECT sm.*,
          -- High confidence scoring (exact matches get bonus points)
          (
            -- Brand matching (25 points)
            CASE 
              WHEN COALESCE(sm.brand, '') = '' OR COALESCE(dd.brand, '') = '' THEN 0
              WHEN LOWER(sm.brand) = LOWER(dd.brand) THEN 25
              WHEN LOWER(sm.brand) ILIKE '%' || LOWER(dd.brand) || '%' THEN 20
              ELSE 0 
            END +
            
            -- Model matching (30 points) - exact gets bonus
            CASE 
              WHEN COALESCE(sm.model, '') != '' AND COALESCE(dd.model, '') != '' 
                   AND LOWER(sm.model) = LOWER(dd.model) THEN 35
              WHEN COALESCE(sm.model, '') != '' AND COALESCE(dd.model, '') != '' 
                   AND LOWER(sm.model) ILIKE '%' || LOWER(dd.model) || '%' THEN 25
              WHEN (COALESCE(sm.model, '') = '') AND COALESCE(dd.model, '') != '' 
                   AND LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.model) || '%' THEN 25
              ELSE 0 
            END +
            
            -- Capacity matching (25 points)
            CASE 
              WHEN COALESCE(sm.capacity, '') = '' OR COALESCE(dd.capacity, '') = '' THEN 0
              WHEN LOWER(sm.capacity) = LOWER(dd.capacity) THEN 25
              WHEN LOWER(sm.capacity) ILIKE '%' || LOWER(dd.capacity) || '%' THEN 20
              ELSE 0 
            END +
            
            -- Color matching (20 points)
            CASE 
              WHEN COALESCE(sm.color, '') = '' OR COALESCE(dd.color, '') = '' THEN 0
              WHEN LOWER(sm.color) = LOWER(dd.color) THEN 20
              WHEN LOWER(sm.color) ILIKE '%' || LOWER(dd.color) || '%' THEN 15
              ELSE 0 
            END +
            
            -- Carrier matching (25 points)
            CASE 
              WHEN COALESCE(sm.carrier, '') = '' OR COALESCE(dd.actual_carrier, '') = '' THEN 0
              WHEN LOWER(sm.carrier) = LOWER(dd.actual_carrier) THEN 25
              WHEN LOWER(sm.carrier) ILIKE '%' || LOWER(dd.actual_carrier) || '%' THEN 20
              ELSE 0 
            END +
            
            -- Exact match bonus (15 points)
            CASE 
              WHEN LOWER(sm.brand) = LOWER(dd.brand) AND 
                   LOWER(sm.model) = LOWER(dd.model) AND 
                   LOWER(sm.capacity) = LOWER(dd.capacity) AND 
                   LOWER(sm.color) = LOWER(dd.color) AND 
                   LOWER(sm.carrier) = LOWER(dd.actual_carrier) THEN 15
              ELSE 0
            END
          ) as match_score
        FROM sku_master sm, device_data dd
        WHERE sm.is_active = true
        AND LENGTH(sm.sku_code) < 50
        AND (
          -- Pre-filter for better performance
          (COALESCE(sm.brand, '') = '' OR COALESCE(dd.brand, '') = '' OR 
           LOWER(sm.brand) ILIKE '%' || LOWER(dd.brand) || '%') AND
          (COALESCE(sm.model, '') = '' OR COALESCE(dd.model, '') = '' OR
           LOWER(sm.model) ILIKE '%' || LOWER(dd.model) || '%' OR
           LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.model) || '%')
        )
      )
      SELECT 
        sku_code, sku_tags, brand, model, capacity, color, carrier, post_fix, device_type,
        match_score,
        'exact' as match_type
      FROM exact_matches 
      WHERE match_score >= $8
      ORDER BY match_score DESC, sku_code
      LIMIT $9
    `, [
      imeiData.imei, imeiData.brand, imeiData.model, imeiData.capacity,
      imeiData.color, imeiData.carrier, imeiData.device_notes || '',
      minScore, maxResults
    ]);
  }

  /**
   * Strategy 2: Flexible Pattern Matching (handles manual entries)
   */
  private async executeFlexibleMatching(imeiData: ImeiData, minScore: number, maxResults: number): Promise<any[]> {
    return await this.client.query(`
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
            WHEN $7 ILIKE '%unlocked%' AND $6 ILIKE '%UNLOCKED%' THEN 'UNLOCKED'
            WHEN $7 ILIKE '%unlocked%' AND $6 NOT ILIKE '%UNLOCKED%' THEN $6
            WHEN $7 ILIKE '%locked%' AND $6 ILIKE '%UNLOCKED%' THEN $6
            WHEN $7 ILIKE '%locked%' AND $6 NOT ILIKE '%UNLOCKED%' THEN $6
            ELSE $6
          END as actual_carrier
      ),
      flexible_matches AS (
        SELECT sm.*,
          -- Flexible scoring (more lenient)
          (
            -- Brand matching (20 points) - more flexible
            CASE 
              WHEN COALESCE(sm.brand, '') = '' OR COALESCE(dd.brand, '') = '' THEN 5
              WHEN LOWER(sm.brand) = LOWER(dd.brand) THEN 20
              WHEN LOWER(sm.brand) ILIKE '%' || LOWER(dd.brand) || '%' THEN 15
              WHEN LOWER(dd.brand) ILIKE '%' || LOWER(sm.brand) || '%' THEN 15
              ELSE 0 
            END +
            
            -- Model matching (25 points) - very flexible for manual entries
            CASE 
              WHEN COALESCE(sm.model, '') != '' AND COALESCE(dd.model, '') != '' 
                   AND LOWER(sm.model) = LOWER(dd.model) THEN 25
              WHEN COALESCE(sm.model, '') != '' AND COALESCE(dd.model, '') != '' 
                   AND LOWER(sm.model) ILIKE '%' || LOWER(dd.model) || '%' THEN 20
              WHEN COALESCE(sm.model, '') != '' AND COALESCE(dd.model, '') != '' 
                   AND LOWER(dd.model) ILIKE '%' || LOWER(sm.model) || '%' THEN 20
              WHEN (COALESCE(sm.model, '') = '') AND COALESCE(dd.model, '') != '' 
                   AND LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.model) || '%' THEN 20
              WHEN COALESCE(dd.model, '') != '' 
                   AND LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.model) || '%' THEN 15
              ELSE 5
            END +
            
            -- Capacity matching (20 points) - flexible
            CASE 
              WHEN COALESCE(sm.capacity, '') = '' OR COALESCE(dd.capacity, '') = '' THEN 5
              WHEN LOWER(sm.capacity) = LOWER(dd.capacity) THEN 20
              WHEN LOWER(sm.capacity) ILIKE '%' || LOWER(dd.capacity) || '%' THEN 15
              WHEN LOWER(dd.capacity) ILIKE '%' || LOWER(sm.capacity) || '%' THEN 15
              ELSE 0 
            END +
            
            -- Color matching (15 points) - flexible
            CASE 
              WHEN COALESCE(sm.color, '') = '' OR COALESCE(dd.color, '') = '' THEN 5
              WHEN LOWER(sm.color) = LOWER(dd.color) THEN 15
              WHEN LOWER(sm.color) ILIKE '%' || LOWER(dd.color) || '%' THEN 10
              WHEN LOWER(dd.color) ILIKE '%' || LOWER(sm.color) || '%' THEN 10
              ELSE 0 
            END +
            
            -- Carrier matching (20 points) - flexible
            CASE 
              WHEN COALESCE(sm.carrier, '') = '' OR COALESCE(dd.actual_carrier, '') = '' THEN 5
              WHEN LOWER(sm.carrier) = LOWER(dd.actual_carrier) THEN 20
              WHEN LOWER(sm.carrier) ILIKE '%' || LOWER(dd.actual_carrier) || '%' THEN 15
              WHEN LOWER(dd.actual_carrier) ILIKE '%' || LOWER(sm.carrier) || '%' THEN 15
              ELSE 0 
            END +
            
            -- SKU code pattern matching (10 points) - for manual entries
            CASE 
              WHEN LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.brand) || '%' AND
                   LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.model) || '%' THEN 10
              WHEN LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.model) || '%' THEN 5
              ELSE 0
            END
          ) as match_score
        FROM sku_master sm, device_data dd
        WHERE sm.is_active = true
        AND LENGTH(sm.sku_code) < 50
      )
      SELECT 
        sku_code, sku_tags, brand, model, capacity, color, carrier, post_fix, device_type,
        match_score,
        'flexible' as match_type
      FROM flexible_matches 
      WHERE match_score >= $8
      ORDER BY match_score DESC, sku_code
      LIMIT $9
    `, [
      imeiData.imei, imeiData.brand, imeiData.model, imeiData.capacity,
      imeiData.color, imeiData.carrier, imeiData.device_notes || '',
      minScore, maxResults
    ]);
  }

  /**
   * Strategy 3: Fuzzy Matching (for very manual entries)
   */
  private async executeFuzzyMatching(imeiData: ImeiData, minScore: number, maxResults: number): Promise<any[]> {
    return await this.client.query(`
      WITH device_data AS (
        SELECT 
          $1::text as imei,
          $2::text as brand,
          $3::text as model,
          $4::text as capacity,
          $5::text as color,
          $6::text as carrier,
          $7::text as device_notes
      ),
      fuzzy_matches AS (
        SELECT sm.*,
          -- Fuzzy scoring (very lenient)
          (
            -- Brand fuzzy matching (15 points)
            CASE 
              WHEN COALESCE(sm.brand, '') = '' OR COALESCE(dd.brand, '') = '' THEN 10
              WHEN LOWER(sm.brand) = LOWER(dd.brand) THEN 15
              WHEN LOWER(sm.brand) ILIKE '%' || LOWER(dd.brand) || '%' THEN 12
              WHEN LOWER(dd.brand) ILIKE '%' || LOWER(sm.brand) || '%' THEN 12
              WHEN LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.brand) || '%' THEN 10
              ELSE 5
            END +
            
            -- Model fuzzy matching (20 points) - very flexible
            CASE 
              WHEN COALESCE(dd.model, '') != '' AND LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.model) || '%' THEN 20
              WHEN COALESCE(sm.model, '') != '' AND COALESCE(dd.model, '') != '' 
                   AND LOWER(sm.model) ILIKE '%' || LOWER(dd.model) || '%' THEN 15
              WHEN COALESCE(dd.model, '') != '' AND LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.model) || '%' THEN 15
              ELSE 10
            END +
            
            -- Capacity fuzzy matching (15 points)
            CASE 
              WHEN COALESCE(sm.capacity, '') = '' OR COALESCE(dd.capacity, '') = '' THEN 8
              WHEN LOWER(sm.capacity) = LOWER(dd.capacity) THEN 15
              WHEN LOWER(sm.capacity) ILIKE '%' || LOWER(dd.capacity) || '%' THEN 12
              WHEN LOWER(dd.capacity) ILIKE '%' || LOWER(sm.capacity) || '%' THEN 12
              WHEN LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.capacity) || '%' THEN 10
              ELSE 5
            END +
            
            -- Color fuzzy matching (10 points)
            CASE 
              WHEN COALESCE(sm.color, '') = '' OR COALESCE(dd.color, '') = '' THEN 5
              WHEN LOWER(sm.color) = LOWER(dd.color) THEN 10
              WHEN LOWER(sm.color) ILIKE '%' || LOWER(dd.color) || '%' THEN 8
              WHEN LOWER(dd.color) ILIKE '%' || LOWER(sm.color) || '%' THEN 8
              WHEN LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.color) || '%' THEN 5
              ELSE 0
            END +
            
            -- Carrier fuzzy matching (15 points)
            CASE 
              WHEN COALESCE(sm.carrier, '') = '' OR COALESCE(dd.carrier, '') = '' THEN 8
              WHEN LOWER(sm.carrier) = LOWER(dd.carrier) THEN 15
              WHEN LOWER(sm.carrier) ILIKE '%' || LOWER(dd.carrier) || '%' THEN 12
              WHEN LOWER(dd.carrier) ILIKE '%' || LOWER(sm.carrier) || '%' THEN 12
              WHEN LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.carrier) || '%' THEN 10
              ELSE 5
            END +
            
            -- SKU code similarity (15 points) - for manual entries
            CASE 
              WHEN LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.brand) || '%' AND
                   LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.model) || '%' AND
                   LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.capacity) || '%' THEN 15
              WHEN LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.brand) || '%' AND
                   LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.model) || '%' THEN 10
              WHEN LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.model) || '%' THEN 8
              ELSE 0
            END
          ) as match_score
        FROM sku_master sm, device_data dd
        WHERE sm.is_active = true
        AND LENGTH(sm.sku_code) < 50
      )
      SELECT 
        sku_code, sku_tags, brand, model, capacity, color, carrier, post_fix, device_type,
        match_score,
        'fuzzy' as match_type
      FROM fuzzy_matches 
      WHERE match_score >= $8
      ORDER BY match_score DESC, sku_code
      LIMIT $9
    `, [
      imeiData.imei, imeiData.brand, imeiData.model, imeiData.capacity,
      imeiData.color, imeiData.carrier, imeiData.device_notes || '',
      minScore, maxResults
    ]);
  }

  /**
   * Strategy 4: Fallback Matching (very loose)
   */
  private async executeFallbackMatching(imeiData: ImeiData, minScore: number, maxResults: number): Promise<any[]> {
    return await this.client.query(`
      WITH device_data AS (
        SELECT 
          $1::text as imei,
          $2::text as brand,
          $3::text as model,
          $4::text as capacity,
          $5::text as color,
          $6::text as carrier
      ),
      fallback_matches AS (
        SELECT sm.*,
          -- Fallback scoring (very loose)
          (
            -- Any brand match (10 points)
            CASE 
              WHEN COALESCE(sm.brand, '') = '' OR COALESCE(dd.brand, '') = '' THEN 5
              WHEN LOWER(sm.brand) ILIKE '%' || LOWER(dd.brand) || '%' OR
                   LOWER(dd.brand) ILIKE '%' || LOWER(sm.brand) || '%' OR
                   LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.brand) || '%' THEN 10
              ELSE 0
            END +
            
            -- Any model match (15 points)
            CASE 
              WHEN COALESCE(dd.model, '') != '' AND (
                LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.model) || '%' OR
                (COALESCE(sm.model, '') != '' AND LOWER(sm.model) ILIKE '%' || LOWER(dd.model) || '%')
              ) THEN 15
              ELSE 5
            END +
            
            -- Any capacity match (10 points)
            CASE 
              WHEN COALESCE(sm.capacity, '') = '' OR COALESCE(dd.capacity, '') = '' THEN 5
              WHEN LOWER(sm.capacity) ILIKE '%' || LOWER(dd.capacity) || '%' OR
                   LOWER(dd.capacity) ILIKE '%' || LOWER(sm.capacity) || '%' OR
                   LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.capacity) || '%' THEN 10
              ELSE 0
            END +
            
            -- Any color match (8 points)
            CASE 
              WHEN COALESCE(sm.color, '') = '' OR COALESCE(dd.color, '') = '' THEN 3
              WHEN LOWER(sm.color) ILIKE '%' || LOWER(dd.color) || '%' OR
                   LOWER(dd.color) ILIKE '%' || LOWER(sm.color) || '%' OR
                   LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.color) || '%' THEN 8
              ELSE 0
            END +
            
            -- Any carrier match (10 points)
            CASE 
              WHEN COALESCE(sm.carrier, '') = '' OR COALESCE(dd.carrier, '') = '' THEN 5
              WHEN LOWER(sm.carrier) ILIKE '%' || LOWER(dd.carrier) || '%' OR
                   LOWER(dd.carrier) ILIKE '%' || LOWER(sm.carrier) || '%' OR
                   LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.carrier) || '%' THEN 10
              ELSE 0
            END +
            
            -- SKU code contains multiple device elements (12 points)
            CASE 
              WHEN LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.brand) || '%' AND
                   LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.model) || '%' THEN 12
              WHEN LOWER(sm.sku_code) ILIKE '%' || LOWER(dd.model) || '%' THEN 8
              ELSE 0
            END
          ) as match_score
        FROM sku_master sm, device_data dd
        WHERE sm.is_active = true
        AND LENGTH(sm.sku_code) < 50
      )
      SELECT 
        sku_code, sku_tags, brand, model, capacity, color, carrier, post_fix, device_type,
        match_score,
        'fallback' as match_type
      FROM fallback_matches 
      WHERE match_score >= $7
      ORDER BY match_score DESC, sku_code
      LIMIT $8
    `, [
      imeiData.imei, imeiData.brand, imeiData.model, imeiData.capacity,
      imeiData.color, imeiData.carrier, minScore, maxResults
    ]);
  }

  /**
   * Format results consistently
   */
  private formatResult(matches: any[], confidence: 'high' | 'medium' | 'low' | 'very_low'): MatchResult {
    const formattedMatches = matches.map(row => ({
      sku: row,
      score: row.match_score,
      totalScore: row.match_score,
      matchedCharacteristics: this.getMatchedCharacteristics(row),
      method: `flexible_${row.match_type}`,
      confidence: confidence,
      matchType: row.match_type
    }));

    return {
      matches: formattedMatches,
      requiresAttention: confidence === 'low' || confidence === 'very_low',
      confidence: confidence
    };
  }

  /**
   * Get matched characteristics from SKU
   */
  private getMatchedCharacteristics(sku: any): string[] {
    const characteristics = [];
    if (sku.match_score >= 15) characteristics.push('brand');
    if (sku.match_score >= 25) characteristics.push('model');
    if (sku.match_score >= 40) characteristics.push('capacity');
    if (sku.match_score >= 55) characteristics.push('color');
    if (sku.match_score >= 70) characteristics.push('carrier');
    return characteristics;
  }

  /**
   * Store device for manual review
   */
  private async storeForManualReview(imeiData: ImeiData, reason: string): Promise<void> {
    try {
      await this.client.query(`
        INSERT INTO no_match_queue (
          imei, brand, model, capacity, color, carrier, device_notes, original_sku,
          fallback_reason, status, priority, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', 1, NOW(), NOW()
        )
        ON CONFLICT (imei) DO UPDATE SET
          brand = EXCLUDED.brand,
          model = EXCLUDED.model,
          capacity = EXCLUDED.capacity,
          color = EXCLUDED.color,
          carrier = EXCLUDED.carrier,
          device_notes = EXCLUDED.device_notes,
          original_sku = EXCLUDED.original_sku,
          fallback_reason = EXCLUDED.fallback_reason,
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
        reason
      ]);
    } catch (error) {
      logger.error(`❌ Error storing device for manual review:`, error);
    }
  }

  /**
   * Load normalization cache for performance
   */
  private async loadNormalizationCache(): Promise<void> {
    try {
      const result = await this.client.query(`
        SELECT category, input_value, normalized_value, tags, is_postfix, priority
        FROM normalization_tags
        WHERE is_active = true
        ORDER BY priority DESC
      `);

      this.normalizationCache.clear();
      result.rows.forEach((row: any) => {
        const key = `${row.category}:${row.input_value.toLowerCase()}`;
        this.normalizationCache.set(key, row);
      });

      logger.info(`📊 Loaded ${this.normalizationCache.size} normalization rules into cache`);
    } catch (error) {
      logger.error('❌ Error loading normalization cache:', error);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.client) {
      await this.client.release();
    }
    if (this.pool) {
      await this.pool.end();
    }
  }
}
