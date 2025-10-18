import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import BulkAddAuditService from '../services/BulkAddAuditService';

const router = Router();
const auditService = new BulkAddAuditService();

/**
 * GET /api/bulk-add-audit/history
 * Get bulk-add audit history
 */
router.get('/history', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const limit = parseInt(req.query['limit'] as string) || 50;
    const station = req.query['station'] as string;
    
    logger.info(`📊 AUDIT: Getting bulk-add history - Limit: ${limit}, Station: ${station || 'all'}`);
    
    let history;
    if (station) {
      history = await auditService.getBulkAddHistoryByStation(station, limit);
    } else {
      history = await auditService.getBulkAddHistory(limit);
    }
    
    res.json({
      success: true,
      data: {
        history,
        totalRecords: history.length,
        limit,
        station: station || 'all'
      },
      processingTime: Date.now() - startTime
    });

  } catch (error) {
    logger.error('❌ AUDIT HISTORY ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get audit history',
      details: error instanceof Error ? error.message : String(error),
      processingTime: Date.now() - startTime
    });
  }
});

/**
 * GET /api/bulk-add-audit/statistics
 * Get bulk-add audit statistics
 */
router.get('/statistics', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    logger.info(`📊 AUDIT: Getting bulk-add statistics`);
    
    const statistics = await auditService.getAuditStatistics();
    
    res.json({
      success: true,
      data: statistics,
      processingTime: Date.now() - startTime
    });

  } catch (error) {
    logger.error('❌ AUDIT STATISTICS ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get audit statistics',
      details: error instanceof Error ? error.message : String(error),
      processingTime: Date.now() - startTime
    });
  }
});

/**
 * GET /api/bulk-add-audit/stations
 * Get list of stations with recent activity
 */
router.get('/stations', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    logger.info(`📊 AUDIT: Getting station list`);
    
    // Get recent history to extract unique stations
    const history = await auditService.getBulkAddHistory(100);
    const stations = [...new Set(history.map(record => record.station))];
    
    res.json({
      success: true,
      data: {
        stations: stations.sort(),
        totalStations: stations.length
      },
      processingTime: Date.now() - startTime
    });

  } catch (error) {
    logger.error('❌ AUDIT STATIONS ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get station list',
      details: error instanceof Error ? error.message : String(error),
      processingTime: Date.now() - startTime
    });
  }
});

export default router;
