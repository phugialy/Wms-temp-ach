import { Request, Response } from 'express';
import { z } from 'zod';
import { InventoryService } from '../services/inventoryService';
import { logger } from '../utils/logger';

// Validation schemas
const createInventorySchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  quantity: z.number().int().min(0, 'Quantity must be a non-negative integer'),
  location: z.string().min(1, 'Location is required')
});

const updateInventorySchema = z.object({
  quantity: z.number().int().min(0).optional(),
  location: z.string().min(1).optional()
});

const queryParamsSchema = z.object({
  page: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(100)).default('10'),
  sku: z.string().optional(),
  location: z.string().optional()
});

const idParamSchema = z.object({
  id: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive())
});

const skuParamSchema = z.object({
  sku: z.string().min(1, 'SKU parameter is required')
});

const locationParamSchema = z.object({
  location: z.string().min(1, 'Location parameter is required')
});

const skuLocationParamSchema = z.object({
  sku: z.string().min(1, 'SKU parameter is required'),
  location: z.string().min(1, 'Location parameter is required')
});

export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  createInventory = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = createInventorySchema.parse(req.body);
      const inventory = await this.inventoryService.createInventory(validatedData);
      
      res.status(201).json({
        success: true,
        data: inventory,
        message: 'Inventory record created successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in createInventory controller', { error: errorMessage });
      res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
  };

  getInventoryById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const inventory = await this.inventoryService.getInventoryById(id);
      
      res.status(200).json({
        success: true,
        data: inventory
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getInventoryById controller', { error: errorMessage });
      res.status(404).json({
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
      res.status(404).json({
        success: false,
        error: errorMessage
      });
    }
  };

  getInventoryByLocation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { location } = locationParamSchema.parse(req.params);
      const inventory = await this.inventoryService.getInventoryByLocation(location);
      
      res.status(200).json({
        success: true,
        data: inventory
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getInventoryByLocation controller', { error: errorMessage });
      res.status(404).json({
        success: false,
        error: errorMessage
      });
    }
  };

  getInventoryBySkuAndLocation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sku, location } = skuLocationParamSchema.parse(req.params);
      const inventory = await this.inventoryService.getInventoryBySkuAndLocation(sku, location);
      
      res.status(200).json({
        success: true,
        data: inventory
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getInventoryBySkuAndLocation controller', { error: errorMessage });
      res.status(404).json({
        success: false,
        error: errorMessage
      });
    }
  };

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

  updateInventory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const validatedData = updateInventorySchema.parse(req.body);
      const inventory = await this.inventoryService.updateInventory(id, validatedData);
      
      res.status(200).json({
        success: true,
        data: inventory,
        message: 'Inventory record updated successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in updateInventory controller', { error: errorMessage });
      res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
  };

  deleteInventory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = idParamSchema.parse(req.params);
      await this.inventoryService.deleteInventory(id);
      
      res.status(200).json({
        success: true,
        message: 'Inventory record deleted successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in deleteInventory controller', { error: errorMessage });
      res.status(404).json({
        success: false,
        error: errorMessage
      });
    }
  };
} 