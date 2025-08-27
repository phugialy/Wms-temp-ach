import { Router } from 'express';
import { hybridQueueController } from '../controllers/hybrid-queue.controller';

const router = Router();

// Queue Management Routes
router.post('/add', hybridQueueController.addToQueue);
router.get('/stats', hybridQueueController.getQueueStats);
router.post('/process-next', hybridQueueController.processNextItem);
router.get('/items', hybridQueueController.getQueueItems);
router.post('/retry-failed', hybridQueueController.retryFailedItems);
router.delete('/clear-completed', hybridQueueController.clearCompletedItems);

// Batch Management Routes
router.get('/batch/:batchId', hybridQueueController.getBatchStats);

// Processing Control Routes
router.post('/start', hybridQueueController.startProcessing);
router.post('/stop', hybridQueueController.stopProcessing);

export default router;

