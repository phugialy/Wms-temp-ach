import { Request, Response } from 'express';
import { z } from 'zod';
import { ItemService } from '../services/itemService';
import { logger } from '../utils/logger';

// Validation schemas
const createItemSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  upc: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  condition: z.string().default('used'),
  cost: z.number().positive().optional(),
  price: z.number().positive().optional(),
  weightOz: z.number().int().positive().optional(),
  dimensions: z.string().optional(),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().default(true)
});

const updateItemSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  upc: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  condition: z.string().optional(),
  cost: z.number().positive().optional(),
  price: z.number().positive().optional(),
  weightOz: z.number().int().positive().optional(),
  dimensions: z.string().optional(),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().optional()
});

const queryParamsSchema = z.object({
  page: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(100)).default('10'),
  search: z.string().optional(),
  brand: z.string().optional(),
  condition: z.string().optional()
});

const idParamSchema = z.object({
  id: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive())
});

const brandParamSchema = z.object({
  brand: z.string().min(1, 'Brand parameter is required')
});

const skuParamSchema = z.object({
  sku: z.string().min(1, 'SKU parameter is required')
});

export class ItemController {
  constructor(private itemService: ItemService) {}

  createItem = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = createItemSchema.parse(req.body);
      
      // Transform validated data to match service interface
      const serviceData = {
        sku: validatedData.sku,
        name: validatedData.name,
        description: validatedData.description ?? null,
        upc: validatedData.upc ?? null,
        brand: validatedData.brand ?? null,
        model: validatedData.model ?? null,
        condition: validatedData.condition ?? null,
        cost: validatedData.cost ?? null,
        price: validatedData.price ?? null,
        weightOz: validatedData.weightOz ?? null,
        dimensions: validatedData.dimensions ?? null,
        imageUrl: validatedData.imageUrl ?? null,
        isActive: validatedData.isActive ?? null
      };
      
      const item = await this.itemService.createItem(serviceData);
      
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

  getItemById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const item = await this.itemService.getItemById(id);
      
      res.status(200).json({
        success: true,
        data: item
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getItemById controller', { error: errorMessage });
      res.status(404).json({
        success: false,
        error: errorMessage
      });
    }
  };

  getItemBySku = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sku } = skuParamSchema.parse(req.params);
      const item = await this.itemService.getItemBySku(sku);
      
      res.status(200).json({
        success: true,
        data: item
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getItemBySku controller', { error: errorMessage });
      res.status(404).json({
        success: false,
        error: errorMessage
      });
    }
  };

  getAllItems = async (req: Request, res: Response): Promise<void> => {
    try {
      const queryParams = queryParamsSchema.parse(req.query);
      const result = await this.itemService.getAllItems(queryParams);
      
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

  updateItem = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const validatedData = updateItemSchema.parse(req.body);
      
      // Transform validated data to match service interface
      const serviceData: any = {};
      if (validatedData.name !== undefined) serviceData.name = validatedData.name;
      if (validatedData.description !== undefined) serviceData.description = validatedData.description;
      if (validatedData.upc !== undefined) serviceData.upc = validatedData.upc;
      if (validatedData.brand !== undefined) serviceData.brand = validatedData.brand;
      if (validatedData.model !== undefined) serviceData.model = validatedData.model;
      if (validatedData.condition !== undefined) serviceData.condition = validatedData.condition;
      if (validatedData.cost !== undefined) serviceData.cost = validatedData.cost;
      if (validatedData.price !== undefined) serviceData.price = validatedData.price;
      if (validatedData.weightOz !== undefined) serviceData.weightOz = validatedData.weightOz;
      if (validatedData.dimensions !== undefined) serviceData.dimensions = validatedData.dimensions;
      if (validatedData.imageUrl !== undefined) serviceData.imageUrl = validatedData.imageUrl;
      if (validatedData.isActive !== undefined) serviceData.isActive = validatedData.isActive;
      
      const item = await this.itemService.updateItem(id, serviceData);
      
      res.status(200).json({
        success: true,
        data: item,
        message: 'Item updated successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in updateItem controller', { error: errorMessage });
      res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
  };

  deleteItem = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = idParamSchema.parse(req.params);
      await this.itemService.deleteItem(id);
      
      res.status(200).json({
        success: true,
        message: 'Item deleted successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in deleteItem controller', { error: errorMessage });
      res.status(404).json({
        success: false,
        error: errorMessage
      });
    }
  };

  getItemBrands = async (_req: Request, res: Response): Promise<void> => {
    try {
      const brands = await this.itemService.getItemBrands();
      
      res.status(200).json({
        success: true,
        data: brands
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getItemBrands controller', { error: errorMessage });
      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  };

  getItemsByBrand = async (req: Request, res: Response): Promise<void> => {
    try {
      const { brand } = brandParamSchema.parse(req.params);
      const queryParams = queryParamsSchema.parse(req.query);
      const result = await this.itemService.getItemsByBrand(brand, queryParams);
      
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
      logger.error('Error in getItemsByBrand controller', { error: errorMessage });
      res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
  };
} 