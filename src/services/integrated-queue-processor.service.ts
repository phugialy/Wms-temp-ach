import { Pool, PoolClient } from 'pg';
import { HybridSkuMatchingService } from './HybridSkuMatchingService';
import { logger } from '../utils/logger';

export interface QueueItem {
  id: number;
  raw_data: any;
  status: string;
  created_at: string;
  processed_at?: string;
  error_message?: string;
}

export interface ProcessingResult {
  processed: number;
  errors: string[];
  skuMatched: number;
  noMatch: number;
  undefined: number;
}

export class IntegratedQueueProcessorService {
  private pool: Pool;
  private skuMatchingService: HybridSkuMatchingService;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env['DIRECT_URL'],
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });
    
    this.skuMatchingService = new HybridSkuMatchingService();
  }

  async initialize(): Promise<void> {
    try {
      await this.skuMatchingService.initialize();
      logger.info('✅ IntegratedQueueProcessorService initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize IntegratedQueueProcessorService:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.skuMatchingService.cleanup();
      await this.pool.end();
      logger.info('✅ IntegratedQueueProcessorService cleaned up');
    } catch (error) {
      logger.error('❌ Error during cleanup:', error);
    }
  }

  /**
   * Process all pending queue items with integrated SKU matching
   */
  async processPendingItems(): Promise<ProcessingResult> {
    const client = await this.pool.connect();
    const result: ProcessingResult = {
      processed: 0,
      errors: [],
      skuMatched: 0,
      noMatch: 0,
      undefined: 0
    };

    try {
      logger.info('🔄 Starting integrated queue processing with SKU matching...');

      // Get pending items
      const pendingItems = await client.query(`
        SELECT * FROM data_queue
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT 100
      `);

      if (pendingItems.rows.length === 0) {
        logger.info('ℹ️ No pending items to process');
        return result;
      }

      logger.info(`📊 Found ${pendingItems.rows.length} pending items`);

      // Process each item
      for (const item of pendingItems.rows) {
        try {
          const skuResult = await this.processItemWithSkuMatching(client, item);
          result.processed++;
          
          if (skuResult.isUndefined) {
            result.undefined++;
            logger.info(`⚠️ Processed item ${item.id} (IMEI: ${item.raw_data.imei}) - UNDEFINED: ${skuResult.undefinedReason} | Suggestion: ${skuResult.smartSuggestion}`);
          } else if (skuResult.matched) {
            result.skuMatched++;
            logger.info(`✅ Processed item ${item.id} (IMEI: ${item.raw_data.imei}) - MATCHED: ${skuResult.sku} (Score: ${skuResult.score})`);
          } else {
            result.noMatch++;
            logger.info(`❌ Processed item ${item.id} (IMEI: ${item.raw_data.imei}) - NO MATCH`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Item ${item.id}: ${errorMessage}`);
          logger.error(`❌ Failed to process item ${item.id}: ${errorMessage}`);
          
          // Mark as failed
          await client.query(`
            UPDATE data_queue 
            SET status = 'failed', error_message = $1, updated_at = NOW()
            WHERE id = $2
          `, [errorMessage, item.id]);
        }
      }

      logger.info(`🎉 Processing complete: ${result.processed} processed, ${result.skuMatched} SKU matched, ${result.undefined} undefined, ${result.noMatch} no match, ${result.errors.length} errors`);
      return result;

    } catch (error) {
      logger.error('❌ Error in processPendingItems:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process a single item with integrated SKU matching
   */
  private async processItemWithSkuMatching(client: PoolClient, item: QueueItem): Promise<{ 
    matched: boolean; 
    sku?: string; 
    score?: number;
    isUndefined?: boolean;
    undefinedReason?: string;
    smartSuggestion?: string;
    confidenceLevel?: string;
    matchType?: string;
  }> {
    const data = item.raw_data;
    
    // Run SKU matching first
    let skuResult: {
      matched: boolean;
      sku?: string;
      score?: number;
      isUndefined?: boolean;
      undefinedReason?: string;
      smartSuggestion?: string;
      confidenceLevel?: string;
      matchType?: string;
    } = { 
      matched: false, 
      sku: undefined, 
      score: 0,
      isUndefined: false,
      undefinedReason: undefined,
      smartSuggestion: undefined,
      confidenceLevel: undefined,
      matchType: undefined
    };
    
    try {
      const matchResult = await this.skuMatchingService.matchImeiToSku({
        imei: data.imei,
        brand: data.brand || 'Unknown',
        model: data.model,
        capacity: data.storage,
        color: data.color,
        carrier: data.carrier,
        device_notes: data.notes || ''
      }, {
        minScore: 40,
        maxResults: 10
      });

      if (matchResult.matches.length > 0) {
        const bestMatch = matchResult.matches[0];
        skuResult = {
          matched: !matchResult.isUndefined, // Only consider "matched" if not undefined
          sku: bestMatch.sku_code,
          score: bestMatch.match_score,
          isUndefined: matchResult.isUndefined,
          undefinedReason: matchResult.undefinedReason || undefined,
          smartSuggestion: bestMatch.sku_code, // Top match as smart suggestion
          confidenceLevel: bestMatch.confidence_level,
          matchType: matchResult.matchType
        };
      } else {
        // No matches found
        skuResult.isUndefined = true;
        skuResult.undefinedReason = "No matching record";
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`⚠️ SKU matching failed for IMEI ${data.imei}: ${errorMessage}`);
      skuResult.isUndefined = true;
      skuResult.undefinedReason = `SKU matching error: ${errorMessage}`;
    }

    // Insert into product table
    await client.query(`
      INSERT INTO product (imei, brand, sku, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (imei) DO UPDATE SET
        brand = EXCLUDED.brand,
        sku = EXCLUDED.sku,
        updated_at = NOW()
    `, [
      data.imei,
      data.brand,
      data.brand + '-' + data.model + '-' + data.imei.slice(-4)
    ]);

    // Insert into item table with enhanced SKU matching results
    await client.query(`
      INSERT INTO item (
        imei, model, model_number, carrier, capacity, color, 
        battery_health, battery_count, working, location,
        matched_sku, sku_match_score, sku_match_method, 
        sku_match_status, sku_match_notes, sku_matched_at,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW(), NOW())
      ON CONFLICT (imei) DO UPDATE SET
        model = EXCLUDED.model,
        model_number = EXCLUDED.model_number,
        carrier = EXCLUDED.carrier,
        capacity = EXCLUDED.capacity,
        color = EXCLUDED.color,
        battery_health = EXCLUDED.battery_health,
        battery_count = EXCLUDED.battery_count,
        working = EXCLUDED.working,
        location = EXCLUDED.location,
        matched_sku = EXCLUDED.matched_sku,
        sku_match_score = EXCLUDED.sku_match_score,
        sku_match_method = EXCLUDED.sku_match_method,
        sku_match_status = EXCLUDED.sku_match_status,
        sku_match_notes = EXCLUDED.sku_match_notes,
        sku_matched_at = EXCLUDED.sku_matched_at,
        updated_at = NOW()
    `, [
      data.imei,
      data.model,
      data.serialNumber || data.serialnumber || data.model,
      data.carrier,
      data.storage,
      data.color,
      data.batteryHealth || data.batteryhealth || data.BatteryHealthPercentage,
      data.batteryCycleCount || data.BatteryCycle || data.bcc,
      data.working,
      data.location || 'INCOMING',
      skuResult.sku,
      skuResult.score,
      skuResult.matchType || 'hybrid_sku_matching',
      skuResult.isUndefined ? 'undefined' : (skuResult.matched ? 'matched' : 'no_match'),
      skuResult.isUndefined 
        ? `Undefined: ${skuResult.undefinedReason} | Suggestion: ${skuResult.smartSuggestion} (Score: ${skuResult.score})`
        : (skuResult.matched ? `Best match: ${skuResult.sku} (Score: ${skuResult.score})` : 'No SKU matches found'),
    ]);

    // Insert into device_test table for all working statuses (including PENDING)
    if (data.working && data.working !== '') {
      await client.query(`
        INSERT INTO device_test (imei, working, notes, tester, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (imei) DO UPDATE SET
          working = EXCLUDED.working,
          notes = EXCLUDED.notes,
          tester = EXCLUDED.tester,
          created_at = NOW()
      `, [
        data.imei,
        data.working,
        data.notes,
        data.TesterName || data.testerName
      ]);
    }

    // Write to sku_matching_results table for detailed tracking
    try {
      await client.query(`
        INSERT INTO sku_matching_results (
          imei, 
          original_sku, 
          matched_sku, 
          match_score, 
          match_method, 
          match_status, 
          match_notes, 
          processed_at, 
          updated_at, 
          requires_attention
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), $8)
        ON CONFLICT (imei) DO UPDATE SET
          matched_sku = EXCLUDED.matched_sku,
          match_score = EXCLUDED.match_score,
          match_method = EXCLUDED.match_method,
          match_status = EXCLUDED.match_status,
          match_notes = EXCLUDED.match_notes,
          processed_at = EXCLUDED.processed_at,
          updated_at = NOW(),
          requires_attention = EXCLUDED.requires_attention
      `, [
        data.imei,
        data.sku || data.brand + '-' + data.model + '-' + data.imei.slice(-4), // original_sku
        skuResult.sku, // matched_sku
        skuResult.score, // match_score
        skuResult.matchType || 'hybrid_sku_matching', // match_method
        skuResult.isUndefined ? 'undefined' : (skuResult.matched ? 'matched' : 'no_match'), // match_status
        skuResult.isUndefined 
          ? `Undefined: ${skuResult.undefinedReason} | Suggestion: ${skuResult.smartSuggestion} (Score: ${skuResult.score})`
          : (skuResult.matched ? `Best match: ${skuResult.sku} (Score: ${skuResult.score})` : 'No SKU matches found'), // match_notes
        skuResult.isUndefined || !skuResult.matched // requires_attention (true if undefined or no match)
      ]);
      
      logger.info(`✅ Added enhanced SKU matching result for IMEI ${data.imei} to sku_matching_results table`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`⚠️ Failed to add IMEI ${data.imei} to sku_matching_results table: ${errorMessage}`);
    }

    // If no SKU match found or item is undefined, add to enhanced undefined_sku table
    if (!skuResult.matched || skuResult.isUndefined) {
      try {
        await client.query(`
          INSERT INTO undefined_sku (
            imei, device_data, reason, undefined_reason, smart_suggestion_sku, 
            smart_suggestion_score, confidence_level, match_type, processing_method,
            requires_attention, review_status, resolution_status, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
          ON CONFLICT (imei) DO UPDATE SET
            device_data = EXCLUDED.device_data,
            reason = EXCLUDED.reason,
            undefined_reason = EXCLUDED.undefined_reason,
            smart_suggestion_sku = EXCLUDED.smart_suggestion_sku,
            smart_suggestion_score = EXCLUDED.smart_suggestion_score,
            confidence_level = EXCLUDED.confidence_level,
            match_type = EXCLUDED.match_type,
            processing_method = EXCLUDED.processing_method,
            requires_attention = EXCLUDED.requires_attention,
            review_status = CASE 
              WHEN undefined_sku.review_status = 'completed' THEN undefined_sku.review_status
              ELSE EXCLUDED.review_status
            END,
            updated_at = NOW()
        `, [
          data.imei,
          JSON.stringify(data),
          skuResult.isUndefined ? 'Undefined classification' : 'No SKU matches found',
          skuResult.undefinedReason || 'No matching record',
          skuResult.smartSuggestion,
          skuResult.score,
          skuResult.confidenceLevel || 'unknown',
          skuResult.matchType || 'hybrid_sku_matching',
          'hybrid_sku_matching',
          true, // requires_attention
          'pending', // review_status
          'unresolved' // resolution_status
        ]);
        
        logger.info(`✅ Enhanced undefined_sku entry created for IMEI ${data.imei} - Reason: ${skuResult.undefinedReason}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.warn(`⚠️ Failed to add IMEI ${data.imei} to enhanced undefined_sku table: ${errorMessage}`);
      }
    }

    // Mark as completed
    await client.query(`
      UPDATE data_queue 
      SET status = 'completed', processed_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [item.id]);

    return skuResult;
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<{
    pending: number;
    completed: number;
    failed: number;
    skuMatched: number;
    noMatch: number;
    undefined: number;
  }> {
    const client = await this.pool.connect();
    
    try {
      const [queueStats, itemStats] = await Promise.all([
        client.query(`
          SELECT 
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
          FROM data_queue
        `),
        client.query(`
          SELECT 
            COUNT(CASE WHEN sku_match_status = 'matched' THEN 1 END) as sku_matched,
            COUNT(CASE WHEN sku_match_status = 'no_match' THEN 1 END) as no_match,
            COUNT(CASE WHEN sku_match_status = 'undefined' THEN 1 END) as undefined
          FROM item
        `)
      ]);

      return {
        pending: parseInt(queueStats.rows[0].pending),
        completed: parseInt(queueStats.rows[0].completed),
        failed: parseInt(queueStats.rows[0].failed),
        skuMatched: parseInt(itemStats.rows[0].sku_matched),
        noMatch: parseInt(itemStats.rows[0].no_match),
        undefined: parseInt(itemStats.rows[0].undefined)
      };
    } finally {
      client.release();
    }
  }
}
