import { Router } from 'express';
import ImeiQueueController from '../controllers/imei-queue.controller';

const router = Router();

// Queue management routes
router.post('/add', ImeiQueueController.addToQueue);
router.get('/stats', ImeiQueueController.getQueueStats);
router.get('/items', ImeiQueueController.getQueueItems);
router.post('/process-pending', ImeiQueueController.processAllPending);
router.post('/retry-failed', ImeiQueueController.retryFailedItems);
router.post('/clear-completed', ImeiQueueController.clearCompletedItems);

// IMEI data routes
router.get('/imei/:imei', ImeiQueueController.getImeiData);
router.get('/imei', ImeiQueueController.getAllImeiData);

export default router;
