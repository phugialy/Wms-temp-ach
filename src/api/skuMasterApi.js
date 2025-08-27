const express = require('express');
const { Client } = require('pg');
const GoogleSheetsService = require('../services/googleSheetsService');
const SkuMatchingService = require('../services/skuMatchingService');
require('dotenv').config();

const router = express.Router();

// Database connection - create client as needed
const createClient = () => {
  return new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
};

// Initialize services
const googleSheetsService = new GoogleSheetsService();
const skuMatchingService = new SkuMatchingService();

// GET /api/sku-master/stats - Get SKU master statistics
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 SKU Master API: Getting statistics');
    
    const stats = await googleSheetsService.getSkuStats();
    
    console.log('✅ SKU Master API: Statistics retrieved');
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('❌ Error getting SKU stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get SKU statistics',
      details: error.message
    });
  }
});

// POST /api/sku-master/sync - Manual sync from Google Sheets
router.post('/sync', async (req, res) => {
  try {
    console.log('🔄 SKU Master API: Starting manual sync');
    
    const result = await googleSheetsService.syncSkusFromSheets('manual');
    
    console.log('✅ SKU Master API: Manual sync completed');
    
    res.json({
      success: true,
      message: 'SKU sync completed successfully',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error during SKU sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync SKUs',
      details: error.message
    });
  }
});

// GET /api/sku-master/skus - Get all SKUs with pagination
router.get('/skus', async (req, res) => {
  const client = createClient();
  await client.connect();
  
  try {
    const { page = 1, limit = 50, search = '', brand = '', carrier = '' } = req.query;
    const offset = (page - 1) * limit;
    
    console.log(`📋 SKU Master API: Getting SKUs (page ${page}, limit ${limit})`);
    
    let whereClause = 'WHERE is_active = true';
    const params = [];
    let paramIndex = 1;
    
    if (search) {
      whereClause += ` AND (sku_code ILIKE $${paramIndex} OR brand ILIKE $${paramIndex} OR model ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (brand) {
      whereClause += ` AND brand ILIKE $${paramIndex}`;
      params.push(`%${brand}%`);
      paramIndex++;
    }
    
    if (carrier) {
      whereClause += ` AND carrier ILIKE $${paramIndex}`;
      params.push(`%${carrier}%`);
      paramIndex++;
    }
    
    const query = `
      SELECT 
        id, sku_code, brand, model, capacity, color, carrier, post_fix, 
        is_unlocked, source_tab, last_synced, created_at, updated_at
      FROM sku_master 
      ${whereClause}
      ORDER BY sku_code
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const countQuery = `
      SELECT COUNT(*) as total
      FROM sku_master 
      ${whereClause}
    `;
    
    params.push(parseInt(limit), offset);
    
    const [result, countResult] = await Promise.all([
      client.query(query, params),
      client.query(countQuery, params.slice(0, -2))
    ]);
    
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);
    
    console.log(`✅ SKU Master API: Found ${result.rows.length} SKUs (${total} total)`);
    
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
    console.error('❌ Error getting SKUs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get SKUs',
      details: error.message
    });
  } finally {
    await client.end();
  }
});

// POST /api/sku-master/match - Test SKU matching for a device
router.post('/match', async (req, res) => {
  try {
    const { brand, model, capacity, color, carrier } = req.body;
    
    console.log(`🔍 SKU Master API: Testing SKU matching for ${brand} ${model}`);
    
    if (!brand || !model) {
      return res.status(400).json({
        success: false,
        error: 'Brand and model are required'
      });
    }
    
    const deviceData = { brand, model, capacity, color, carrier };
    const match = await skuMatchingService.findBestMatchingSku(deviceData);
    
    console.log(`✅ SKU Master API: Match result:`, match ? `Found ${match.sku_code} (${match.match_score})` : 'No match');
    
    res.json({
      success: true,
      data: {
        deviceData,
        match,
        hasMatch: !!match
      }
    });
    
  } catch (error) {
    console.error('❌ Error testing SKU matching:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test SKU matching',
      details: error.message
    });
  }
});

// GET /api/sku-master/match-stats - Get SKU matching statistics
router.get('/match-stats', async (req, res) => {
  try {
    console.log('📊 SKU Master API: Getting match statistics');
    
    const stats = await skuMatchingService.getMatchStats();
    
    console.log('✅ SKU Master API: Match statistics retrieved');
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('❌ Error getting match stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get match statistics',
      details: error.message
    });
  }
});

// GET /api/sku-master/sync-logs - Get sync logs
router.get('/sync-logs', async (req, res) => {
  const client = createClient();
  await client.connect();
  
  try {
    const { limit = 20 } = req.query;
    
    console.log(`📋 SKU Master API: Getting sync logs (limit ${limit})`);
    
    const query = `
      SELECT 
        id, sync_type, status, total_skus, new_skus, updated_skus, failed_skus,
        error_message, started_at, completed_at, created_at
      FROM sku_sync_log 
      ORDER BY started_at DESC 
      LIMIT $1
    `;
    
    const result = await client.query(query, [parseInt(limit)]);
    
    console.log(`✅ SKU Master API: Found ${result.rows.length} sync logs`);
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('❌ Error getting sync logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sync logs',
      details: error.message
    });
  } finally {
    await client.end();
  }
});

// GET /api/sku-master/brands - Get unique brands
router.get('/brands', async (req, res) => {
  const client = createClient();
  await client.connect();
  
  try {
    console.log('📋 SKU Master API: Getting unique brands');
    
    const query = `
      SELECT DISTINCT brand 
      FROM sku_master 
      WHERE brand IS NOT NULL AND brand != '' AND is_active = true
      ORDER BY brand
    `;
    
    const result = await client.query(query);
    
    console.log(`✅ SKU Master API: Found ${result.rows.length} unique brands`);
    
    res.json({
      success: true,
      data: result.rows.map(row => row.brand)
    });
    
  } catch (error) {
    console.error('❌ Error getting brands:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get brands',
      details: error.message
    });
  } finally {
    await client.end();
  }
});

// GET /api/sku-master/carriers - Get unique carriers
router.get('/carriers', async (req, res) => {
  const client = createClient();
  await client.connect();
  
  try {
    console.log('📋 SKU Master API: Getting unique carriers');
    
    const query = `
      SELECT DISTINCT carrier 
      FROM sku_master 
      WHERE carrier IS NOT NULL AND carrier != '' AND is_active = true
      ORDER BY carrier
    `;
    
    const result = await client.query(query);
    
    console.log(`✅ SKU Master API: Found ${result.rows.length} unique carriers`);
    
    res.json({
      success: true,
      data: result.rows.map(row => row.carrier)
    });
    
  } catch (error) {
    console.error('❌ Error getting carriers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get carriers',
      details: error.message
    });
  } finally {
    await client.end();
  }
});

module.exports = router;
