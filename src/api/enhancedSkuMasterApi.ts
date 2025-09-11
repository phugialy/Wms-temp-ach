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
    console.log(`📅 Sync started at: ${new Date().toISOString()}`);
    
    const startTime = Date.now();
    const result = await enhancedGoogleSheetsService.syncSkusWithTags('enhanced', forceFullSync);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('✅ Enhanced SKU Master API: Enhanced sync completed');
    console.log(`⏱️ Sync duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
    
    res.json({
      success: true,
      message: 'Enhanced SKU sync completed successfully',
      data: {
        ...result,
        sync_duration_ms: duration,
        sync_duration_seconds: (duration / 1000).toFixed(2),
        sync_timestamp: new Date().toISOString(),
        force_full_sync: forceFullSync
      }
    });
    
  } catch (error: any) {
    console.error('❌ Error during enhanced SKU sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync SKUs with enhanced logic',
      details: error.message,
      sync_timestamp: new Date().toISOString()
    });
  }
});

// POST /api/enhanced-sku-master/sync-all - Sync all sheets with enhanced parsing
router.post('/sync-all', async (req: Request, res: Response) => {
  try {
    console.log('🔄 Enhanced SKU Master API: Starting full sync of all sheets');
    console.log(`📅 Full sync started at: ${new Date().toISOString()}`);
    
    const startTime = Date.now();
    
    // Get all available sheets and sync them
    const sheets = ['enhanced', 'phones', 'tablets', 'watches', 'accessories']; // Add your sheet names
    const results = [];
    
    for (const sheetName of sheets) {
      try {
        console.log(`📊 Syncing sheet: ${sheetName}`);
        const sheetResult = await enhancedGoogleSheetsService.syncSkusWithTags(sheetName, true);
        results.push({
          sheet_name: sheetName,
          success: true,
          data: sheetResult
        });
        console.log(`✅ Sheet ${sheetName} synced successfully`);
      } catch (sheetError: any) {
        console.error(`❌ Error syncing sheet ${sheetName}:`, sheetError.message);
        results.push({
          sheet_name: sheetName,
          success: false,
          error: sheetError.message
        });
      }
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const successfulSheets = results.filter(r => r.success).length;
    const failedSheets = results.filter(r => !r.success).length;
    
    console.log('✅ Enhanced SKU Master API: Full sync completed');
    console.log(`⏱️ Total sync duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
    console.log(`📊 Results: ${successfulSheets} successful, ${failedSheets} failed`);
    
    res.json({
      success: true,
      message: `Full sync completed: ${successfulSheets} successful, ${failedSheets} failed`,
      data: {
        total_sheets: sheets.length,
        successful_sheets: successfulSheets,
        failed_sheets: failedSheets,
        sync_duration_ms: duration,
        sync_duration_seconds: (duration / 1000).toFixed(2),
        sync_timestamp: new Date().toISOString(),
        sheet_results: results
      }
    });
    
  } catch (error: any) {
    console.error('❌ Error during full SKU sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync all SKU sheets',
      details: error.message,
      sync_timestamp: new Date().toISOString()
    });
  }
});

// GET /api/enhanced-sku-master/sync-status - Get current sync status
router.get('/sync-status', async (req: Request, res: Response) => {
  try {
    const pool = new Pool({
      connectionString: process.env['DIRECT_URL'],
      max: 1,
      idleTimeoutMillis: 0,
      connectionTimeoutMillis: 30000,
    });
    
    const client = await pool.connect();
    
    try {
      // Get last sync information
      const lastSyncResult = await client.query(`
        SELECT 
          MAX(last_synced) as last_sync_time,
          COUNT(*) as total_skus,
          COUNT(CASE WHEN sku_tags IS NOT NULL AND array_length(sku_tags, 1) > 0 THEN 1 END) as tagged_skus
        FROM sku_master 
        WHERE is_active = true
      `);
      
      const lastSync = lastSyncResult.rows[0];
      
      // Get sync statistics by sheet
      const sheetStatsResult = await client.query(`
        SELECT 
          source_tab,
          COUNT(*) as sku_count,
          MAX(last_synced) as last_synced
        FROM sku_master 
        WHERE is_active = true
        GROUP BY source_tab
        ORDER BY last_synced DESC
      `);
      
      res.json({
        success: true,
        data: {
          last_sync_time: lastSync.last_sync_time,
          total_skus: parseInt(lastSync.total_skus),
          tagged_skus: parseInt(lastSync.tagged_skus),
          tag_coverage: lastSync.total_skus > 0 ? 
            ((parseInt(lastSync.tagged_skus) / parseInt(lastSync.total_skus)) * 100).toFixed(2) + '%' : '0%',
          sheet_statistics: sheetStatsResult.rows,
          status_timestamp: new Date().toISOString()
        }
      });
      
    } finally {
      client.release();
      await pool.end();
    }
    
  } catch (error: any) {
    console.error('❌ Error getting sync status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sync status',
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
