const express = require('express');
const { Client } = require('pg');
const SkuMatchingService = require('../services/skuMatchingService');
require('dotenv').config();

const router = express.Router();

// Database connection
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Connect to database
client.connect().catch(console.error);

// Initialize SKU matching service
const skuMatchingService = new SkuMatchingService();

// POST /api/sku-matching/process-all - Process all existing items for SKU matching
router.post('/process-all', async (req, res) => {
  try {
    console.log('🔄 SKU Matching API: Starting bulk SKU matching process');
    
    // Get all items that need SKU matching
    const itemsQuery = `
      SELECT 
        p.imei,
        p.sku as original_sku,
        i.model,
        i.capacity,
        i.color,
        i.carrier,
        p.brand
      FROM product p
      JOIN item i ON p.imei = i.imei
      WHERE p.sku IS NOT NULL
      ORDER BY p.created_at DESC
    `;
    
    const items = await client.query(itemsQuery);
    console.log(`📋 Found ${items.rows.length} items to process for SKU matching`);
    
    let processedCount = 0;
    let matchedCount = 0;
    let noMatchCount = 0;
    let errors = [];
    
    for (const item of items.rows) {
      try {
        const deviceData = {
          brand: item.brand,
          model: item.model,
          capacity: item.capacity,
          color: item.color,
          carrier: item.carrier
        };
        
        // Find best matching SKU
        const match = await skuMatchingService.findBestMatchingSku(deviceData);
        
        if (match && match.match_score >= 0.65) { // Lowered threshold to 65%
          // Log the match
          await skuMatchingService.logSkuMatch(
            item.imei,
            item.original_sku,
            match.sku_code,
            match.match_score,
            match.match_method
          );
          
          // Update the product table with the matched SKU
          await client.query(
            'UPDATE product SET sku = $1, updated_at = NOW() WHERE imei = $2',
            [match.sku_code, item.imei]
          );
          
          // Insert/Update the sku_matching_results table
          await client.query(`
            INSERT INTO sku_matching_results (imei, original_sku, matched_sku, match_score, match_method, match_status, processed_at)
            VALUES ($1, $2, $3, $4, $5, 'matched', NOW())
            ON CONFLICT (imei) DO UPDATE SET
              matched_sku = EXCLUDED.matched_sku,
              match_score = EXCLUDED.match_score,
              match_method = EXCLUDED.match_method,
              match_status = EXCLUDED.match_status,
              processed_at = EXCLUDED.processed_at,
              updated_at = NOW()
          `, [
            item.imei,
            item.original_sku,
            match.sku_code,
            match.match_score,
            match.match_method
          ]);
          
          matchedCount++;
          console.log(`✅ IMEI ${item.imei}: ${item.original_sku} → ${match.sku_code} (${match.match_score})`);
        } else {
          noMatchCount++;
          console.log(`❌ IMEI ${item.imei}: No good match found for ${item.original_sku}`);
        }
        
        processedCount++;
        
      } catch (error) {
        console.error(`❌ Error processing IMEI ${item.imei}:`, error.message);
        errors.push({ imei: item.imei, error: error.message });
      }
    }
    
    console.log(`✅ SKU matching completed: ${processedCount} processed, ${matchedCount} matched, ${noMatchCount} no match`);
    
    res.json({
      success: true,
      message: 'SKU matching process completed',
      data: {
        totalProcessed: processedCount,
        matched: matchedCount,
        noMatch: noMatchCount,
        errors: errors.length,
        errorDetails: errors
      }
    });
    
  } catch (error) {
    console.error('❌ Error during SKU matching process:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process SKU matching',
      details: error.message
    });
  }
});

