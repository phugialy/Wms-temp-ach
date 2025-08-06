import { Router } from 'express';
import { InventoryController } from '../controllers/inventoryController';
import { InventoryService } from '../services/inventoryService';
import prisma from '../lib/prisma';

const router = Router();
const inventoryService = new InventoryService(prisma);
const inventoryController = new InventoryController(inventoryService);

// Inventory CRUD routes
router.post('/', inventoryController.createInventory);
router.get('/', inventoryController.getAllInventory);
router.get('/sku/:sku', inventoryController.getInventoryBySku);
router.get('/location/:location', inventoryController.getInventoryByLocation);
router.get('/sku/:sku/location/:location', inventoryController.getInventoryBySkuAndLocation);
router.get('/:id', inventoryController.getInventoryById);
router.put('/:id', inventoryController.updateInventory);
router.delete('/:id', inventoryController.deleteInventory);

export default router; 