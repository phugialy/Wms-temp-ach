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
}

export class ImprovedSkuMatchingService {
  private pool!: Pool;
  private client: any;

  async initialize(): Promise<void> {
    try {
      this.pool = new Pool({
        connectionString: process.env['DIRECT_URL'],
        connectionTimeoutMillis: 10000,
      });
      
      this.client = await this.pool.connect();
      logger.info('✅ Improved SKU Matching Service initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize Improved SKU Matching Service:', error);
      throw error;
    }
  }

  /**
   * Improved SKU matching with fixed CTE query logic
   */
  async matchImeiToSku(imeiData: ImeiData, options: any = {}): Promise<MatchResult> {
    try {
      logger.info(`🔍 IMPROVED MATCHING: Processing device ${imeiData.imei}`);

      // Validate input data
      const validationResult = this.validateInputData(imeiData);
      if (!validationResult.isValid) {
        logger.warn(`⚠️ INVALID DATA: Device ${imeiData.imei} - ${validationResult.reason}`);
        return await this.handleInsufficientDataScenario(imeiData, validationResult.reason || 'Unknown validation error');
      }

      // Execute improved CTE query
      const result = await this.executeImprovedQuery(imeiData, options);

      // Process results
      const matches = result.rows.map((row: any) => ({
        sku: row,
        score: row.match_score,
        totalScore: row.match_score,
        matchedCharacteristics: this.getMatchedCharacteristics(row),
        method: 'improved_postgresql_query',
        confidence: row.confidence_level,
        dataCompleteness: row.data_completeness
      }));

      logger.info(`📊 IMPROVED MATCHING: Found ${matches.length} matches for device ${imeiData.imei}`);

      // Handle no matches
      if (matches.length === 0) {
        logger.warn(`⚠️ NO MATCHES: Device ${imeiData.imei} - applying fallback logic`);
        return await this.handleNoMatchScenario(imeiData);
      }

      // Check confidence levels
      const bestMatch = matches[0];
      if (bestMatch.confidence === 'low_confidence') {
        logger.warn(`⚠️ LOW CONFIDENCE: Device ${imeiData.imei} - score: ${bestMatch.totalScore}`);
      }

      return {
        matches,
        requiresAttention: matches.length === 0 || bestMatch.confidence === 'low_confidence'
      };

    } catch (error) {
      logger.error(`❌ IMPROVED MATCHING: Error processing device ${imeiData.imei}:`, error);
      throw error;
    }
  }

