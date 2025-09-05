import { Router } from 'express';
import ImeiQueueController from '../controllers/imei-queue.controller';

const router = Router();

// Queue management routes
router.post('/add', ImeiQueueController.addToQueue);
router.get('/queue-stats', ImeiQueueController.getQueueStats);
router.get('/items', ImeiQueueController.getQueueItems);
router.post('/process-pending', ImeiQueueController.processAllPending);
router.post('/retry-failed', ImeiQueueController.retryFailedItems);
router.post('/clear-completed', ImeiQueueController.clearCompletedItems);

// IMEI data routes
router.get('/imei/:imei', ImeiQueueController.getImeiData);
router.get('/imei', ImeiQueueController.getAllImeiData);

// Monitoring and logging routes
router.get('/status/:batchId', ImeiQueueController.getBatchStatus);
router.get('/logs', ImeiQueueController.getRecentLogs);
router.get('/processing-stats', ImeiQueueController.getProcessingStats);

export default router;
