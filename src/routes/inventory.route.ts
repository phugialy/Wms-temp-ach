import { Router } from 'express';
import { InventoryController } from '../controllers/inventory.controller';
import { InventoryService } from '../services/inventory.service';
import prisma from '../prisma/client';

const router = Router();
const inventoryService = new InventoryService(prisma);
const inventoryController = new InventoryController(inventoryService);

// Inventory CRUD routes
router.get('/', inventoryController.getAllInventory);
router.get('/:sku', inventoryController.getInventoryBySku);
router.post('/', inventoryController.createInventory);
router.put('/:id', inventoryController.updateInventory);
router.delete('/:id', inventoryController.deleteInventory);

export default router; 