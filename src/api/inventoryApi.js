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

// GET /api/admin/inventory - Get inventory data for admin dashboard
router.get('/admin/inventory', async (req, res) => {
  try {
    console.log('📊 Fetching inventory data for admin dashboard...');
    
    // Get inventory summary stats
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN i.working IN ('YES', 'PASS') THEN 1 END) as passed_tests,
        COUNT(CASE WHEN i.working IN ('NO', 'FAILED') THEN 1 END) as failed_tests,
        COUNT(CASE WHEN i.working = 'PENDING' THEN 1 END) as pending_tests,
        COUNT(CASE WHEN dt.imei IS NOT NULL THEN 1 END) as phonecheck_data
      FROM item i
      LEFT JOIN device_test dt ON i.imei = dt.imei
    `;
    
    const summaryResult = await client.query(summaryQuery);
    const summary = summaryResult.rows[0];
    
    // Get inventory view data with all columns
    const inventoryQuery = `
      SELECT 
        imei,
        working,
        device_name,
        model,
        storage,
        color,
        carrier,
        location,
        working_status,
        condition,
        sku_display,
        defects,
        notes,
        repair_notes,
        battery_health,
        battery_count,
        model_number,
        brand,
        date_in
      FROM inventory_view
      ORDER BY imei
    `;
    
    const inventoryResult = await client.query(inventoryQuery);
    
    // For admin dashboard, return just the inventory array (frontend expects this format)
    console.log(`✅ Inventory data fetched: ${inventoryResult.rows.length} items`);
    res.json(inventoryResult.rows);
    
  } catch (error) {
    console.error('❌ Error fetching inventory data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory data',
      details: error.message
    });
  }
});

// GET /api/inventory - Get inventory data for inventory page
router.get('/inventory', async (req, res) => {
  try {
    console.log('📦 Fetching inventory data...');
    
    const { search, filter, limit = 50, offset = 0 } = req.query;
    
    let whereClause = '';
    let params = [];
    let paramCount = 0;
    
    // Add search functionality
    if (search) {
      paramCount++;
      whereClause += ` WHERE (
        imei ILIKE $${paramCount} OR 
        sku_display ILIKE $${paramCount} OR 
        defects ILIKE $${paramCount} OR 
        notes ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }
    
    // Add filter functionality
    if (filter) {
      const filterConditions = [];
      
      if (filter.working) {
        paramCount++;
        filterConditions.push(`working = $${paramCount}`);
        params.push(filter.working);
      }
      
      if (filter.location) {
        paramCount++;
        filterConditions.push(`location ILIKE $${paramCount}`);
        params.push(`%${filter.location}%`);
      }
      
      if (filterConditions.length > 0) {
        whereClause += whereClause ? ' AND' : ' WHERE';
        whereClause += ` (${filterConditions.join(' AND ')})`;
      }
    }
    
    // Get inventory data with pagination
    const inventoryQuery = `
      SELECT 
        imei,
        working,
        device_name,
        model,
        storage,
        color,
        carrier,
        location,
        working_status,
        condition,
        sku_display,
        defects,
        notes,
        repair_notes,
        battery_health,
        battery_count,
        model_number,
        brand,
        date_in
      FROM inventory_view
      ${whereClause}
      ORDER BY imei
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    
    params.push(parseInt(limit), parseInt(offset));
    
    const inventoryResult = await client.query(inventoryQuery, params);
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM inventory_view
      ${whereClause}
    `;
    
    const countResult = await client.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);
    
    const response = {
      success: true,
      data: inventoryResult.rows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    };
    
    console.log(`✅ Inventory data fetched: ${inventoryResult.rows.length} items (${total} total)`);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error fetching inventory data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory data',
      details: error.message
    });
  }
});

// GET /api/inventory/stats - Get inventory statistics
router.get('/inventory/stats', async (req, res) => {
  try {
    console.log('📊 Fetching inventory statistics...');
    
    const statsQuery = `
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN i.working IN ('YES', 'PASS') THEN 1 END) as passed_tests,
        COUNT(CASE WHEN i.working IN ('NO', 'FAILED') THEN 1 END) as failed_tests,
        COUNT(CASE WHEN i.working = 'PENDING' THEN 1 END) as pending_tests,
        COUNT(CASE WHEN dt.imei IS NOT NULL THEN 1 END) as phonecheck_data
      FROM item i
      LEFT JOIN device_test dt ON i.imei = dt.imei
    `;
    
    const statsResult = await client.query(statsQuery);
    const stats = statsResult.rows[0];
    
    const response = {
      success: true,
      stats: {
        totalItems: parseInt(stats.total_items) || 0,
        passedTests: parseInt(stats.passed_tests) || 0,
        failedTests: parseInt(stats.failed_tests) || 0,
        pendingTests: parseInt(stats.pending_tests) || 0,
        phonecheckData: parseInt(stats.phonecheck_data) || 0
      }
    };
    
    console.log('✅ Inventory statistics fetched');
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error fetching inventory statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory statistics',
      details: error.message
    });
  }
});

// GET /api/inventory/export - Export inventory data as CSV
router.get('/inventory/export', async (req, res) => {
  try {
    console.log('📤 Exporting inventory data...');
    
    const exportQuery = `
      SELECT 
        imei,
        working,
        device_name,
        model,
        storage,
        color,
        carrier,
        location,
        working_status,
        condition,
        sku_display,
        defects,
        notes,
        repair_notes,
        battery_health,
        battery_count,
        model_number,
        brand,
        date_in
      FROM inventory_view
      ORDER BY imei
    `;
    
    const result = await client.query(exportQuery);
    
    // Convert to CSV
    const csvHeader = 'IMEI,Working Status,Device Name,Model,Storage,Color,Carrier,Location,Condition,SKU Display,Defects,Notes,Repair Notes,Battery Health,Battery Count,Model Number,Brand,Date In\n';
    const csvRows = result.rows.map(row => 
      `"${row.imei}","${row.working}","${row.device_name || ''}","${row.model || ''}","${row.storage || ''}","${row.color || ''}","${row.carrier || ''}","${row.location || ''}","${row.condition || ''}","${row.sku_display || ''}","${row.defects || ''}","${row.notes || ''}","${row.repair_notes || ''}","${row.battery_health || ''}","${row.battery_count || ''}","${row.model_number || ''}","${row.brand || ''}","${row.date_in || ''}"`
    ).join('\n');
    
    const csv = csvHeader + csvRows;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory-export.csv"');
    res.send(csv);
    
    console.log(`✅ Inventory data exported: ${result.rows.length} items`);
    
  } catch (error) {
    console.error('❌ Error exporting inventory data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export inventory data',
      details: error.message
    });
  }
});

module.exports = router;
