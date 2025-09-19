import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { logger } from '../utils/logger';

const router = Router();

interface CleanupOptions {
  preserveEssential?: boolean;
  cleanImeiData?: boolean;
  cleanSkuData?: boolean;
  cleanQueueData?: boolean;
  resetSequences?: boolean;
  dryRun?: boolean;
}

interface CleanupResult {
  success: boolean;
  message: string;
  data: {
    tablesFound: number;
    tablesCleaned: number;
    rowsDeleted: number;
    sequencesReset: number;
    essentialTablesPreserved: string[];
    cleanedTables: Array<{
      tableName: string;
      rowsDeleted: number;
      sequenceReset: boolean;
      error?: string;
    }>;
    verification: Array<{
      tableName: string;
      rowCount: number;
      status: 'cleaned' | 'preserved' | 'error';
    }>;
  };
  timestamp: string;
}

class DatabaseCleanupService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env['DIRECT_URL'],
      connectionTimeoutMillis: 30000,
    });
  }

  async performCleanup(options: CleanupOptions = {}): Promise<CleanupResult> {
    const {
      preserveEssential = true,
      cleanImeiData = true,
      cleanSkuData = false,
      cleanQueueData = true,
      resetSequences = true,
      dryRun = false
    } = options;

    const client = await this.pool.connect();
    
    try {
      logger.info('🧹 Starting database cleanup...');
      
      // Get list of all tables
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      
      const allTables = tablesResult.rows.map(row => row.table_name);
      logger.info(`📊 Found ${allTables.length} tables in database`);
      
      // Essential tables to preserve
      const essentialTables = [
        'sku_master',
        'normalization_tags',
        'abbreviation_mappings',
        'warehouse',
        'department',
        'location',
        'sku_brand_reference',
        'sku_model_reference',
        'sku_color_reference',
        'sku_carrier_reference',
        'sku_capacity_reference',
        'sku_postfix_reference',
        'sku_device_type_reference'
      ];
      
      // Tables to clean based on options
      let tablesToClean: string[] = [];
      
      if (cleanImeiData) {
        tablesToClean.push(
          'data_queue',
          'device_test',
          'inventory',
          'item',
          'product',
          'sku_matching_results',
          'undefined_sku',
          'no_match_queue',
          'sku_matching_queue',
          'imei_sku_info',
          'imei_inspect_data',
          'imei_units',
          'sku_sync_log',
          'sku_match_log',
          'sku_manual_update_log'
        );
      }
      
      if (cleanSkuData) {
        tablesToClean.push('sku_master');
      }
      
      if (cleanQueueData) {
        tablesToClean.push('data_queue', 'sku_matching_queue');
      }
      
      // Remove duplicates and filter out essential tables if preserving
      if (preserveEssential) {
        tablesToClean = tablesToClean.filter(table => !essentialTables.includes(table));
      }
      
      const cleanedTables: Array<{
        tableName: string;
        rowsDeleted: number;
        sequenceReset: boolean;
        error?: string;
      }> = [];
      
      let totalRowsDeleted = 0;
      let sequencesReset = 0;
      
      // Perform cleanup
      for (const tableName of tablesToClean) {
        if (allTables.includes(tableName)) {
          try {
            // Check if table has data
            const countResult = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
            const count = parseInt(countResult.rows[0].count);
            
            if (count > 0) {
              if (!dryRun) {
                // Delete all data
                await client.query(`DELETE FROM ${tableName}`);
                logger.info(`🗑️ ${tableName}: deleted ${count} rows`);
                
                // Reset sequence if it exists
                let sequenceReset = false;
                if (resetSequences) {
                  try {
                    await client.query(`ALTER SEQUENCE ${tableName}_id_seq RESTART WITH 1`);
                    sequenceReset = true;
                    sequencesReset++;
                    logger.info(`🔄 ${tableName}: reset sequence`);
                  } catch (seqError) {
                    // Sequence might not exist or have different name, that's okay
                    logger.info(`⚠️ ${tableName}: no sequence to reset`);
                  }
                }
                
                cleanedTables.push({
                  tableName,
                  rowsDeleted: count,
                  sequenceReset
                });
                
                totalRowsDeleted += count;
              } else {
                logger.info(`🔍 [DRY RUN] ${tableName}: would delete ${count} rows`);
                cleanedTables.push({
                  tableName,
                  rowsDeleted: count,
                  sequenceReset: false
                });
                totalRowsDeleted += count;
              }
            } else {
              logger.info(`✅ ${tableName}: already empty`);
              cleanedTables.push({
                tableName,
                rowsDeleted: 0,
                sequenceReset: false
              });
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`❌ ${tableName}: cleanup failed - ${errorMsg}`);
            cleanedTables.push({
              tableName,
              rowsDeleted: 0,
              sequenceReset: false,
              error: errorMsg
            });
          }
        } else {
          logger.info(`⚠️ ${tableName}: table not found`);
        }
      }
      
      // Verification
      const verification: Array<{
        tableName: string;
        rowCount: number;
        status: 'cleaned' | 'preserved' | 'error';
      }> = [];
      
      // Check cleaned tables
      for (const tableName of tablesToClean) {
        if (allTables.includes(tableName)) {
          try {
            const countResult = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
            const count = parseInt(countResult.rows[0].count);
            verification.push({
              tableName,
              rowCount: count,
              status: 'cleaned'
            });
          } catch (error) {
            verification.push({
              tableName,
              rowCount: 0,
              status: 'error'
            });
          }
        }
      }
      
      // Check essential tables
      for (const tableName of essentialTables) {
        if (allTables.includes(tableName)) {
          try {
            const countResult = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
            const count = parseInt(countResult.rows[0].count);
            verification.push({
              tableName,
              rowCount: count,
              status: 'preserved'
            });
          } catch (error) {
            verification.push({
              tableName,
              rowCount: 0,
              status: 'error'
            });
          }
        }
      }
      
      const result: CleanupResult = {
        success: true,
        message: dryRun ? 
          `Dry run completed: would clean ${tablesToClean.length} tables, delete ${totalRowsDeleted} rows` :
          `Database cleanup completed: cleaned ${tablesToClean.length} tables, deleted ${totalRowsDeleted} rows`,
        data: {
          tablesFound: allTables.length,
          tablesCleaned: tablesToClean.length,
          rowsDeleted: totalRowsDeleted,
          sequencesReset,
          essentialTablesPreserved: essentialTables.filter(table => allTables.includes(table)),
          cleanedTables,
          verification
        },
        timestamp: new Date().toISOString()
      };
      
      logger.info('✅ Database cleanup completed successfully');
      return result;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('❌ Database cleanup failed:', errorMsg);
      
      return {
        success: false,
        message: `Database cleanup failed: ${errorMsg}`,
        data: {
          tablesFound: 0,
          tablesCleaned: 0,
          rowsDeleted: 0,
          sequencesReset: 0,
          essentialTablesPreserved: [],
          cleanedTables: [],
          verification: []
        },
        timestamp: new Date().toISOString()
      };
    } finally {
      client.release();
    }
  }

  async getDatabaseStatus(): Promise<any> {
    const client = await this.pool.connect();
    
    try {
      // Get all tables with row counts
      const tablesResult = await client.query(`
        SELECT 
          t.table_name,
          COALESCE(s.n_tup_ins - s.n_tup_del, 0) as estimated_rows
        FROM information_schema.tables t
        LEFT JOIN pg_stat_user_tables s ON t.table_name = s.relname
        WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name
      `);
      
      // Get actual row counts for key tables
      const keyTables = [
        'sku_master', 'data_queue', 'item', 'inventory', 
        'sku_matching_results', 'undefined_sku'
      ];
      
      const actualCounts: any = {};
      for (const tableName of keyTables) {
        try {
          const countResult = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
          actualCounts[tableName] = parseInt(countResult.rows[0].count);
        } catch (error) {
          actualCounts[tableName] = 0;
        }
      }
      
      return {
        totalTables: tablesResult.rows.length,
        tables: tablesResult.rows,
        keyTableCounts: actualCounts,
        timestamp: new Date().toISOString()
      };
      
    } finally {
      client.release();
    }
  }
}

