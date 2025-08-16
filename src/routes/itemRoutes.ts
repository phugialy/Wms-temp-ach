import { Router } from 'express';
import { ItemController } from '../controllers/itemController';
import { ItemService } from '../services/itemService';
import prisma from '../prisma/client';

const router = Router();
const itemService = new ItemService(prisma);
const itemController = new ItemController(itemService);

// Item CRUD routes
router.post('/', itemController.createItem);
router.get('/', itemController.getAllItems);
router.get('/brands', itemController.getItemBrands);
router.get('/brand/:brand', itemController.getItemsByBrand);
router.get('/sku/:sku', itemController.getItemBySku);
router.get('/:id', itemController.getItemById);
router.put('/:id', itemController.updateItem);
router.delete('/:id', itemController.deleteItem);

export default router; 