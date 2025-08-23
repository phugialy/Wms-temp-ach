import { Router } from 'express';
import BulkInventoryController from '../controllers/bulk-inventory.controller';

const router = Router();

// Bulk inventory processing routes
router.post('/bulk-process', BulkInventoryController.processBulkItems);
router.get('/bulk-status', BulkInventoryController.getBulkStatus);

export default router;
