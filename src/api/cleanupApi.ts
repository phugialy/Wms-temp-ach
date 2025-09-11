import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Database connection pool
const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
  ssl: process.env['NODE_ENV'] === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

interface CleanupData {
  imei: string;
  sku: string;
  brand: string;
  model: string;
  capacity: string;
  color: string;
  carrier: string;
  working: string;
  location: string;
  device_name: string;
  sku_display: string;
  working_status: string;
  condition: string;
  defects: string;
  notes: string;
  repair_notes: string;
  battery_health: string;
  battery_count: number;
  model_number: string;
  date_in: string;
  created_at: string;
}

interface CleanupStats {
  totalItems: number;
  passedItems: number;
  failedItems: number;
  pendingItems: number;
  uniqueBrands: number;
  uniqueLocations: number;
  goodCondition: number;
  poorCondition: number;
}

interface CleanupResponse {
  success: boolean;
  data?: CleanupData[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  stats?: CleanupStats;
  error?: string;
  details?: string;
}

// GET /api/cleanup/data - Get all data for cleanup page
router.get('/data', async (req: Request, res: Response) => {
  try {
    console.log('🗑️ Fetching cleanup data...');
    
    const { search, filter, limit = '50', offset = '0' } = req.query;
    
    let whereClause = '';
    let params: any[] = [];
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
      const filterConditions: string[] = [];
      
      if ((filter as any).working) {
        paramCount++;
        filterConditions.push(`working_status = $${paramCount}`);
        params.push((filter as any).working);
      }
      
      if ((filter as any).brand) {
        paramCount++;
        filterConditions.push(`brand = $${paramCount}`);
        params.push((filter as any).brand);
      }
      
      if ((filter as any).location) {
        paramCount++;
        filterConditions.push(`location ILIKE $${paramCount}`);
        params.push(`%${(filter as any).location}%`);
      }
      
      if ((filter as any).condition) {
        paramCount++;
        filterConditions.push(`condition = $${paramCount}`);
        params.push((filter as any).condition);
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
    
    params.push(parseInt(limit as string), parseInt(offset as string));
    
    const cleanupResult = await pool.query(cleanupQuery, params);
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM deletion_view
      ${whereClause}
    `;
    
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);
    
    const response: CleanupResponse = {
      success: true,
      data: cleanupResult.rows,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: (parseInt(offset as string) + parseInt(limit as string)) < total
      }
    };
    
    console.log(`✅ Cleanup data fetched: ${cleanupResult.rows.length} items (${total} total)`);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error fetching cleanup data:', error);
    const response: CleanupResponse = {
      success: false,
      error: 'Failed to fetch cleanup data',
      details: error instanceof Error ? error.message : String(error)
    };
    res.status(500).json(response);
  }
});

// GET /api/cleanup/search-imei/:imei - Search for specific IMEI
router.get('/search-imei/:imei', async (req: Request, res: Response) => {
  try {
    const imei = req.params['imei'];
    console.log(`🔍 Searching for IMEI: ${imei}`);
    
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
    
    const result = await pool.query(searchQuery, [imei]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'IMEI not found',
        imei: imei
      });
    }
    
    console.log(`✅ IMEI found: ${imei}`);
    return res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Error searching IMEI:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search IMEI',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// DELETE /api/cleanup/delete-imei/:imei - Delete single IMEI
router.delete('/delete-imei/:imei', async (req: Request, res: Response) => {
  try {
    const imei = req.params['imei'];
    console.log(`🗑️ Deleting IMEI: ${imei}`);
    
    // Start transaction
    await pool.query('BEGIN');
    
    // Delete from product table (this will cascade to all child tables)
    const deleteQuery = `
      DELETE FROM product 
      WHERE imei = $1
    `;
    
    const result = await pool.query(deleteQuery, [imei]);
    
    if (result.rowCount === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'IMEI not found',
        imei: imei
      });
    }
    
    await pool.query('COMMIT');
    
    console.log(`✅ IMEI deleted successfully: ${imei}`);
    return res.json({
      success: true,
      message: 'IMEI deleted successfully',
      imei: imei,
      deletedRows: result.rowCount
    });
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Error deleting IMEI:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete IMEI',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// DELETE /api/cleanup/bulk-delete - Bulk delete multiple IMEIs
router.delete('/bulk-delete', async (req: Request, res: Response) => {
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
    await pool.query('BEGIN');
    
    let deletedCount = 0;
    const failedImeis: string[] = [];
    
    for (const imei of imeis) {
      try {
        const deleteQuery = `
          DELETE FROM product 
          WHERE imei = $1
        `;
        
        const result = await pool.query(deleteQuery, [imei]);
        if (result.rowCount && result.rowCount > 0) {
          deletedCount++;
        } else {
          failedImeis.push(imei);
        }
      } catch (error) {
        failedImeis.push(imei);
        console.error(`Error deleting IMEI ${imei}:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    await pool.query('COMMIT');
    
    console.log(`✅ Bulk delete completed: ${deletedCount} deleted, ${failedImeis.length} failed`);
    return res.json({
      success: true,
      message: 'Bulk delete completed',
      deletedCount,
      failedCount: failedImeis.length,
      failedImeis
    });
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Error in bulk delete:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to perform bulk delete',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/cleanup/stats - Get cleanup statistics
router.get('/stats', async (req: Request, res: Response) => {
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
    
    const statsResult = await pool.query(statsQuery);
    const stats = statsResult.rows[0];
    
    const response: CleanupResponse = {
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
    const response: CleanupResponse = {
      success: false,
      error: 'Failed to fetch cleanup statistics',
      details: error instanceof Error ? error.message : String(error)
    };
    res.status(500).json(response);
  }
});

export default router;
