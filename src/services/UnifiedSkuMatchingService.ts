import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { DatabaseConnectionService } from './DatabaseConnectionService';

export interface FlexibleDeviceInput {
  imei: string;
  brand?: string;
  model?: string;
  capacity?: string;
  color?: string;
  carrier?: string;
  device_notes?: string;
  working_status?: string;
  battery_health?: string;
  source?: 'bulk-add' | 'phonecheck-add' | 'manual' | 'api';
}

export interface UnifiedMatchResult {
  imei: string;
  matches: SkuMatch[];
  bestMatch?: SkuMatch;
  totalMatches: number;
  highestScore: number;
  confidenceLevel: 'high' | 'medium' | 'low' | 'very_low';
  requiresAttention: boolean;
  processingTime: number;
  dataCompleteness: number;
}

export interface SkuMatch {
  sku_code: string;
  brand: string;
  model: string;
  capacity: string;
  color: string;
  carrier: string;
  match_score: number;
  confidence_level: string;
  match_type: string;
  matched_characteristics: string[];
}

export class UnifiedSkuMatchingService {
  private dbService: DatabaseConnectionService;
  private cache: Map<string, UnifiedMatchResult> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.dbService = DatabaseConnectionService.getInstance();
  }

  /**
   * Main entry point - handles all SKU matching scenarios
   */
  async matchDevice(deviceData: FlexibleDeviceInput, options: MatchOptions = {}): Promise<UnifiedMatchResult> {
    const startTime = Date.now();
    
    try {
      // Validate input
      if (!deviceData.imei) {
        throw new Error('IMEI is required');
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(deviceData);
      const cachedResult = this.getCachedResult(cacheKey);
      if (cachedResult) {
        logger.info(`⚡ CACHE HIT: Returning cached result for ${deviceData.imei}`);
        return cachedResult;
      }

      logger.info(`🔍 UNIFIED MATCHING: Processing device ${deviceData.imei}`);

      // Normalize device data
      const normalizedDevice = this.normalizeDeviceData(deviceData);
      
      // Calculate data completeness
      const dataCompleteness = this.calculateDataCompleteness(normalizedDevice);
      
      // Select matching strategy based on available data
      const strategy = this.selectMatchingStrategy(normalizedDevice, dataCompleteness);
      
      // Execute matching
      const matches = await this.executeMatching(normalizedDevice, strategy, options);
      
      // Post-process and rank results
      const rankedMatches = this.rankMatches(matches, normalizedDevice);
      
      // Build result
      const result = this.buildResult(rankedMatches, normalizedDevice, startTime, dataCompleteness);
      
      // Cache result
      this.setCachedResult(cacheKey, result);
      
      return result;

    } catch (error) {
      logger.error(`❌ UNIFIED MATCHING ERROR: ${deviceData.imei}`, error);
      throw error;
    }
  }

  /**
   * Normalize device data for consistent processing
   */
  private normalizeDeviceData(device: FlexibleDeviceInput): NormalizedDeviceData {
    return {
      imei: device.imei,
      brand: this.normalizeBrand(device.brand),
      model: this.normalizeModel(device.model),
      capacity: this.normalizeCapacity(device.capacity),
      color: this.normalizeColor(device.color),
      carrier: this.normalizeCarrier(device.carrier),
      device_notes: device.device_notes || '',
      working_status: device.working_status || '',
      battery_health: device.battery_health || '',
      source: device.source || 'api'
    };
  }

  /**
   * Calculate data completeness (0-1 scale)
   */
  private calculateDataCompleteness(device: NormalizedDeviceData): number {
    const fields: (keyof NormalizedDeviceData)[] = ['brand', 'model', 'capacity', 'color', 'carrier'];
    const availableFields = fields.filter(field => device[field] && device[field].trim() !== '');
    return availableFields.length / fields.length;
  }

  /**
   * Select matching strategy based on available data
   */
  private selectMatchingStrategy(device: NormalizedDeviceData, completeness: number): MatchingStrategy {
    if (completeness >= 0.8) return 'exact_matching';
    if (completeness >= 0.6) return 'fuzzy_matching';
    if (completeness >= 0.4) return 'partial_matching';
    return 'fallback_matching';
  }

  /**
   * Execute matching with selected strategy
   */
  private async executeMatching(device: NormalizedDeviceData, strategy: MatchingStrategy, options: MatchOptions): Promise<SkuMatch[]> {
    const minScore = options.minScore || 40;
    const maxResults = options.maxResults || 10;

    let query: string;
    let params: any[];

    switch (strategy) {
      case 'exact_matching':
        query = this.buildExactMatchingQuery();
        params = this.buildExactMatchingParams(device, minScore, maxResults);
        break;
      case 'fuzzy_matching':
        query = this.buildFuzzyMatchingQuery();
        params = this.buildFuzzyMatchingParams(device, minScore, maxResults);
        break;
      case 'partial_matching':
        query = this.buildPartialMatchingQuery();
        params = this.buildPartialMatchingParams(device, minScore, maxResults);
        break;
      case 'fallback_matching':
        query = this.buildFallbackMatchingQuery();
        params = this.buildFallbackMatchingParams(device, minScore, maxResults);
        break;
      default:
        throw new Error(`Unknown matching strategy: ${strategy}`);
    }

    const result = await this.dbService.query(query, params);
    return result.rows.map((row: any) => this.mapRowToSkuMatch(row));
  }

  /**
   * Build exact matching query for high-quality data
   */
  private buildExactMatchingQuery(): string {
    return `
      SELECT 
        sm.sku_code,
        sm.brand,
        sm.model,
        sm.capacity,
        sm.color,
        sm.carrier,
        sm.sku_tags,
        -- Exact matching scoring
        (
          CASE WHEN LOWER(sm.brand) = LOWER($2) THEN 30 ELSE 0 END +
          CASE WHEN LOWER(sm.model) = LOWER($3) THEN 35 ELSE 0 END +
          CASE WHEN LOWER(sm.capacity) = LOWER($4) THEN 25 ELSE 0 END +
          CASE WHEN LOWER(sm.color) = LOWER($5) THEN 20 ELSE 0 END +
          CASE WHEN LOWER(sm.carrier) = LOWER($6) THEN 15 ELSE 0 END
        ) as match_score,
        'exact' as match_type,
        'high_confidence' as confidence_level
      FROM sku_master sm
      WHERE sm.is_active = true
        AND LOWER(sm.brand) = LOWER($2)
        AND LOWER(sm.model) = LOWER($3)
        AND LOWER(sm.capacity) = LOWER($4)
        AND LOWER(sm.color) = LOWER($5)
        AND LOWER(sm.carrier) = LOWER($6)
      ORDER BY match_score DESC
      LIMIT $7
    `;
  }

  /**
   * Build fuzzy matching query for medium-quality data
   */
  private buildFuzzyMatchingQuery(): string {
    return `
      SELECT 
        sm.sku_code,
        sm.brand,
        sm.model,
        sm.capacity,
        sm.color,
        sm.carrier,
        sm.sku_tags,
        -- Fuzzy matching scoring
        (
          CASE WHEN LOWER(sm.brand) = LOWER($2) THEN 30 ELSE 0 END +
          CASE WHEN LOWER(sm.brand) ILIKE '%' || LOWER($2) || '%' THEN 20 ELSE 0 END +
          CASE WHEN LOWER(sm.model) = LOWER($3) THEN 35 ELSE 0 END +
          CASE WHEN LOWER(sm.model) ILIKE '%' || LOWER($3) || '%' THEN 25 ELSE 0 END +
          CASE WHEN LOWER(sm.capacity) = LOWER($4) THEN 25 ELSE 0 END +
          CASE WHEN LOWER(sm.capacity) ILIKE '%' || LOWER($4) || '%' THEN 15 ELSE 0 END +
          CASE WHEN LOWER(sm.color) = LOWER($5) THEN 20 ELSE 0 END +
          CASE WHEN LOWER(sm.color) ILIKE '%' || LOWER($5) || '%' THEN 10 ELSE 0 END +
          CASE WHEN LOWER(sm.carrier) = LOWER($6) THEN 15 ELSE 0 END +
          CASE WHEN LOWER(sm.carrier) ILIKE '%' || LOWER($6) || '%' THEN 8 ELSE 0 END
        ) as match_score,
        'fuzzy' as match_type,
        'medium_confidence' as confidence_level
      FROM sku_master sm
      WHERE sm.is_active = true
        AND (
          LOWER(sm.brand) = LOWER($2) OR LOWER(sm.brand) ILIKE '%' || LOWER($2) || '%' OR
          LOWER(sm.model) = LOWER($3) OR LOWER(sm.model) ILIKE '%' || LOWER($3) || '%' OR
          LOWER(sm.capacity) = LOWER($4) OR LOWER(sm.capacity) ILIKE '%' || LOWER($4) || '%'
        )
      ORDER BY match_score DESC
      LIMIT $7
    `;
  }

  /**
   * Build partial matching query for low-quality data
   */
  private buildPartialMatchingQuery(): string {
    return `
      SELECT 
        sm.sku_code,
        sm.brand,
        sm.model,
        sm.capacity,
        sm.color,
        sm.carrier,
        sm.sku_tags,
        -- Partial matching scoring
        (
          CASE WHEN LOWER(sm.brand) ILIKE '%' || LOWER($2) || '%' THEN 25 ELSE 0 END +
          CASE WHEN LOWER(sm.model) ILIKE '%' || LOWER($3) || '%' THEN 30 ELSE 0 END +
          CASE WHEN LOWER(sm.capacity) ILIKE '%' || LOWER($4) || '%' THEN 20 ELSE 0 END +
          CASE WHEN LOWER(sm.color) ILIKE '%' || LOWER($5) || '%' THEN 15 ELSE 0 END +
          CASE WHEN LOWER(sm.carrier) ILIKE '%' || LOWER($6) || '%' THEN 10 ELSE 0 END
        ) as match_score,
        'partial' as match_type,
        'low_confidence' as confidence_level
      FROM sku_master sm
      WHERE sm.is_active = true
        AND (
          LOWER(sm.brand) ILIKE '%' || LOWER($2) || '%' OR
          LOWER(sm.model) ILIKE '%' || LOWER($3) || '%' OR
          LOWER(sm.capacity) ILIKE '%' || LOWER($4) || '%' OR
          LOWER(sm.color) ILIKE '%' || LOWER($5) || '%' OR
          LOWER(sm.carrier) ILIKE '%' || LOWER($6) || '%'
        )
      ORDER BY match_score DESC
      LIMIT $7
    `;
  }

  /**
   * Build fallback matching query for minimal data
   */
  private buildFallbackMatchingQuery(): string {
    return `
      SELECT 
        sm.sku_code,
        sm.brand,
        sm.model,
        sm.capacity,
        sm.color,
        sm.carrier,
        sm.sku_tags,
        -- Fallback matching scoring
        (
          CASE WHEN LOWER(sm.brand) ILIKE '%' || LOWER($2) || '%' THEN 20 ELSE 0 END +
          CASE WHEN LOWER(sm.model) ILIKE '%' || LOWER($3) || '%' THEN 25 ELSE 0 END +
          CASE WHEN LOWER(sm.capacity) ILIKE '%' || LOWER($4) || '%' THEN 15 ELSE 0 END +
          CASE WHEN LOWER(sm.color) ILIKE '%' || LOWER($5) || '%' THEN 10 ELSE 0 END +
          CASE WHEN LOWER(sm.carrier) ILIKE '%' || LOWER($6) || '%' THEN 5 ELSE 0 END
        ) as match_score,
        'fallback' as match_type,
        'very_low_confidence' as confidence_level
      FROM sku_master sm
      WHERE sm.is_active = true
      ORDER BY match_score DESC
      LIMIT $7
    `;
  }

  /**
   * Build query parameters for exact matching
   */
  private buildExactMatchingParams(device: NormalizedDeviceData, minScore: number, maxResults: number): any[] {
    return [
      device.imei,
      device.brand || '',
      device.model || '',
      device.capacity || '',
      device.color || '',
      device.carrier || '',
      maxResults
    ];
  }

  /**
   * Build query parameters for fuzzy matching
   */
  private buildFuzzyMatchingParams(device: NormalizedDeviceData, minScore: number, maxResults: number): any[] {
    return [
      device.imei,
      device.brand || '',
      device.model || '',
      device.capacity || '',
      device.color || '',
      device.carrier || '',
      maxResults
    ];
  }

  /**
   * Build query parameters for partial matching
   */
  private buildPartialMatchingParams(device: NormalizedDeviceData, minScore: number, maxResults: number): any[] {
    return [
      device.imei,
      device.brand || '',
      device.model || '',
      device.capacity || '',
      device.color || '',
      device.carrier || '',
      maxResults
    ];
  }

  /**
   * Build query parameters for fallback matching
   */
  private buildFallbackMatchingParams(device: NormalizedDeviceData, minScore: number, maxResults: number): any[] {
    return [
      device.imei,
      device.brand || '',
      device.model || '',
      device.capacity || '',
      device.color || '',
      device.carrier || '',
      maxResults
    ];
  }

  /**
   * Map database row to SkuMatch object
   */
  private mapRowToSkuMatch(row: any): SkuMatch {
    return {
      sku_code: row.sku_code,
      brand: row.brand,
      model: row.model,
      capacity: row.capacity,
      color: row.color,
      carrier: row.carrier,
      match_score: row.match_score,
      confidence_level: row.confidence_level,
      match_type: row.match_type,
      matched_characteristics: this.extractMatchedCharacteristics(row)
    };
  }

  /**
   * Extract matched characteristics from SKU tags
   */
  private extractMatchedCharacteristics(row: any): string[] {
    const characteristics: string[] = [];
    const skuTags = row.sku_tags || [];
    
    if (skuTags.includes(row.brand)) characteristics.push('brand');
    if (skuTags.includes(row.model)) characteristics.push('model');
    if (skuTags.includes(row.capacity)) characteristics.push('capacity');
    if (skuTags.includes(row.color)) characteristics.push('color');
    if (skuTags.includes(row.carrier)) characteristics.push('carrier');
    
    return characteristics;
  }

  /**
   * Rank matches by score and confidence
   */
  private rankMatches(matches: SkuMatch[], device: NormalizedDeviceData): SkuMatch[] {
    return matches
      .filter(match => match.match_score > 0)
      .sort((a, b) => {
        // Primary sort by match score
        if (b.match_score !== a.match_score) {
          return b.match_score - a.match_score;
        }
        // Secondary sort by confidence level
        const confidenceOrder: Record<string, number> = { 
          'high_confidence': 4, 
          'medium_confidence': 3, 
          'low_confidence': 2, 
          'very_low_confidence': 1 
        };
        return (confidenceOrder[b.confidence_level] || 0) - (confidenceOrder[a.confidence_level] || 0);
      });
  }

  /**
   * Build final result object
   */
  private buildResult(matches: SkuMatch[], device: NormalizedDeviceData, startTime: number, dataCompleteness: number): UnifiedMatchResult {
    const processingTime = Date.now() - startTime;
    const bestMatch = matches.length > 0 ? matches[0] : undefined;
    const highestScore = bestMatch?.match_score || 0;
    
    // Determine confidence level
    let confidenceLevel: 'high' | 'medium' | 'low' | 'very_low';
    if (highestScore >= 80 && dataCompleteness >= 0.8) confidenceLevel = 'high';
    else if (highestScore >= 60 && dataCompleteness >= 0.6) confidenceLevel = 'medium';
    else if (highestScore >= 40 && dataCompleteness >= 0.4) confidenceLevel = 'low';
    else confidenceLevel = 'very_low';
    
    // Determine if attention is required
    const requiresAttention = highestScore < 50 || dataCompleteness < 0.4 || matches.length === 0;
    
    return {
      imei: device.imei,
      matches,
      bestMatch,
      totalMatches: matches.length,
      highestScore,
      confidenceLevel,
      requiresAttention,
      processingTime,
      dataCompleteness
    };
  }

  /**
   * Normalize brand name
   */
  private normalizeBrand(brand?: string): string {
    if (!brand) return '';
    return brand.trim().toLowerCase();
  }

  /**
   * Normalize model name
   */
  private normalizeModel(model?: string): string {
    if (!model) return '';
    return model.trim().toLowerCase();
  }

  /**
   * Normalize capacity
   */
  private normalizeCapacity(capacity?: string): string {
    if (!capacity) return '';
    return capacity.trim().toLowerCase();
  }

  /**
   * Normalize color
   */
  private normalizeColor(color?: string): string {
    if (!color) return '';
    return color.trim().toLowerCase();
  }

  /**
   * Normalize carrier
   */
  private normalizeCarrier(carrier?: string): string {
    if (!carrier) return '';
    return carrier.trim().toLowerCase();
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(device: FlexibleDeviceInput): string {
    return `${device.imei}-${device.brand}-${device.model}-${device.capacity}-${device.color}-${device.carrier}`;
  }

  /**
   * Get cached result
   */
  private getCachedResult(key: string): UnifiedMatchResult | null {
    const expiry = this.cacheExpiry.get(key);
    if (expiry && Date.now() < expiry) {
      return this.cache.get(key) || null;
    }
    return null;
  }

  /**
   * Set cached result
   */
  private setCachedResult(key: string, result: UnifiedMatchResult): void {
    this.cache.set(key, result);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }
}

// Type definitions
interface MatchOptions {
  minScore?: number;
  maxResults?: number;
}

interface NormalizedDeviceData {
  imei: string;
  brand: string;
  model: string;
  capacity: string;
  color: string;
  carrier: string;
  device_notes: string;
  working_status: string;
  battery_health: string;
  source: string;
}

type MatchingStrategy = 'exact_matching' | 'fuzzy_matching' | 'partial_matching' | 'fallback_matching';

export default UnifiedSkuMatchingService;


