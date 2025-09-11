import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Database connection
const pool = new Pool({
  connectionString: process.env['DIRECT_URL'],
  ssl: process.env['NODE_ENV'] === 'production' ? { rejectUnauthorized: false } : false
});

interface InventoryItem {
  imei: string;
  working: string;
  device_name: string;
  model: string;
  storage: string;
  color: string;
  carrier: string;
  location: string;
  working_status: string;
  condition: string;
  sku_display: string;
  defects: string;
  notes: string;
  repair_notes: string;
  battery_health: string;
  battery_count: number;
  model_number: string;
  brand: string;
  date_in: string;
  matched_sku?: string;
  sku_match_score?: number;
  sku_match_method?: string;
  sku_match_status?: string;
  sku_match_notes?: string;
  sku_matched_at?: string;
  created_at: string;
  updated_at: string;
}

interface InventoryStats {
  totalItems: number;
  passedTests: number;
  failedTests: number;
  pendingTests: number;
  phonecheckData: number;
}

interface InventoryResponse {
  success: boolean;
  data?: InventoryItem[];
  stats?: InventoryStats;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  error?: string;
  details?: string;
}

interface InventoryQuery {
  search?: string;
  filter?: {
    working?: string;
    location?: string;
  };
  limit?: string;
  offset?: string;
}

// GET /api/admin/inventory - Get inventory data for admin dashboard
router.get('/admin/inventory', async (req: Request, res: Response) => {
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
    
    const summaryResult = await pool.query(summaryQuery);
    const summary = summaryResult.rows[0];
    
    // Get inventory view data with all columns including SKU matching
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
        date_in,
        matched_sku,
        sku_match_score,
        sku_match_method,
        sku_match_status,
        sku_match_notes,
        sku_matched_at,
        created_at,
        updated_at
      FROM inventory_view
      ORDER BY imei
    `;
    
    const inventoryResult = await pool.query(inventoryQuery);
    
    // For admin dashboard, return just the inventory array (frontend expects this format)
    console.log(`✅ Inventory data fetched: ${inventoryResult.rows.length} items`);
    res.json(inventoryResult.rows);
    
  } catch (error) {
    console.error('❌ Error fetching inventory data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory data',
      details: errorMessage
    });
  }
});

// GET /api/inventory - Get inventory data for inventory page
router.get('/inventory', async (req: Request<{}, InventoryResponse, {}, InventoryQuery>, res: Response<InventoryResponse>) => {
  try {
    console.log('📦 Fetching inventory data...');
    
    const { search, filter, limit = '50', offset = '0' } = req.query;
    
    let whereClause = '';
    let params: any[] = [];
    let paramCount = 0;
    
    // Add search functionality
    if (search) {
      paramCount++;
      whereClause += ` WHERE (
        imei ILIKE $${paramCount} OR 
        sku_display ILIKE $${paramCount} OR 
        matched_sku ILIKE $${paramCount} OR
        defects ILIKE $${paramCount} OR 
        notes ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }
    
    // Add filter functionality
    if (filter) {
      const filterConditions: string[] = [];
      
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
    
    // Get inventory data with pagination including SKU matching
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
        date_in,
        matched_sku,
        sku_match_score,
        sku_match_method,
        sku_match_status,
        sku_match_notes,
        sku_matched_at,
        created_at,
        updated_at
      FROM inventory_view
      ${whereClause}
      ORDER BY imei
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    
    params.push(parseInt(limit), parseInt(offset));
    
    const inventoryResult = await pool.query(inventoryQuery, params);
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM inventory_view
      ${whereClause}
    `;
    
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);
    
    const response: InventoryResponse = {
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory data',
      details: errorMessage
    });
  }
});

// GET /api/inventory/stats - Get inventory statistics
router.get('/inventory/stats', async (req: Request, res: Response<InventoryResponse>) => {
  try {
    console.log('📊 Fetching inventory statistics...');
    
    const statsQuery = `
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN i.working IN ('YES', 'PASS') THEN 1 END) as passed_tests,
        COUNT(CASE WHEN i.working IN ('NO', 'FAILED') THEN 1 END) as failed_tests,
        COUNT(CASE WHEN i.working = 'PENDING' THEN 1 END) as pending_tests,
        COUNT(CASE WHEN dt.imei IS NOT NULL THEN 1 END) as phonecheck_data,
        COUNT(CASE WHEN i.sku_match_status = 'matched' THEN 1 END) as sku_matched,
        COUNT(CASE WHEN i.sku_match_status = 'no_match' THEN 1 END) as sku_no_match
      FROM item i
      LEFT JOIN device_test dt ON i.imei = dt.imei
    `;
    
    const statsResult = await pool.query(statsQuery);
    const stats = statsResult.rows[0];
    
    const response: InventoryResponse = {
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory statistics',
      details: errorMessage
    });
  }
});

// GET /api/inventory/export - Export inventory data as CSV
router.get('/inventory/export', async (req: Request, res: Response) => {
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
        date_in,
        matched_sku,
        sku_match_score,
        sku_match_method,
        sku_match_status,
        sku_match_notes,
        sku_matched_at
      FROM inventory_view
      ORDER BY imei
    `;
    
    const result = await pool.query(exportQuery);
    
    // Convert to CSV
    const csvHeader = 'IMEI,Working Status,Device Name,Model,Storage,Color,Carrier,Location,Condition,SKU Display,Defects,Notes,Repair Notes,Battery Health,Battery Count,Model Number,Brand,Date In,Matched SKU,SKU Match Score,SKU Match Method,SKU Match Status,SKU Match Notes,SKU Matched At\n';
    const csvRows = result.rows.map(row => 
      `"${row.imei}","${row.working}","${row.device_name || ''}","${row.model || ''}","${row.storage || ''}","${row.color || ''}","${row.carrier || ''}","${row.location || ''}","${row.condition || ''}","${row.sku_display || ''}","${row.defects || ''}","${row.notes || ''}","${row.repair_notes || ''}","${row.battery_health || ''}","${row.battery_count || ''}","${row.model_number || ''}","${row.brand || ''}","${row.date_in || ''}","${row.matched_sku || ''}","${row.sku_match_score || ''}","${row.sku_match_method || ''}","${row.sku_match_status || ''}","${row.sku_match_notes || ''}","${row.sku_matched_at || ''}"`
    ).join('\n');
    
    const csv = csvHeader + csvRows;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory-export.csv"');
    res.send(csv);
    
    console.log(`✅ Inventory data exported: ${result.rows.length} items`);
    
  } catch (error) {
    console.error('❌ Error exporting inventory data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to export inventory data',
      details: errorMessage
    });
  }
});

export default router;
