import { Router } from 'express';
import SynchronousWorkflowController from '../controllers/synchronous-workflow.controller';

const router = Router();

/**
 * Complete synchronous workflow endpoint
 * POST /api/workflow/process-bulk
 * 
 * Body: {
 *   items: [
 *     {
 *       imei: "123456789012345",
 *       brand: "Samsung",
 *       model: "Galaxy S23",
 *       color: "Black",
 *       carrier: "Unlocked",
 *       working: "YES",
 *       capacity: "128GB",
 *       location: "Incoming"
 *     }
 *   ]
 * }
 * 
 * Response: {
 *   success: true,
 *   summary: {
 *     totalItems: 1,
 *     queueAdded: 1,
 *     processedItems: 1,
 *     skuMatchedItems: 1,
 *     processingTime: 150.5,
 *     totalTime: 200.3
 *   },
 *   errors: {
 *     queueErrors: [],
 *     processingErrors: [],
 *     skuMatchingErrors: []
 *   },
 *   results: [
 *     {
 *       imei: "123456789012345",
 *       status: "success",
 *       product: { ... },
 *       item: { ... },
 *       skuMatch: { ... }
 *     }
 *   ],
 *   message: "Successfully processed 1 items in 200.3ms"
 * }
 */
router.post('/process-bulk', SynchronousWorkflowController.processBulkItems);

/**
 * Get workflow status
 * GET /api/workflow/status
 */
router.get('/status', SynchronousWorkflowController.getWorkflowStatus);

export default router;
