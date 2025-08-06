import { Request, Response } from 'express';
import { InventoryService } from '../services/inventory.service';
import { 
  createInventorySchema, 
  updateInventorySchema, 
  queryParamsSchema, 
  skuParamSchema,
  idParamSchema
} from '../utils/validator';
import { logger } from '../utils/logger';

export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  getAllInventory = async (req: Request, res: Response): Promise<void> => {
    try {
      const queryParams = queryParamsSchema.parse(req.query);
      const result = await this.inventoryService.getAllInventory(queryParams);

      res.status(200).json({
        success: true,
        data: result.inventory,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          pages: Math.ceil(result.total / result.limit)
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getAllInventory controller', { error: errorMessage });
      res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
  };

  getInventoryBySku = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sku } = skuParamSchema.parse(req.params);
      const inventory = await this.inventoryService.getInventoryBySku(sku);

      res.status(200).json({
        success: true,
        data: inventory
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getInventoryBySku controller', { error: errorMessage });
      
      if (errorMessage.includes('not found')) {
        res.status(404).json({
          success: false,
          error: errorMessage
        });
      } else {
        res.status(400).json({
          success: false,
          error: errorMessage
        });
      }
    }
  };

  createOrUpdateInventory = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = createInventorySchema.parse(req.body);
      const inventory = await this.inventoryService.createOrUpdateInventory(validatedData);

      res.status(201).json({
        success: true,
        data: inventory,
        message: 'Inventory created/updated successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in createOrUpdateInventory controller', { error: errorMessage });
      res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
  };

  updateInventory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const validatedData = updateInventorySchema.parse(req.body);
      const inventory = await this.inventoryService.updateInventory(id, validatedData);

      res.status(200).json({
        success: true,
        data: inventory,
        message: 'Inventory updated successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in updateInventory controller', { error: errorMessage });
      
      if (errorMessage.includes('not found')) {
        res.status(404).json({
          success: false,
          error: errorMessage
        });
      } else {
        res.status(400).json({
          success: false,
          error: errorMessage
        });
      }
    }
  };

  deleteInventory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = idParamSchema.parse(req.params);
      await this.inventoryService.deleteInventory(id);

      res.status(200).json({
        success: true,
        message: 'Inventory deleted successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in deleteInventory controller', { error: errorMessage });
      
      if (errorMessage.includes('not found')) {
        res.status(404).json({
          success: false,
          error: errorMessage
        });
      } else {
        res.status(400).json({
          success: false,
          error: errorMessage
        });
      }
    }
  };
} 