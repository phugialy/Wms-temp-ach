import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { AdminService } from '../services/admin.service';
import prisma from '../prisma/client';

const router = Router();
const adminService = new AdminService(prisma);
const adminController = new AdminController(adminService);

// Admin inventory management routes
router.post('/inventory-push', adminController.pushInventory);
router.get('/inventory', adminController.getInventory);
router.put('/inventory/:id', adminController.updateInventoryItem);
router.delete('/inventory/bulk-delete', adminController.deleteInventoryItems);
router.get('/locations', adminController.getLocations);

export default router; 