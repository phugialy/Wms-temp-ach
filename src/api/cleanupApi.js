const express = require('express');
const { Client } = require('pg');
require('dotenv').config();

const router = express.Router();

// Database connection
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Connect to database
client.connect().catch(console.error);

// GET /api/cleanup/data - Get all data for cleanup page
router.get('/data', async (req, res) => {
  try {
    console.log('🗑️ Fetching cleanup data...');
    
    const { search, filter, limit = 50, offset = 0 } = req.query;
    
    let whereClause = '';
    let params = [];
    let paramCount = 0;
    
    // Add search functionality
    if (search) {
      paramCount++;
      whereClause += ` WHERE (
        imei ILIKE $${paramCount} OR 
        sku ILIKE $${paramCount} OR 
        brand ILIKE $${paramCount} OR 
        model ILIKE $${paramCount} OR 
        device_name ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }
    
    // Add filter functionality
    if (filter) {
      const filterConditions = [];
      
      if (filter.working) {
        paramCount++;
        filterConditions.push(`working_status = $${paramCount}`);
        params.push(filter.working);
      }
      
      if (filter.brand) {
        paramCount++;
        filterConditions.push(`brand = $${paramCount}`);
        params.push(filter.brand);
      }
      
      if (filter.location) {
        paramCount++;
        filterConditions.push(`location ILIKE $${paramCount}`);
        params.push(`%${filter.location}%`);
      }
      
      if (filter.condition) {
        paramCount++;
        filterConditions.push(`condition = $${paramCount}`);
        params.push(filter.condition);
      }
      
      if (filterConditions.length > 0) {
        whereClause += whereClause ? ' AND' : ' WHERE';
        whereClause += ` (${filterConditions.join(' AND ')})`;
      }
    }
    
    // Get cleanup data with pagination
    const cleanupQuery = `
      SELECT 
        imei,
        sku,
        brand,
        model,
        capacity,
        color,
        carrier,
        working,
        location,
        device_name,
        sku_display,
        working_status,
        condition,
        defects,
        notes,
        repair_notes,
        battery_health,
        battery_count,
        model_number,
        date_in,
        created_at
      FROM deletion_view
      ${whereClause}
      ORDER BY imei
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    
    params.push(parseInt(limit), parseInt(offset));
    
    const cleanupResult = await client.query(cleanupQuery, params);
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM deletion_view
      ${whereClause}
    `;
    
    const countResult = await client.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);
    
    const response = {
      success: true,
      data: cleanupResult.rows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    };
    
    console.log(`✅ Cleanup data fetched: ${cleanupResult.rows.length} items (${total} total)`);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error fetching cleanup data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cleanup data',
      details: error.message
    });
  }
});

// GET /api/cleanup/search-imei/:imei - Search for specific IMEI
router.get('/search-imei/:imei', async (req, res) => {
  try {
    console.log(`🔍 Searching for IMEI: ${req.params.imei}`);
    
    const searchQuery = `
      SELECT 
        imei,
        sku,
        brand,
        model,
        device_name,
        working,
        working_status,
        location,
        condition,
        defects,
        notes,
        repair_notes
      FROM deletion_view
      WHERE imei = $1
    `;
    
    const result = await client.query(searchQuery, [req.params.imei]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'IMEI not found',
        imei: req.params.imei
      });
    }
    
    console.log(`✅ IMEI found: ${req.params.imei}`);
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Error searching IMEI:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search IMEI',
      details: error.message
    });
  }
});

// DELETE /api/cleanup/delete-imei/:imei - Delete single IMEI
router.delete('/delete-imei/:imei', async (req, res) => {
  try {
    console.log(`🗑️ Deleting IMEI: ${req.params.imei}`);
    
    // Start transaction
    await client.query('BEGIN');
    
    // Delete from product table (this will cascade to all child tables)
    const deleteQuery = `
      DELETE FROM product 
      WHERE imei = $1
    `;
    
    const result = await client.query(deleteQuery, [req.params.imei]);
    
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'IMEI not found',
        imei: req.params.imei
      });
    }
    
    await client.query('COMMIT');
    
    console.log(`✅ IMEI deleted successfully: ${req.params.imei}`);
    res.json({
      success: true,
      message: 'IMEI deleted successfully',
      imei: req.params.imei,
      deletedRows: result.rowCount
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error deleting IMEI:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete IMEI',
      details: error.message
    });
  }
});

// DELETE /api/cleanup/bulk-delete - Bulk delete multiple IMEIs
router.delete('/bulk-delete', async (req, res) => {
  try {
    const { imeis } = req.body;
    
    if (!imeis || !Array.isArray(imeis) || imeis.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No IMEIs provided for deletion'
      });
    }
    
    console.log(`🗑️ Bulk deleting ${imeis.length} IMEIs...`);
    
    // Start transaction
    await client.query('BEGIN');
    
    let deletedCount = 0;
    const failedImeis = [];
    
    for (const imei of imeis) {
      try {
        const deleteQuery = `
          DELETE FROM product 
          WHERE imei = $1
        `;
        
        const result = await client.query(deleteQuery, [imei]);
        if (result.rowCount > 0) {
          deletedCount++;
        } else {
          failedImeis.push(imei);
        }
      } catch (error) {
        failedImeis.push(imei);
        console.error(`Error deleting IMEI ${imei}:`, error.message);
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`✅ Bulk delete completed: ${deletedCount} deleted, ${failedImeis.length} failed`);
    res.json({
      success: true,
      message: 'Bulk delete completed',
      deletedCount,
      failedCount: failedImeis.length,
      failedImeis
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error in bulk delete:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk delete',
      details: error.message
    });
  }
});

// GET /api/cleanup/stats - Get cleanup statistics
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 Fetching cleanup statistics...');
    
    const statsQuery = `
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN working_status = 'PASS' THEN 1 END) as passed_items,
        COUNT(CASE WHEN working_status = 'FAIL' THEN 1 END) as failed_items,
        COUNT(CASE WHEN working_status = 'PENDING' THEN 1 END) as pending_items,
        COUNT(DISTINCT brand) as unique_brands,
        COUNT(DISTINCT location) as unique_locations,
        COUNT(CASE WHEN condition = 'GOOD' THEN 1 END) as good_condition,
        COUNT(CASE WHEN condition = 'POOR' THEN 1 END) as poor_condition
      FROM deletion_view
    `;
    
    const statsResult = await client.query(statsQuery);
    const stats = statsResult.rows[0];
    
    const response = {
      success: true,
      stats: {
        totalItems: parseInt(stats.total_items) || 0,
        passedItems: parseInt(stats.passed_items) || 0,
        failedItems: parseInt(stats.failed_items) || 0,
        pendingItems: parseInt(stats.pending_items) || 0,
        uniqueBrands: parseInt(stats.unique_brands) || 0,
        uniqueLocations: parseInt(stats.unique_locations) || 0,
        goodCondition: parseInt(stats.good_condition) || 0,
        poorCondition: parseInt(stats.poor_condition) || 0
      }
    };
    
    console.log('✅ Cleanup statistics fetched');
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error fetching cleanup statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cleanup statistics',
      details: error.message
    });
  }
});

module.exports = router;
