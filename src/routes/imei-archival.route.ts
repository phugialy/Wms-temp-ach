import { Router } from 'express';
import ImeiArchivalController from '../controllers/imei-archival.controller';

const router = Router();

// Archive operations
router.post('/archive', ImeiArchivalController.archiveImei);
router.get('/stats', ImeiArchivalController.getArchiveStats);
router.get('/records/:imei', ImeiArchivalController.getArchivedRecords);
router.get('/records', ImeiArchivalController.getAllArchivedRecords);
router.post('/restore/:imei', ImeiArchivalController.restoreArchivedImei);
router.delete('/permanent/:imei', ImeiArchivalController.permanentlyDeleteArchived);

// Data log operations
router.get('/logs', ImeiArchivalController.getDataLogRecords);
router.get('/logs/stats', ImeiArchivalController.getDataLogStats);
router.get('/metrics', ImeiArchivalController.getProcessingMetrics);

// Cleanup operations
router.post('/cleanup', ImeiArchivalController.cleanupOldQueueData);

export default router;
