import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import { EnhancedGoogleSheetsService } from '../services/EnhancedGoogleSheetsService';
import * as dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Initialize the enhanced service
const enhancedGoogleSheetsService = new EnhancedGoogleSheetsService();

interface SyncRequestBody {
  forceFullSync?: boolean;
}

interface SyncStatsResponse {
  success: boolean;
  data: {
    totalSkus: number;
    taggedSkus: number;
    untaggedSkus: number;
    tagCoverage: number;
    recentSyncs: any[];
    deviceTypes: any[];
    topBrands: any[];
  };
}

// POST /api/enhanced-sku-master/sync - Enhanced sync with incremental updates
router.post('/sync', async (req: Request<{}, any, SyncRequestBody>, res: Response) => {
  try {
    const { forceFullSync = false } = req.body;
    
    console.log('🔄 Enhanced SKU Master API: Starting enhanced sync');
    console.log(`⚙️ Force full sync: ${forceFullSync}`);
    
    const result = await enhancedGoogleSheetsService.syncSkusWithTags('enhanced', forceFullSync);
    
    console.log('✅ Enhanced SKU Master API: Enhanced sync completed');
    
    res.json({
      success: true,
      message: 'Enhanced SKU sync completed successfully',
      data: result
    });
    
  } catch (error: any) {
    console.error('❌ Error during enhanced SKU sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync SKUs with enhanced logic',
      details: error.message
    });
  }
});

// GET /api/enhanced-sku-master/stats - Get sync statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const pool = new Pool({
      connectionString: process.env['DIRECT_URL'],
      max: 1,
      idleTimeoutMillis: 0,
      connectionTimeoutMillis: 30000,
    });
    
    const client = await pool.connect();
    
    try {
      // Get total SKU count
      const totalResult = await client.query('SELECT COUNT(*) FROM sku_master WHERE is_active = true');
      const totalSkus = parseInt(totalResult.rows[0].count);
      
      // Get SKUs with tags
      const taggedResult = await client.query(`
        SELECT COUNT(*) FROM sku_master 
        WHERE is_active = true AND sku_tags IS NOT NULL AND array_length(sku_tags, 1) > 0
      `);
      const taggedSkus = parseInt(taggedResult.rows[0].count);
      
      // Get recent sync logs
      const syncLogsResult = await client.query(`
        SELECT sync_type, status, total_skus, new_skus, updated_skus, skipped_skus, failed_skus, started_at, completed_at
        FROM sku_sync_log 
        ORDER BY started_at DESC 
        LIMIT 5
      `);
      
      // Get device type breakdown
      const deviceTypeResult = await client.query(`
        SELECT device_type, COUNT(*) as count
        FROM sku_master 
        WHERE is_active = true AND device_type IS NOT NULL
        GROUP BY device_type
        ORDER BY count DESC
      `);
      
      // Get brand breakdown
      const brandResult = await client.query(`
        SELECT brand, COUNT(*) as count
        FROM sku_master 
        WHERE is_active = true AND brand IS NOT NULL
        GROUP BY brand
        ORDER BY count DESC
        LIMIT 10
      `);
      
      const response: SyncStatsResponse = {
        success: true,
        data: {
          totalSkus,
          taggedSkus,
          untaggedSkus: totalSkus - taggedSkus,
          tagCoverage: totalSkus > 0 ? Math.round((taggedSkus / totalSkus) * 100) : 0,
          recentSyncs: syncLogsResult.rows,
          deviceTypes: deviceTypeResult.rows,
          topBrands: brandResult.rows
        }
      };
      
      res.json(response);
      
    } finally {
      client.release();
      await pool.end();
    }
    
  } catch (error: any) {
    console.error('❌ Error getting enhanced SKU stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get SKU statistics',
      details: error.message
    });
  }
});

// GET /api/enhanced-sku-master/sample-tags - Get sample SKUs with tags
router.get('/sample-tags', async (req: Request, res: Response) => {
  try {
    const pool = new Pool({
      connectionString: process.env['DIRECT_URL'],
      max: 1,
      idleTimeoutMillis: 0,
      connectionTimeoutMillis: 30000,
    });
    
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT 
          sku_code,
          brand,
          model,
          capacity,
          color,
          carrier,
          post_fix,
          device_type,
          sku_tags,
          tag_count
        FROM sku_master 
        WHERE is_active = true 
          AND sku_tags IS NOT NULL 
          AND array_length(sku_tags, 1) > 0
        ORDER BY tag_count DESC
        LIMIT 10
      `);
      
      res.json({
        success: true,
        data: result.rows
      });
      
    } finally {
      client.release();
      await pool.end();
    }
    
  } catch (error: any) {
    console.error('❌ Error getting sample tags:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sample SKU tags',
      details: error.message
    });
  }
});

export default router;