const cleanupService = new DatabaseCleanupService();

/**
 * POST /api/database-cleanup/cleanup
 * Perform database cleanup with options
 */
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const options: CleanupOptions = req.body || {};
    
    logger.info('🧹 Database cleanup requested with options:', options);
    
    const result = await cleanupService.performCleanup(options);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
    
  } catch (error) {
    logger.error('❌ Error during database cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Database cleanup failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/database-cleanup/status
 * Get current database status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await cleanupService.getDatabaseStatus();
    
    res.json({
      success: true,
      data: status
    });
    
  } catch (error) {
    logger.error('❌ Error getting database status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get database status',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/database-cleanup/cleanup-imei
 * Quick cleanup for IMEI-related data only
 */
router.post('/cleanup-imei', async (req: Request, res: Response) => {
  try {
    const result = await cleanupService.performCleanup({
      preserveEssential: true,
      cleanImeiData: true,
      cleanSkuData: false,
      cleanQueueData: true,
      resetSequences: true,
      dryRun: false
    });
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
    
  } catch (error) {
    logger.error('❌ Error during IMEI cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'IMEI cleanup failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/database-cleanup/dry-run
 * Perform a dry run to see what would be cleaned
 */
router.post('/dry-run', async (req: Request, res: Response) => {
  try {
    const options: CleanupOptions = { ...req.body, dryRun: true };
    
    const result = await cleanupService.performCleanup(options);
    
    res.json(result);
    
  } catch (error) {
    logger.error('❌ Error during dry run:', error);
    res.status(500).json({
      success: false,
      message: 'Dry run failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
});

export default router;