  /**
   * Execute improved CTE query with fixed logic
   */
  private async executeImprovedQuery(imeiData: ImeiData, options: any) {
    const minScore = options.minScore || 50;
    const maxResults = options.maxResults || 10;

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
          -- Improved carrier parsing with validation
          CASE 
            WHEN $7 ILIKE '%unlocked%' AND $6 ILIKE '%UNLOCKED%' THEN 'UNLOCKED'
            WHEN $7 ILIKE '%unlocked%' AND $6 NOT ILIKE '%UNLOCKED%' THEN $6 -- Keep original
            WHEN $7 ILIKE '%locked%' AND $6 ILIKE '%UNLOCKED%' THEN $6 -- Keep original  
            WHEN $7 ILIKE '%locked%' AND $6 NOT ILIKE '%UNLOCKED%' THEN $6
            ELSE $6
          END as actual_carrier,
          -- Calculate data completeness
          (
            CASE WHEN COALESCE($2, '') != '' THEN 1 ELSE 0 END +
            CASE WHEN COALESCE($3, '') != '' THEN 1 ELSE 0 END +
            CASE WHEN COALESCE($4, '') != '' THEN 1 ELSE 0 END +
            CASE WHEN COALESCE($5, '') != '' THEN 1 ELSE 0 END +
            CASE WHEN COALESCE($6, '') != '' THEN 1 ELSE 0 END
          ) as data_completeness
      ),
      -- Pre-filter SKU master to reduce cross join size
      filtered_skus AS (
        SELECT sm.*
        FROM sku_master sm
        WHERE sm.is_active = true
        AND LENGTH(sm.sku_code) < 50
        AND (
          -- Initial brand filter
          (COALESCE(sm.brand, '') = '' OR COALESCE($2, '') = '' OR 
           LOWER(sm.brand) ILIKE '%' || LOWER($2) || '%') AND
          -- Initial model filter  
          (COALESCE(sm.model, '') = '' OR COALESCE($3, '') = '' OR
           LOWER(sm.model) ILIKE '%' || LOWER($3) || '%' OR
           LOWER(sm.sku_code) ILIKE '%' || LOWER($3) || '%')
        )
      ),
      matching_skus AS (
        SELECT fs.*,
          -- Improved match score calculation with better weights
          (
            -- Brand matching (25 points) - reduced weight
            CASE 
              WHEN COALESCE(fs.brand, '') = '' OR COALESCE(dd.brand, '') = '' THEN 0
              WHEN LOWER(fs.brand) = LOWER(dd.brand) THEN 25 
              WHEN LOWER(fs.brand) ILIKE '%' || LOWER(dd.brand) || '%' THEN 15 
              ELSE 0 
            END +
            
            -- Model matching (30 points) - improved logic
            CASE 
              -- Exact model match (highest priority)
              WHEN COALESCE(fs.model, '') != '' AND COALESCE(dd.model, '') != '' 
                   AND LOWER(fs.model) = LOWER(dd.model) THEN 30
              
              -- Partial model match in model field
              WHEN COALESCE(fs.model, '') != '' AND COALESCE(dd.model, '') != '' 
                   AND LOWER(fs.model) ILIKE '%' || LOWER(dd.model) || '%' THEN 25
              
              -- Model match in SKU code (for empty model fields)
              WHEN (COALESCE(fs.model, '') = '') AND COALESCE(dd.model, '') != '' 
                   AND LOWER(fs.sku_code) ILIKE '%' || LOWER(dd.model) || '%' THEN 25
              
              -- Improved complex model matching with safer regex
              WHEN COALESCE(dd.model, '') != '' THEN
                CASE 
                  -- Samsung S-series matching (S23, S24, S25, etc.)
                  WHEN LOWER(dd.model) ~ 's\d+' AND LOWER(fs.sku_code) ~ 's\d+' THEN
                    CASE 
                      -- Extract and compare model numbers safely
                      WHEN LOWER(fs.sku_code) ~ 's' || regexp_replace(LOWER(dd.model), '.*s(\d+).*', '\\1', 'g') || '[^0-9]' THEN 30
                      WHEN LOWER(fs.sku_code) ILIKE '%' || LOWER(dd.model) || '%' THEN 25
                      ELSE 0 
                    END
                  -- Samsung TAB models
                  WHEN LOWER(dd.model) ILIKE '%tab%' AND LOWER(fs.sku_code) ILIKE '%tab%' THEN
                    CASE 
                      WHEN LOWER(fs.sku_code) ILIKE '%' || LOWER(dd.model) || '%' THEN 30
                      ELSE 0 
                    END
                  -- ULTRA models
                  WHEN LOWER(dd.model) ILIKE '%ultra%' AND LOWER(fs.sku_code) ILIKE '%ultra%' THEN
                    CASE WHEN LOWER(fs.sku_code) ILIKE '%' || LOWER(dd.model) || '%' THEN 25 ELSE 0 END
                  -- iPhone models
                  WHEN LOWER(dd.model) ILIKE '%iphone%' AND LOWER(fs.sku_code) ILIKE '%iphone%' THEN
                    CASE WHEN LOWER(fs.sku_code) ILIKE '%' || LOWER(dd.model) || '%' THEN 25 ELSE 0 END
                  -- General partial match in SKU code
                  WHEN LOWER(fs.sku_code) ILIKE '%' || LOWER(dd.model) || '%' THEN 20
                  ELSE 0
                END
              ELSE 0 
            END +
            
            -- Capacity matching (25 points) - same weight
            CASE 
              WHEN COALESCE(fs.capacity, '') = '' OR COALESCE(dd.capacity, '') = '' THEN 0
              WHEN LOWER(fs.capacity) = LOWER(dd.capacity) THEN 25 
              WHEN LOWER(fs.capacity) ILIKE '%' || LOWER(dd.capacity) || '%' THEN 20 
              ELSE 0 
            END +
            
            -- Color matching (20 points) - same weight
            CASE 
              WHEN COALESCE(fs.color, '') = '' OR COALESCE(dd.color, '') = '' THEN 0
              WHEN LOWER(fs.color) = LOWER(dd.color) THEN 20 
              WHEN LOWER(fs.color) ILIKE '%' || LOWER(dd.color) || '%' THEN 15 
              ELSE 0 
            END +
            
            -- Carrier matching (30 points) - increased weight
            CASE 
              WHEN COALESCE(fs.carrier, '') = '' OR COALESCE(dd.actual_carrier, '') = '' THEN 0
              WHEN LOWER(fs.carrier) = LOWER(dd.actual_carrier) THEN 30 
              WHEN LOWER(fs.carrier) ILIKE '%' || LOWER(dd.actual_carrier) || '%' THEN 20 
              ELSE 0 
            END +
            
            -- Data completeness bonus (10 points)
            CASE 
              WHEN dd.data_completeness >= 4 THEN 10
              WHEN dd.data_completeness >= 3 THEN 5
              ELSE 0
            END
          ) as match_score,
          dd.data_completeness
        FROM filtered_skus fs, device_data dd
      )
      SELECT 
        sku_code, sku_tags, brand, model, capacity, color, carrier, post_fix, device_type,
        match_score,
        data_completeness,
        -- Improved confidence calculation
        CASE 
          WHEN match_score >= 80 AND data_completeness >= 4 THEN 'high_confidence'
          WHEN match_score >= 60 AND data_completeness >= 3 THEN 'medium_confidence'
          WHEN match_score >= 50 THEN 'low_confidence'
          ELSE 'no_confidence'
        END as confidence_level
      FROM matching_skus 
      WHERE match_score >= $8
      AND (
        -- Simplified filtering logic
        LOWER(sku_code) ILIKE '%' || LOWER($3) || '%' OR
        (COALESCE(model, '') != '' AND LOWER(model) ILIKE '%' || LOWER($3) || '%')
      )
      ORDER BY match_score DESC, data_completeness DESC, sku_code
      LIMIT $9
    `, [
      imeiData.imei,
      imeiData.brand,
      imeiData.model,
      imeiData.capacity,
      imeiData.color,
      imeiData.carrier,
      imeiData.device_notes || '',
      minScore,
      maxResults
    ]);
  }

  /**
   * Validate input data quality
   */
  private validateInputData(imeiData: ImeiData): { isValid: boolean; reason?: string } {
    const nullFields = [];
    
    if (!imeiData.brand || imeiData.brand.trim() === '') nullFields.push('brand');
    if (!imeiData.model || imeiData.model.trim() === '') nullFields.push('model');
    if (!imeiData.capacity || imeiData.capacity.trim() === '') nullFields.push('capacity');
    if (!imeiData.color || imeiData.color.trim() === '') nullFields.push('color');
    if (!imeiData.carrier || imeiData.carrier.trim() === '') nullFields.push('carrier');
    
    // Critical fields check
    if (nullFields.includes('brand') && nullFields.includes('model')) {
      return { isValid: false, reason: 'Missing critical fields: brand and model' };
    }
    
    if (nullFields.includes('brand') && nullFields.length >= 3) {
      return { isValid: false, reason: `Missing brand and ${nullFields.length - 1} other fields` };
    }
    
    if (nullFields.length >= 4) {
      return { isValid: false, reason: `Too many missing fields: ${nullFields.join(', ')}` };
    }
    
    return { isValid: true };
  }

  /**
   * Get matched characteristics from SKU
   */
  private getMatchedCharacteristics(sku: any): string[] {
    const characteristics = [];
    if (sku.match_score >= 20) characteristics.push('brand');
    if (sku.match_score >= 40) characteristics.push('model');
    if (sku.match_score >= 60) characteristics.push('capacity');
    if (sku.match_score >= 80) characteristics.push('color');
    if (sku.match_score >= 100) characteristics.push('carrier');
    return characteristics;
  }

  /**
   * Handle insufficient data scenarios
   */
  private async handleInsufficientDataScenario(imeiData: ImeiData, reason: string): Promise<MatchResult> {
    try {
      logger.info(`🔄 INSUFFICIENT DATA: Storing device ${imeiData.imei} in undefined_sku table`);

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

      return {
        matches: [],
        requiresAttention: true,
        noMatchReason: reason
      };

    } catch (error) {
      logger.error(`❌ INSUFFICIENT DATA: Error storing device ${imeiData.imei}:`, error);
      return {
        matches: [],
        requiresAttention: true,
        noMatchReason: `Failed to store: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Handle no-match scenarios
   */
  private async handleNoMatchScenario(imeiData: ImeiData): Promise<MatchResult> {
    try {
      logger.info(`🔄 NO-MATCH: Storing device ${imeiData.imei} in no-match queue`);

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
        'No matches found with improved query'
      ]);

      return {
        matches: [],
        requiresAttention: true,
        noMatchReason: 'Device stored in no-match queue for manual SKU creation'
      };

    } catch (error) {
      logger.error(`❌ NO-MATCH: Error storing device ${imeiData.imei}:`, error);
      return {
        matches: [],
        requiresAttention: true,
        noMatchReason: 'Failed to store in no-match queue'
      };
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