// POST /api/sku-matching/process-imei/:imei - Process specific IMEI for SKU matching
router.post('/process-imei/:imei', async (req, res) => {
  try {
    const { imei } = req.params;
    
    console.log(`🔍 SKU Matching API: Processing IMEI ${imei} for SKU matching`);
    
    // Get item data
    const itemQuery = `
      SELECT 
        p.imei,
        p.sku as original_sku,
        i.model,
        i.capacity,
        i.color,
        i.carrier,
        p.brand
      FROM product p
      JOIN item i ON p.imei = i.imei
      WHERE p.imei = $1
    `;
    
    const itemResult = await client.query(itemQuery, [imei]);
    
    if (itemResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'IMEI not found'
      });
    }
    
    const item = itemResult.rows[0];
    const deviceData = {
      brand: item.brand,
      model: item.model,
      capacity: item.capacity,
      color: item.color,
      carrier: item.carrier
    };
    
    // Find best matching SKU
    const match = await skuMatchingService.findBestMatchingSku(deviceData);
    
    if (match && match.match_score >= 0.65) { // Lowered threshold to 65%
      // Log the match
      await skuMatchingService.logSkuMatch(
        item.imei,
        item.original_sku,
        match.sku_code,
        match.match_score,
        match.match_method
      );
      
      // Update the product table with the matched SKU
      await client.query(
        'UPDATE product SET sku = $1, updated_at = NOW() WHERE imei = $2',
        [match.sku_code, item.imei]
      );
      
      // Insert/Update the sku_matching_results table
      await client.query(`
        INSERT INTO sku_matching_results (imei, original_sku, matched_sku, match_score, match_method, match_status, processed_at)
        VALUES ($1, $2, $3, $4, $5, 'matched', NOW())
        ON CONFLICT (imei) DO UPDATE SET
          matched_sku = EXCLUDED.matched_sku,
          match_score = EXCLUDED.match_score,
          match_method = EXCLUDED.match_method,
          match_status = EXCLUDED.match_status,
          processed_at = EXCLUDED.processed_at,
          updated_at = NOW()
      `, [
        item.imei,
        item.original_sku,
        match.sku_code,
        match.match_score,
        match.match_method
      ]);
      
      console.log(`✅ IMEI ${item.imei}: ${item.original_sku} → ${match.sku_code} (${match.match_score})`);
      
      res.json({
        success: true,
        message: 'SKU matched successfully',
        data: {
          imei: item.imei,
          originalSku: item.original_sku,
          matchedSku: match.sku_code,
          matchScore: match.match_score,
          matchMethod: match.match_method,
          updated: true
        }
      });
    } else {
      console.log(`❌ IMEI ${item.imei}: No good match found for ${item.original_sku}`);
      
      res.json({
        success: true,
        message: 'No good SKU match found',
        data: {
          imei: item.imei,
          originalSku: item.original_sku,
          matchedSku: null,
          matchScore: match ? match.match_score : 0,
          matchMethod: 'none',
          updated: false
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error processing IMEI for SKU matching:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process IMEI for SKU matching',
      details: error.message
    });
  }
});

// GET /api/sku-matching/pending - Get items that need SKU matching review
router.get('/pending', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    console.log(`📋 SKU Matching API: Getting pending items (page ${page}, limit ${limit})`);
    
    const query = `
      SELECT 
        p.imei,
        p.sku as current_sku,
        p.brand,
        i.model,
        i.capacity,
        i.color,
        i.carrier,
        p.created_at,
        p.updated_at
      FROM product p
      JOIN item i ON p.imei = i.imei
      WHERE p.sku IS NOT NULL
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const countQuery = `
      SELECT COUNT(*) as total
      FROM product p
      JOIN item i ON p.imei = i.imei
      WHERE p.sku IS NOT NULL
    `;
    
    const [result, countResult] = await Promise.all([
      client.query(query, [parseInt(limit), offset]),
      client.query(countQuery)
    ]);
    
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);
    
    console.log(`✅ Found ${result.rows.length} pending items (${total} total)`);
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasMore: page < totalPages
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting pending items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pending items',
      details: error.message
    });
  }
});

// GET /api/sku-matching/stats - Get SKU matching statistics
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 SKU Matching API: Getting statistics');
    
    const stats = await skuMatchingService.getMatchStats();
    
    // Get additional stats from product table
    const productStats = await client.query(`
      SELECT 
        COUNT(*) as total_items,
        COUNT(DISTINCT sku) as unique_skus,
        COUNT(CASE WHEN sku LIKE '%-%-%-%' THEN 1 END) as generated_skus,
        COUNT(CASE WHEN sku NOT LIKE '%-%-%-%' THEN 1 END) as custom_skus
      FROM product
      WHERE sku IS NOT NULL
    `);
    
    console.log('✅ SKU matching statistics retrieved');
    
    res.json({
      success: true,
      data: {
        matchStats: stats,
        productStats: productStats.rows[0]
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting SKU matching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get SKU matching statistics',
      details: error.message
    });
  }
});

// GET /api/sku-matching/recent-matches - Get recent SKU matches
router.get('/recent-matches', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    console.log(`📋 SKU Matching API: Getting recent matches (limit ${limit})`);
    
    const query = `
      SELECT 
        imei, 
        original_sku, 
        matched_sku, 
        match_score, 
        match_method, 
        created_at
      FROM sku_match_log 
      ORDER BY created_at DESC 
      LIMIT $1
    `;
    
    const result = await client.query(query, [parseInt(limit)]);
    
    console.log(`✅ Found ${result.rows.length} recent matches`);
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('❌ Error getting recent matches:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recent matches',
      details: error.message
    });
  }
});

module.exports = router;
