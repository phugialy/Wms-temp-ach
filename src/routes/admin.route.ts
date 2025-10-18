import { Router } from 'express';
import { SupabaseAdminController } from '../controllers/supabase-admin.controller';
import { SupabaseAdminService } from '../services/supabase-admin.service';

const router = Router();
const supabaseAdminService = new SupabaseAdminService();
const supabaseAdminController = new SupabaseAdminController(supabaseAdminService);

// Admin inventory management routes (using Supabase API)
router.post('/inventory-push', supabaseAdminController.pushInventory);
// Note: /inventory route moved to inventoryApi.ts for better SKU matching integration

// Simple mock locations endpoint to replace problematic Supabase Location table query
router.get('/locations', async (req, res) => {
  try {
    console.log('👨‍💼 Admin API: Getting available locations (mock data)');
    
    const mockLocations = [
      { id: 'DNCL-Inspection', name: 'DNCL Inspection', type: 'Inspection' },
      { id: 'DNCL-SHIPOUT', name: 'DNCL Ship Out', type: 'Shipping' },
      { id: 'DNCL-REPAIR', name: 'DNCL Repair', type: 'Repair' },
      { id: 'DNCL-STORAGE', name: 'DNCL Storage', type: 'Storage' },
      { id: 'DNCL-TESTING', name: 'DNCL Testing', type: 'Testing' },
      { id: 'DNCL-QUALITY', name: 'DNCL Quality Control', type: 'Quality' }
    ];
    
    console.log(`✅ Admin API: Found ${mockLocations.length} locations`);
    
    res.json({
      success: true,
      locations: mockLocations,
      count: mockLocations.length
    });
    
  } catch (error) {
    console.error('❌ Error getting locations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get locations',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});
router.post('/cleanup-imei', supabaseAdminController.cleanupImeiData);
router.get('/search-imei', supabaseAdminController.searchAllImeiData);
router.get('/all-imei-data', supabaseAdminController.getAllImeiData);
router.post('/cleanup-multiple-imei', supabaseAdminController.cleanupMultipleImeiData);
router.post('/cleanup-all-imei', supabaseAdminController.cleanupAllImeiData);
router.get('/deletion-stats', supabaseAdminController.getDeletionStats);
router.post('/restore-imei', supabaseAdminController.restoreImeiData);

export default router; 