import express from 'express';
import { Client } from 'pg';
import CompleteSkuMatchingService from '../services/CompleteSkuMatchingService';
import { logger } from '../utils/logger';

const router = express.Router();

// Database connection
const client = new Client({
  connectionString: process.env['DIRECT_URL'],
  ssl: process.env['NODE_ENV'] === 'production' ? { rejectUnauthorized: false } : false
});

// Connect to database
client.connect().catch(console.error);

// Initialize SKU matching service
const skuMatchingService = new CompleteSkuMatchingService();

// POST /api/sku-matching/process-all - Process all existing items for SKU matching
router.post('/process-all', async (req, res) => {
  try {
    logger.info('🔄 SKU Matching API: Starting bulk SKU matching process');
    
    // Initialize the service if not already done
    await skuMatchingService.initialize();
    
    // Get all items that need SKU matching
    const itemsQuery = `
      SELECT 
        p.imei,
        p.sku as original_sku,
        p.brand,
        i.model,
        i.capacity,
        i.color,
        i.carrier
      FROM product p
      LEFT JOIN item i ON p.imei = i.imei
      WHERE p.sku IS NOT NULL
      ORDER BY p.created_at DESC
    `;
    
    const items = await client.query(itemsQuery);
    
    if (items.rows.length === 0) {
      return res.json({
        success: true,
        message: 'No items found for SKU matching',
        stats: {
          totalProcessed: 0,
          matched: 0,
          noMatch: 0,
          errors: 0
        }
      });
    }
    
    logger.info(`📊 Found ${items.rows.length} items to process for SKU matching`);
    
    // Debug: Log first few items to see what data we have
    if (items.rows.length > 0) {
      logger.info('🔍 Debug - First item data:', items.rows[0]);
    }
    
    let processedCount = 0;
    let matchedCount = 0;
    let noMatchCount = 0;
    const errors: string[] = [];
    
    // Process each item
    for (const item of items.rows) {
      try {
        logger.info(`🔍 Processing IMEI: ${item.imei}`);
        logger.info(`📱 Device data: brand=${item.brand}, model=${item.model}, capacity=${item.capacity}, color=${item.color}, carrier=${item.carrier}`);
        
        // Use the new TypeScript service method
        const results = await skuMatchingService.matchImeiToSku({
          imei: item.imei,
          model: item.model,
          capacity: item.capacity,
          color: item.color,
          carrier: item.carrier,
          brand: item.brand,
          original_sku: item.original_sku
        }, {
          filterPostfix: false,
          minScore: 30,
          maxResults: 5
        });
        
        if (results && results.length > 0) {
          // Store the best match
          const bestMatch = results[0];
          
          if (bestMatch) {
            // Insert or update the matching result
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
                updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
              ON CONFLICT (imei) 
              DO UPDATE SET
                matched_sku = EXCLUDED.matched_sku,
                match_score = EXCLUDED.match_score,
                match_method = EXCLUDED.match_method,
                match_status = EXCLUDED.match_status,
                match_notes = EXCLUDED.match_notes,
                processed_at = NOW(),
                updated_at = NOW()
            `, [
              item.imei,
              item.original_sku,
              bestMatch.skuCode,
              bestMatch.score,
              'automatic_matching',
              'matched',
              bestMatch.reason
            ]);
            
            matchedCount++;
            logger.info(`✅ Matched IMEI ${item.imei}: ${item.original_sku} -> ${bestMatch.skuCode} (Score: ${bestMatch.score})`);
          }
        } else {
          noMatchCount++;
          logger.warn(`❌ No match found for IMEI ${item.imei}: ${item.original_sku}`);
        }
        
        processedCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`IMEI ${item.imei}: ${errorMessage}`);
        logger.error(`Error processing IMEI ${item.imei}:`, error);
      }
    }
    
    logger.info(`🎯 SKU Matching Complete: ${processedCount} processed, ${matchedCount} matched, ${noMatchCount} no match`);
    
    return res.json({
      success: true,
      message: 'SKU matching process completed',
      stats: {
        totalProcessed: processedCount,
        matched: matchedCount,
        noMatch: noMatchCount,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    logger.error('❌ SKU Matching API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process SKU matching',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/sku-matching/results/:imei - Get SKU matching results for a specific IMEI
router.get('/results/:imei', async (req, res) => {
  try {
    const { imei } = req.params;
    
    if (!imei || imei.length !== 15) {
      return res.status(400).json({
        success: false,
        error: 'Invalid IMEI format'
      });
    }
    
    const result = await client.query(`
      SELECT 
        imei,
        original_sku,
        matched_sku,
        match_score,
        match_method,
        match_status,
        match_notes,
        processed_at,
        updated_at
      FROM sku_matching_results 
      WHERE imei = $1
    `, [imei]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No SKU matching results found for this IMEI'
      });
    }
    
    const matchingResult = result.rows[0];
    
    return res.json({
      success: true,
      data: matchingResult
    });
    
  } catch (error) {
    logger.error('❌ Error getting SKU matching results:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get SKU matching results',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/sku-matching/debug - Debug SKU master data
router.get('/debug', async (req, res) => {
  try {
    // Get SKU master data
    const skuResult = await client.query(`
      SELECT 
        sku_code,
        brand,
        model,
        capacity,
        color,
        carrier,
        post_fix,
        sku_tags,
        is_active
      FROM sku_master 
      WHERE is_active = true
      LIMIT 5
    `);
    
    // Get sample device data
    const deviceResult = await client.query(`
      SELECT 
        p.imei,
        p.sku as original_sku,
        p.brand,
        i.model,
        i.capacity,
        i.color,
        i.carrier
      FROM product p
      LEFT JOIN item i ON p.imei = i.imei
      WHERE p.sku IS NOT NULL
      LIMIT 3
    `);
    
    return res.json({
      success: true,
      data: {
        sku_master: {
          total_skus: skuResult.rows.length,
          sample_skus: skuResult.rows
        },
        device_data: {
          total_devices: deviceResult.rows.length,
          sample_devices: deviceResult.rows
        }
      }
    });
    
  } catch (error) {
    logger.error('❌ Error getting SKU debug data:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get SKU debug data',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/sku-matching/test-single/:imei - Test matching for a single IMEI
router.get('/test-single/:imei', async (req, res) => {
  try {
    const { imei } = req.params;
    
    if (!imei || imei.length !== 15) {
      return res.status(400).json({
        success: false,
        error: 'Invalid IMEI format'
      });
    }
    
    // Initialize the service
    await skuMatchingService.initialize();
    
    // Get specific device
    const deviceResult = await client.query(`
      SELECT 
        p.imei,
        p.sku as original_sku,
        p.brand,
        i.model,
        i.capacity,
        i.color,
        i.carrier
      FROM product p
      LEFT JOIN item i ON p.imei = i.imei
      WHERE p.imei = $1
    `, [imei]);
    
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }
    
    const device = deviceResult.rows[0];
    
    // Get all SKUs
    const skuResult = await client.query(`
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
    `);
    
    // DEBUG: Get some sample SKUs with S22 in the name
    const s22Skus = await client.query(`
      SELECT sku_code, sku_tags, brand, model, capacity, color, carrier
      FROM sku_master 
      WHERE sku_code LIKE '%S22%' AND is_active = true
      LIMIT 5
    `);
    
    // Test matching with debug
    logger.info(`🔍 Testing device: ${JSON.stringify(device)}`);
    
    // DEBUG: Test the filtering step directly
    const { skus: filteredSkus, requiresAttention } = await skuMatchingService.getFilteredSkus({
      imei: device.imei,
      model: device.model,
      capacity: device.capacity,
      color: device.color,
      carrier: device.carrier,
      brand: device.brand,
      original_sku: device.original_sku
    }, false);
    
    logger.info(`🔍 DEBUG: getFilteredSkus returned ${filteredSkus.length} SKUs`);
    if (filteredSkus.length > 0) {
      logger.info(`🔍 DEBUG: First SKU: ${JSON.stringify(filteredSkus[0])}`);
    }
    
    const results = await skuMatchingService.matchImeiToSku({
      imei: device.imei,
      model: device.model,
      capacity: device.capacity,
      color: device.color,
      carrier: device.carrier,
      brand: device.brand,
      original_sku: device.original_sku
    }, {
      filterPostfix: false,
      minScore: 0, // Show all scores
      maxResults: 10
    });
    
    // Also test with a very low threshold to see if any scores are being calculated
    const lowThresholdResults = await skuMatchingService.matchImeiToSku({
      imei: device.imei,
      model: device.model,
      capacity: device.capacity,
      color: device.color,
      carrier: device.carrier,
      brand: device.brand,
      original_sku: device.original_sku
    }, {
      filterPostfix: false,
      minScore: 0,
      maxResults: 50
    });
    
    // Find the matching SKU we added
    const matchingSku = skuResult.rows.find(sku => sku.sku_code === 'SAMSUNG-GALAXY-S22-ULTRA-5G-DUOS-512GB-BURGUNDY-UNLOCKED');
    
    return res.json({
      success: true,
      data: {
        device: device,
        total_skus: skuResult.rows.length,
        matches: results,
        low_threshold_matches: lowThresholdResults,
        debug: {
          matching_sku_found: !!matchingSku,
          matching_sku: matchingSku,
          device_brand: device.brand,
          device_model: device.model,
          device_capacity: device.capacity,
          device_color: device.color,
          device_carrier: device.carrier,
          filtered_skus_count: filteredSkus.length,
          first_filtered_sku: filteredSkus.length > 0 ? filteredSkus[0] : null,
          s22_skus_sample: s22Skus.rows,
          normalization_debug: {
            original_model: device.model,
            original_capacity: device.capacity,
            original_color: device.color,
            original_carrier: device.carrier,
            normalized_model: skuMatchingService['normalizeModel'](device.model),
            normalized_capacity: skuMatchingService['normalizeCapacity'](device.capacity),
            normalized_color: skuMatchingService['normalizeColor'](device.color),
            normalized_carrier: skuMatchingService['normalizeCarrier'](device.carrier)
          },
          chunk_debug: {
            note: "Chunk-based scoring implemented - check server logs for chunk details"
          }
        }
      }
    });
    
  } catch (error) {
    logger.error('❌ Error testing single IMEI match:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to test single IMEI matching',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/sku-matching/test-match - Test matching logic with debug output
router.get('/test-match', async (req, res) => {
  try {
    // Initialize the service
    await skuMatchingService.initialize();
    
    // Get first device
    const deviceResult = await client.query(`
      SELECT 
        p.imei,
        p.sku as original_sku,
        p.brand,
        i.model,
        i.capacity,
        i.color,
        i.carrier
      FROM product p
      LEFT JOIN item i ON p.imei = i.imei
      WHERE p.sku IS NOT NULL
      LIMIT 1
    `);
    
    if (deviceResult.rows.length === 0) {
      return res.json({ success: false, error: 'No devices found' });
    }
    
    const device = deviceResult.rows[0];
    
    // Get all SKUs
    const skuResult = await client.query(`
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
      LIMIT 3
    `);
    
    // Test matching with debug
    const results = await skuMatchingService.matchImeiToSku({
      imei: device.imei,
      model: device.model,
      capacity: device.capacity,
      color: device.color,
      carrier: device.carrier,
      brand: device.brand,
      original_sku: device.original_sku
    }, {
      filterPostfix: false,
      minScore: 0, // Show all scores
      maxResults: 10
    });
    
    return res.json({
      success: true,
      data: {
        device: device,
        skus: skuResult.rows,
        matches: results
      }
    });
    
  } catch (error) {
    logger.error('❌ Error testing match:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to test matching',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/sku-matching/add-test-sku - Add a test Samsung SKU
router.post('/add-test-sku', async (req, res) => {
  try {
    const result = await client.query(`
      INSERT INTO sku_master (
        sku_code, brand, model, capacity, color, carrier, post_fix, 
        sku_tags, is_active, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
      )
      RETURNING *
    `, [
      'SAMSUNG-GALAXY-S23-DUOS-128GB-CREAM-VERIZON',
      'Samsung',
      'Galaxy S23 Duos',
      '128GB',
      'Cream',
      'Verizon',
      'VERIZON',
      ['Samsung', 'Galaxy S23 Duos', '128GB', 'Cream', 'Verizon', 'PHONE'],
      true
    ]);
    
    return res.json({
      success: true,
      message: 'Test Samsung SKU added successfully',
      data: result.rows[0]
    });
    
  } catch (error) {
    logger.error('❌ Error adding test SKU:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add test SKU',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/sku-matching/stats - Get SKU matching statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_results,
        COUNT(CASE WHEN match_score >= 80 THEN 1 END) as high_confidence_matches,
        COUNT(CASE WHEN match_score >= 70 AND match_score < 80 THEN 1 END) as medium_confidence_matches,
        COUNT(CASE WHEN match_score < 70 THEN 1 END) as low_confidence_matches,
        AVG(match_score) as average_score
      FROM sku_matching_results
    `);
    
    const skuStats = await client.query(`
      SELECT 
        COUNT(*) as total_skus,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_skus
      FROM sku_master
    `);
    
    return res.json({
      success: true,
      data: {
        matching_results: stats.rows[0],
        sku_master: skuStats.rows[0]
      }
    });
    
  } catch (error) {
    logger.error('❌ Error getting SKU matching stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get SKU matching statistics',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;