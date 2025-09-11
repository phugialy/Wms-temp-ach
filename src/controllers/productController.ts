import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ProductService } from '../services/productService';
import { 
  createProductSchema, 
  updateProductSchema, 
  queryParamsSchema, 
  idParamSchema 
} from '../utils/validation';
import prisma from '../prisma/client';
import { logger } from '../utils/logger';

export class ProductController {
  private productService: ProductService;

  constructor() {
    this.productService = new ProductService(prisma);
  }

  createProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = createProductSchema.parse(req.body);
      const productData = {
        imei: validatedData.sku || `TEMP-${Date.now()}`, // Use SKU as IMEI for now
        sku: validatedData.sku,
        brand: validatedData.name
      };
      const product = await this.productService.createProduct(productData);

      res.status(201).json({
        success: true,
        data: product,
        message: 'Product created successfully'
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        });
      } else {
        next(error);
      }
    }
  };

  getProductById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const product = await this.productService.getProductByImei(id.toString());

      res.status(200).json({
        success: true,
        data: product
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid product ID',
            details: error.errors
          }
        });
      } else {
        next(error);
      }
    }
  };

  getProductBySku = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sku } = req.params;
      if (!sku) {
        res.status(400).json({
          success: false,
          error: {
            message: 'SKU parameter is required'
          }
        });
        return;
      }

      const product = await this.productService.getProductBySku(sku);

      res.status(200).json({
        success: true,
        data: product
      });
    } catch (error) {
      next(error);
    }
  };

  getAllProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedQuery = queryParamsSchema.parse(req.query);
      const result = await this.productService.getAllProducts();

      res.status(200).json({
        success: true,
        data: result,
        pagination: {
          page: 1,
          limit: result.length,
          total: result.length,
          totalPages: 1
        }
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid query parameters',
            details: error.errors
          }
        });
      } else {
        next(error);
      }
    }
  };

  updateProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const validatedData = updateProductSchema.parse(req.body);
      
      const product = await this.productService.updateProduct(id, validatedData);

      res.status(200).json({
        success: true,
        data: product,
        message: 'Product updated successfully'
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        });
      } else {
        next(error);
      }
    }
  };

  deleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = idParamSchema.parse(req.params);
      await this.productService.deleteProduct(id);

      res.status(200).json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid product ID',
            details: error.errors
          }
        });
      } else {
        next(error);
      }
    }
  };

  getProductCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categories = await this.productService.getProductCategories();

      res.status(200).json({
        success: true,
        data: categories
      });
    } catch (error) {
      next(error);
    }
  };

  getProductsByCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { category } = req.params;
      const validatedQuery = queryParamsSchema.parse(req.query);
      
      if (!category) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Category parameter is required'
          }
        });
        return;
      }

      const result = await this.productService.getProductsByCategory(category, validatedQuery);

      res.status(200).json({
        success: true,
        data: result,
        category,
        pagination: {
          page: 1,
          limit: result.length,
          total: result.length,
          totalPages: 1
        }
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid query parameters',
            details: error.errors
          }
        });
      } else {
        next(error);
      }
    }
  };
} 