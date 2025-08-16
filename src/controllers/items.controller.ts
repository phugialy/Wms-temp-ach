import { Request, Response } from 'express';
import { ItemsService } from '../services/items.service';
import { 
  createItemSchema, 
  updateItemSchema, 
  queryParamsSchema, 
  skuParamSchema 
} from '../utils/validator';
import { logger } from '../utils/logger';

export class ItemsController {
  constructor(private itemsService: ItemsService) {}

  getAllItems = async (req: Request, res: Response): Promise<void> => {
    try {
      const queryParams = queryParamsSchema.parse(req.query);
      const result = await this.itemsService.getAllItems(queryParams);

      res.status(200).json({
        success: true,
        data: result.items,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          pages: Math.ceil(result.total / result.limit)
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getAllItems controller', { error: errorMessage });
      res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
  };

  getItemBySku = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sku } = skuParamSchema.parse(req.params);
      const item = await this.itemsService.getItemBySku(sku);

      res.status(200).json({
        success: true,
        data: item
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getItemBySku controller', { error: errorMessage });
      
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

  createItem = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = createItemSchema.parse(req.body);
      const item = await this.itemsService.createItem(validatedData);

      res.status(201).json({
        success: true,
        data: item,
        message: 'Item created successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in createItem controller', { error: errorMessage });
      res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
  };

  updateItem = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sku } = skuParamSchema.parse(req.params);
      const validatedData = updateItemSchema.parse(req.body);
      const item = await this.itemsService.updateItem(sku, validatedData);

      res.status(200).json({
        success: true,
        data: item,
        message: 'Item updated successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in updateItem controller', { error: errorMessage });
      
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

  deleteItem = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sku } = skuParamSchema.parse(req.params);
      await this.itemsService.deleteItem(sku);

      res.status(200).json({
        success: true,
        message: 'Item deleted successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in deleteItem controller', { error: errorMessage });
      
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