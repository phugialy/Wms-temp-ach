import { Router } from 'express';
import { PhonecheckController } from '../controllers/phonecheck.controller';
import { PhonecheckService } from '../services/phonecheck.service';

const router = Router();
const phonecheckService = new PhonecheckService();
const phonecheckController = new PhonecheckController(phonecheckService);

// Phonecheck bulk operations routes
router.post('/pull-devices', phonecheckController.pullDevicesFromStation);
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
