import express from 'express';
import { Pool } from 'pg';
import CompleteSkuMatchingService from '../services/CompleteSkuMatchingService';
import { logger } from '../utils/logger';

const router = express.Router();

// Database connection pool
const pool = new Pool({
  connectionString: process.env['DIRECT_URL'],
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Connect to database pool
pool.connect().catch(console.error);

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
    
    const items = await pool.query(itemsQuery);
    
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
        
        if (results && results.matches && results.matches.length > 0) {
          // Store the best match
          const bestMatch = results.matches[0];
          
          if (bestMatch) {
            // Insert or update the matching result
            await pool.query(`
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
              bestMatch.sku.sku_code,
              bestMatch.totalScore,
              'automatic_matching',
              'matched',
              bestMatch.method
            ]);
            
            matchedCount++;
            logger.info(`✅ Matched IMEI ${item.imei}: ${item.original_sku} -> ${bestMatch.sku.sku_code} (Score: ${bestMatch.totalScore})`);
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
    
    const result = await pool.query(`
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
    const skuResult = await pool.query(`
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
      WHERE sku_tags IS NOT NULL
      LIMIT 5
    `);
    
    // Get sample device data
    const deviceResult = await pool.query(`
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
    
    // Get specific device with all necessary fields for SKU matching
    const deviceResult = await pool.query(`
      SELECT 
        p.imei,
        p.sku as original_sku,
        p.brand,
        i.model,
        i.capacity,
        i.color,
        i.carrier,
        dt.notes as device_notes
      FROM product p
      LEFT JOIN item i ON p.imei = i.imei
      LEFT JOIN device_test dt ON p.imei = dt.imei
      WHERE p.imei = $1
    `, [imei]);
    
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }
    
    const device = deviceResult.rows[0];
    
    // PERFORMANCE OPTIMIZATION: Remove unnecessary queries
    // The service will handle SKU filtering efficiently
    
    // Test matching with debug
    logger.info(`🔍 Testing device: ${JSON.stringify(device)}`);
    
    // Use the service's matchImeiToSku method for proper post-processing
    console.log(`🚨 ROUTE HANDLER: Using optimized service method`);
    const matchResult = await skuMatchingService.matchImeiToSku({
      imei: device.imei,
      model: device.model,
      capacity: device.capacity,
      color: device.color,
      carrier: device.carrier,
      brand: device.brand,
      original_sku: device.original_sku,
      device_notes: device.device_notes,
      postfix: null
    }, {
      filterPostfix: true,
      minScore: 0, // Show all scores
      maxResults: 10
    });
    
    const results = matchResult.matches;
    const lowThresholdResults = results; // Same results
    
    return res.json({
      success: true,
      data: {
        device: device,
        matches: results,
        debug: {
          filtered_skus_count: results.length,
          first_filtered_sku: results.length > 0 ? results[0] : null
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
    const deviceResult = await pool.query(`
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
    const skuResult = await pool.query(`
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
    const result = await pool.query(`
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
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_results,
        COUNT(CASE WHEN match_score >= 80 THEN 1 END) as high_confidence_matches,
        COUNT(CASE WHEN match_score >= 70 AND match_score < 80 THEN 1 END) as medium_confidence_matches,
        COUNT(CASE WHEN match_score < 70 THEN 1 END) as low_confidence_matches,
        AVG(match_score) as average_score
      FROM sku_matching_results
    `);
    
    const skuStats = await pool.query(`
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

// GET /api/sku-matching/debug-chunks/:imei - Debug model chunking
router.get('/debug-chunks/:imei', async (req, res) => {
  try {
    const { imei } = req.params;
    
    // Get device data
    const deviceResult = await pool.query(`
      SELECT p.brand, i.model, i.capacity, i.color, i.carrier, dt.notes as device_notes
      FROM product p
      JOIN item i ON p.imei = i.imei
      JOIN device_test dt ON i.imei = dt.imei
      WHERE p.imei = $1
    `, [imei]);
    
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    
    const device = deviceResult.rows[0];
    
    // Test model chunking
    const modelChunks = device.model ? device.model.split(/\s+/).map((term: string) => term.trim()).filter((term: string) => term.length > 0) : [];
    const upperTerms = modelChunks.map((term: string) => term.toUpperCase());
    const filteredTerms = upperTerms.filter((term: string) => 
      !['GALAXY', 'SAMSUNG', '5G', 'DUOS', 'DUAL', 'SIM'].includes(term)
    );
    
    return res.json({
      success: true,
      data: {
        device,
        modelChunks,
        upperTerms,
        filteredTerms
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Debug chunks failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/sku-matching/create-normalization-table - Create normalization table with real SKU data
router.post('/create-normalization-table', async (req, res) => {
  try {
    // Read the SQL file and execute it
    const fs = require('fs');
    const path = require('path');
    const sqlFile = path.join(__dirname, '../../create_normalization_table.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Execute the SQL
    await pool.query(sql);
    
    // Verify the table was created
    const result = await pool.query(`
      SELECT 
        category,
        COUNT(*) as count,
        array_agg(DISTINCT input_value) as sample_inputs
      FROM normalization_tags
      GROUP BY category
      ORDER BY category
    `);
    
    res.json({
      success: true,
      message: 'Normalization table created successfully',
      data: {
        categories: result.rows,
        total_mappings: result.rows.reduce((sum, row) => sum + parseInt(row.count), 0)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create normalization table',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/sku-matching/test-normalization/:imei - Test normalization data lookup
router.get('/test-normalization/:imei', async (req, res) => {
  try {
    const { imei } = req.params;
    
    // Get device data
    const deviceResult = await pool.query(`
      SELECT p.brand, i.model, i.capacity, i.color, i.carrier, dt.notes as device_notes
      FROM product p
      JOIN item i ON p.imei = i.imei
      JOIN device_test dt ON i.imei = dt.imei
      WHERE p.imei = $1
    `, [imei]);
    
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    
    const device = deviceResult.rows[0];
    
    // Test normalization data lookup
    const modelData = await pool.query(`
      SELECT normalized_value, tags, is_postfix
      FROM normalization_tags
      WHERE category = 'model' 
      AND input_value ILIKE $1
      AND is_active = true
      ORDER BY priority DESC
      LIMIT 1
    `, [`%${device.model}%`]);
    
    const capacityData = await pool.query(`
      SELECT normalized_value, tags, is_postfix
      FROM normalization_tags
      WHERE category = 'capacity' 
      AND input_value ILIKE $1
      AND is_active = true
      ORDER BY priority DESC
      LIMIT 1
    `, [`%${device.capacity}%`]);
    
    const colorData = await pool.query(`
      SELECT normalized_value, tags, is_postfix
      FROM normalization_tags
      WHERE category = 'color' 
      AND input_value ILIKE $1
      AND is_active = true
      ORDER BY priority DESC
      LIMIT 1
    `, [`%${device.color}%`]);
    
    const carrierData = await pool.query(`
      SELECT normalized_value, tags, is_postfix
      FROM normalization_tags
      WHERE category = 'carrier' 
      AND input_value ILIKE $1
      AND is_active = true
      ORDER BY priority DESC
      LIMIT 1
    `, [`%${device.carrier}%`]);
    
    return res.json({
      success: true,
      data: {
        device,
        normalization: {
          model: modelData || null,
          capacity: capacityData || null,
          color: colorData || null,
          carrier: carrierData || null
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Test normalization failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/sku-matching/debug-query/:imei - Debug the actual SQL query being generated
router.get('/debug-query/:imei', async (req, res) => {
  try {
    const { imei } = req.params;
    
    // Get device data
    const deviceResult = await pool.query(`
      SELECT p.brand, i.model, i.capacity, i.color, i.carrier, dt.notes as device_notes
      FROM product p
      JOIN item i ON p.imei = i.imei
      JOIN device_test dt ON i.imei = dt.imei
      WHERE p.imei = $1
    `, [imei]);
    
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    
    const device = deviceResult.rows[0];
    
    // OPTIMIZED: Single query for all normalization data
    const normalizationResult = await pool.query(`
      SELECT category, normalized_value, tags, is_postfix, priority
      FROM normalization_tags
      WHERE is_active = true
      AND (
        (category = 'model' AND input_value ILIKE $1) OR
        (category = 'capacity' AND input_value ILIKE $2) OR
        (category = 'color' AND input_value ILIKE $3) OR
        (category = 'carrier' AND input_value ILIKE $4)
      )
      ORDER BY category, priority DESC
    `, [`%${device.model}%`, `%${device.capacity}%`, `%${device.color}%`, `%${device.carrier}%`]);
    
    // Parse results into separate objects
    const modelData = normalizationResult.rows.find(row => row.category === 'model') || null;
    const capacityData = normalizationResult.rows.find(row => row.category === 'capacity') || null;
    const colorData = normalizationResult.rows.find(row => row.category === 'color') || null;
    const carrierData = normalizationResult.rows.find(row => row.category === 'carrier') || null;
    
    // Build the same query as the service
    let query = `
      SELECT id, sku_code, sku_tags, brand, model, capacity, color, carrier, post_fix, device_type
      FROM sku_master 
      WHERE sku_tags IS NOT NULL AND array_length(sku_tags, 1) > 0
    `;
    
    // Model filtering
    if (modelData && modelData.tags) {
      const modelConditions = modelData.tags.map((tag: string) => 
        `EXISTS (SELECT 1 FROM unnest(sku_tags) AS tag WHERE UPPER(tag) = '${tag.toUpperCase()}')`
      ).join(' OR ');
      query += ` AND (${modelConditions})`;
    }
    
    // Capacity filtering
    if (capacityData && capacityData.tags) {
      const capacityConditions = capacityData.tags.map((tag: string) => `'${tag}' = ANY(sku_tags)`).join(' OR ');
      query += ` AND (${capacityConditions})`;
    }
    
    // Color filtering
    if (colorData && colorData.tags) {
      const colorConditions = colorData.tags.map((tag: string) => `'${tag}' = ANY(sku_tags)`).join(' OR ');
      query += ` AND (${colorConditions})`;
    }
    
    // Carrier filtering
    if (carrierData && carrierData.tags) {
      const carrierConditions = carrierData.tags.map((tag: string) => `'${tag}' = ANY(sku_tags)`).join(' OR ');
      query += ` AND (${carrierConditions})`;
    }
    
    query += ` ORDER BY id LIMIT 50`;
    
    // Execute the query to see results
    const result = await pool.query(query);
    
    return res.json({
      success: true,
      data: {
        device,
        normalization: {
          model: modelData || null,
          capacity: capacityData || null,
          color: colorData || null,
          carrier: carrierData || null
        },
        generated_query: query,
        query_results: {
          count: result.rows.length,
          skus: result.rows.map(row => ({
            sku_code: row.sku_code,
            sku_tags: row.sku_tags
          }))
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Debug query failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/sku-matching/debug-service-normalization/:imei - Debug service normalization directly
router.get('/debug-service-normalization/:imei', async (req, res) => {
  try {
    const { imei } = req.params;
    
    // Get device data
    const deviceResult = await pool.query(`
      SELECT p.brand, i.model, i.capacity, i.color, i.carrier, dt.notes as device_notes
      FROM product p
      JOIN item i ON p.imei = i.imei
      JOIN device_test dt ON i.imei = dt.imei
      WHERE p.imei = $1
    `, [imei]);
    
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    
    const device = deviceResult.rows[0];
    
    // Initialize service
    await skuMatchingService.initialize();
    
    // Test service normalization directly
    const modelData = await (skuMatchingService as any).getNormalizationData('model', device.model);
    const capacityData = await (skuMatchingService as any).getNormalizationData('capacity', device.capacity);
    const colorData = await (skuMatchingService as any).getNormalizationData('color', device.color);
    const carrierData = await (skuMatchingService as any).getNormalizationData('carrier', device.carrier);
    
    return res.json({
      success: true,
      data: {
        device,
        service_normalization: {
          model: modelData,
          capacity: capacityData,
          color: colorData,
          carrier: carrierData
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Debug service normalization failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/sku-matching/simple-test/:imei - Simple test using working approach directly
router.get('/simple-test/:imei', async (req, res) => {
  try {
    const { imei } = req.params;
    
    // Get device data
    const deviceResult = await pool.query(`
      SELECT p.brand, i.model, i.capacity, i.color, i.carrier, dt.notes as device_notes
      FROM product p
      JOIN item i ON p.imei = i.imei
      JOIN device_test dt ON i.imei = dt.imei
      WHERE p.imei = $1
    `, [imei]);
    
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    
    const device = deviceResult.rows[0];
    
    // Parse carrier from device notes (same logic as service)
    let actualCarrier = device.carrier;
    if (device.device_notes) {
      const upperNotes = device.device_notes.toUpperCase();
      if (upperNotes.includes('CARRIER UNLOCKED') || upperNotes.includes('UNLOCKED')) {
        actualCarrier = 'UNLOCKED';
      } else if (upperNotes.includes('CARRIER LOCKED') || upperNotes.includes('LOCKED')) {
        actualCarrier = device.carrier; // Keep original carrier (locked to that carrier)
      }
    }
    
    // OPTIMIZED: Single query for all normalization data
    const normalizationResult = await pool.query(`
      SELECT category, normalized_value, tags, is_postfix, priority
      FROM normalization_tags
      WHERE is_active = true
      AND (
        (category = 'model' AND input_value ILIKE $1) OR
        (category = 'capacity' AND input_value ILIKE $2) OR
        (category = 'color' AND input_value ILIKE $3) OR
        (category = 'carrier' AND input_value ILIKE $4)
      )
      ORDER BY category, priority DESC
    `, [`%${device.model}%`, `%${device.capacity}%`, `%${device.color}%`, `%${actualCarrier}%`]);
    
    // Parse results into separate objects (handle undefined cases)
    const modelData = normalizationResult.rows.find(row => row.category === 'model') || null;
    const capacityData = normalizationResult.rows.find(row => row.category === 'capacity') || null;
    const colorData = normalizationResult.rows.find(row => row.category === 'color') || null;
    const carrierData = normalizationResult.rows.find(row => row.category === 'carrier') || null;
    
    // ENHANCED SERVICE APPROACH: Use our enhanced service with no-match queue
    await skuMatchingService.initialize();
    
    const matchResult = await skuMatchingService.matchImeiToSku({
      imei: imei,
      brand: device.brand,
      model: device.model,
      capacity: device.capacity,
      color: device.color,
      carrier: device.carrier,
      device_notes: device.device_notes,
      original_sku: undefined
    });

    // Convert service result to expected format
    const result = {
      rows: matchResult.matches.map(match => ({
        sku_code: match.sku.sku_code,
        sku_tags: match.sku.sku_tags,
        brand: match.sku.brand,
        model: match.sku.model,
        capacity: match.sku.capacity,
        color: match.sku.color,
        carrier: match.sku.carrier,
        post_fix: match.sku.post_fix,
        device_type: match.sku.device_type,
        match_score: match.score,
        confidence_level: match.confidence
      }))
    };
    
    return res.json({
      success: true,
      data: {
        device,
        normalization: {
          model: modelData || null,
          capacity: capacityData || null,
          color: colorData || null,
          carrier: carrierData || null
        },
        query: "Enhanced Service with No-Match Queue",
        results: {
          count: result.rows.length,
          matches: result.rows.map(row => ({
            sku: {
              sku_code: row.sku_code,
              sku_tags: row.sku_tags,
              brand: row.brand,
              model: row.model,
              capacity: row.capacity,
              color: row.color,
              carrier: row.carrier,
              post_fix: row.post_fix,
              device_type: row.device_type
            },
            score: row.match_score,
            confidence: row.confidence_level
          }))
        },
        noMatchInfo: matchResult.requiresAttention ? {
          requiresAttention: true,
          noMatchReason: (matchResult as any).noMatchReason || 'Device may need manual review'
        } : null
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Simple test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/sku-matching/real-samsung-s22 - Show real Samsung S22 SKUs
router.get('/real-samsung-s22', async (req, res) => {
  try {
    // Get real Samsung S22 SKUs to see the correct format
    const samsungS22Skus = await pool.query(`
      SELECT sku_code, brand, model, capacity, color, carrier, post_fix, device_type, sku_tags
      FROM sku_master
      WHERE (brand ILIKE '%samsung%' OR sku_code ILIKE '%samsung%')
      AND (model ILIKE '%s22%' OR sku_code ILIKE '%s22%')
      ORDER BY sku_code
    `);
    
    return res.json({
      success: true,
      data: {
        count: samsungS22Skus.rows.length,
        skus: samsungS22Skus.rows,
        message: 'Real Samsung S22 SKUs from database'
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to get Samsung S22 SKUs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/sku-matching/test-core/:imei - Test the new core method
router.get('/test-core/:imei', async (req, res) => {
  try {
    const { imei } = req.params;
    
    if (!imei || imei.length !== 15) {
      return res.status(400).json({
        success: false,
        error: 'Invalid IMEI format'
      });
    }
    
    // Get device data
    const deviceResult = await pool.query(`
      SELECT p.imei, p.brand, i.model, i.capacity, i.color, i.carrier, dt.notes as device_notes
      FROM product p
      JOIN item i ON p.imei = i.imei
      JOIN device_test dt ON p.imei = dt.imei
      WHERE p.imei = $1
    `, [imei]);
    
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    
    const device = deviceResult.rows[0];
    
    // Initialize service
    await skuMatchingService.initialize();
    
    // Test the new core method
    const startTime = Date.now();
    
    const result = await skuMatchingService.matchImeiToSku({
      imei: device.imei,
      brand: device.brand,
      model: device.model,
      capacity: device.capacity,
      color: device.color,
      carrier: device.carrier,
      device_notes: device.device_notes
    });
    const endTime = Date.now();
    
    return res.json({
      success: true,
      data: {
        device,
        matches: result.matches,
        requiresAttention: result.requiresAttention,
        performance: {
          processingTime: `${endTime - startTime}ms`,
          method: 'postgresql_advanced_query'
        }
      }
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Core method test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/sku-matching/verify-database - Verify what's actually in sku_master table
router.get('/verify-database', async (req, res) => {
  try {
    // Check if sku_master table exists and has data
    const tableCheck = await pool.query(`
      SELECT COUNT(*) as total_count
      FROM sku_master
    `);
    
    // Get some sample SKUs to see the actual format
    const sampleSkus = await pool.query(`
      SELECT sku_code, brand, model, capacity, color, carrier, post_fix, device_type
      FROM sku_master
      LIMIT 5
    `);
    
    // Check if there are any Samsung SKUs
    const samsungCheck = await pool.query(`
      SELECT COUNT(*) as samsung_count
      FROM sku_master
      WHERE brand ILIKE '%samsung%' OR sku_code ILIKE '%samsung%'
    `);
    
    // Check if there are any S22 SKUs
    const s22Check = await pool.query(`
      SELECT COUNT(*) as s22_count
      FROM sku_master
      WHERE model ILIKE '%s22%' OR sku_code ILIKE '%s22%'
    `);
    
    return res.json({
      success: true,
      data: {
        table_info: {
          total_skus: parseInt(tableCheck.rows[0].total_count),
          samsung_skus: parseInt(samsungCheck.rows[0].samsung_count),
          s22_skus: parseInt(s22Check.rows[0].s22_count)
        },
        sample_skus: sampleSkus.rows,
        message: 'Database verification complete'
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Database verification failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;