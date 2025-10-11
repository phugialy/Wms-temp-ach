import { Router } from 'express';
import { PhonecheckController } from '../controllers/phonecheck.controller';
import { PhonecheckService } from '../services/phonecheck.service';
import BulkPhonecheckVerifyService from '../services/BulkPhonecheckVerifyService';
import { dbService } from '../services/DatabaseConnectionService';
import { logger } from '../utils/logger';

const router = Router();
const phonecheckService = new PhonecheckService();
const phonecheckController = new PhonecheckController(phonecheckService);
const bulkVerifyService = new BulkPhonecheckVerifyService();

// Phonecheck lookup route (for single-add functionality)
router.post('/lookup', phonecheckController.lookupDevice);

// Phonecheck bulk operations routes
router.post('/pull-devices', phonecheckController.pullDevicesFromStation);

// Bulk verify IMEIs against Phonecheck and queue to DB
router.post('/bulk-verify', async (req, res) => {
  const startTime = Date.now();
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Items array is required and must not be empty',
        processingTime: Date.now() - startTime
      });
      return;
    }

    const result = await bulkVerifyService.verifyAndQueue(items);

    if (!result.success) {
      res.status(207).json({
        ...result,
        success: false
      });
      return;
    }

    res.json({
      ...result,
      success: true
    });
  } catch (error) {
    logger.error('Bulk verify failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      processingTime: Date.now() - startTime
    });
  }
});

// Export bulk verify results as CSV (similar to manage inventory export)
router.get('/bulk-verify/export', async (req, res) => {
  const startTime = Date.now();
  try {
    const batchId = String(req.query['batchId'] || '').trim();

    if (!batchId) {
      res.status(400).json({
        success: false,
        error: 'batchId is required',
        processingTime: Date.now() - startTime
      });
      return;
    }

    // Pull from imei_data_queue to reflect the just-verified records
    const query = `
      SELECT 
        imei,
        brand,
        model,
        capacity,
        color,
        carrier,
        working_status,
        battery_health,
        created_at
      FROM imei_data_queue
      WHERE batch_id = $1 AND source = 'phonecheck-bulk'
      ORDER BY imei
    `;

    const result = await dbService.query(query, [batchId]);

    // Mirror manage inventory export headers as closely as possible
    const headers = [
      'ID',
      'Name',
      'Brand',
      'Model',
      'IMEI',
      'Serial Number',
      'SKU',
      'Working Status',
      'Condition',
      'Battery Health',
      'Carrier',
      'Storage',
      'Color',
      'Created At'
    ];

    const csvRows = result.rows.map((row: any, idx: number) => [
      idx + 1, // ID (sequential for export)
      '"' + (row.model || '') + '"', // Name (fallback to model)
      '"' + (row.brand || '') + '"',
      '"' + (row.model || '') + '"',
      row.imei || '',
      '""', // Serial Number unknown
      '""', // SKU unknown at this stage
      '"' + (row.working_status || 'PENDING') + '"',
      '""', // Condition unknown at this stage
      row.battery_health || '',
      '"' + (row.carrier || '') + '"',
      '"' + (row.capacity || '') + '"',
      '"' + (row.color || '') + '"',
      row.created_at || ''
    ].join(','));

    const csv = [headers.join(','), ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="bulk_phonecheck_${batchId}.csv"`);
    res.send(csv);
  } catch (error) {
    logger.error('Bulk verify export failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      processingTime: Date.now() - startTime
    });
  }
});
router.get('/device/:imei', phonecheckController.getDeviceDetails);
router.get('/device/:imei/enhanced', phonecheckController.getDeviceDetailsEnhanced);
router.post('/process-bulk', phonecheckController.processBulkDevices);
router.post('/process-bulk-chunked', phonecheckController.processBulkDevicesChunked);
router.post('/process-bulk-optimized', phonecheckController.processBulkDevicesOptimized);
router.post('/process-bulk-smart', phonecheckController.processBulkDevicesSmart);

// Cache management routes
router.delete('/cache', phonecheckController.clearCache);
router.get('/cache/stats', phonecheckController.getCacheStats);

export default router;
