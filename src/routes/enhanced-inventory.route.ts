import { Router } from 'express';
import { SupabaseAdminController } from '../controllers/supabase-admin.controller';
import { SupabaseAdminService } from '../services/supabase-admin.service';

const router = Router();

// Initialize services and controllers for enhanced inventory (using aligned structure)
const supabaseAdminService = new SupabaseAdminService();
const supabaseAdminController = new SupabaseAdminController(supabaseAdminService);

// Enhanced Inventory Routes (now using aligned structure)
router.post('/add', supabaseAdminController.pushInventory);
router.post('/bulk-add', supabaseAdminController.pushInventory); // Single item or bulk
router.get('/inventory', supabaseAdminController.getInventory);
router.get('/locations', supabaseAdminController.getLocations);

export default router;
