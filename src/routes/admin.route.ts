import { Router } from 'express';
import { SupabaseAdminController } from '../controllers/supabase-admin.controller';
import { SupabaseAdminService } from '../services/supabase-admin.service';

const router = Router();
const supabaseAdminService = new SupabaseAdminService();
const supabaseAdminController = new SupabaseAdminController(supabaseAdminService);

// Admin inventory management routes (using Supabase API)
router.post('/inventory-push', supabaseAdminController.pushInventory);
router.get('/inventory', supabaseAdminController.getInventory);
router.get('/locations', supabaseAdminController.getLocations);
router.post('/cleanup-imei', supabaseAdminController.cleanupImeiData);
router.get('/search-imei', supabaseAdminController.searchAllImeiData);
router.get('/all-imei-data', supabaseAdminController.getAllImeiData);
router.post('/cleanup-multiple-imei', supabaseAdminController.cleanupMultipleImeiData);
router.post('/cleanup-all-imei', supabaseAdminController.cleanupAllImeiData);
router.get('/deletion-stats', supabaseAdminController.getDeletionStats);
router.post('/restore-imei', supabaseAdminController.restoreImeiData);

export default router; 