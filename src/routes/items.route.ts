import { Router } from 'express';
import { ItemsController } from '../controllers/items.controller';
import { ItemsService } from '../services/items.service';
import prisma from '../prisma/client';

const router = Router();
const itemsService = new ItemsService(prisma);
const itemsController = new ItemsController(itemsService);

// Items CRUD routes
router.get('/', itemsController.getAllItems);
router.get('/:sku', itemsController.getItemBySku);
router.post('/', itemsController.createItem);
router.put('/:sku', itemsController.updateItem);
router.delete('/:sku', itemsController.deleteItem);

export default router; 