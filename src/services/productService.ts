import { PrismaClient, Product } from '@prisma/client';
import { CreateProductInput, UpdateProductInput, QueryParams } from '../utils/validation';
import { throwNotFoundError, throwConflictError } from '../utils/errorHandler';
import { logger } from '../utils/logger';

export class ProductService {
  constructor(private prisma: PrismaClient) {}

  async createProduct(data: CreateProductInput): Promise<Product> {
    try {
      // Check if SKU already exists
      const existingProduct = await this.prisma.product.findUnique({
        where: { sku: data.sku }
      });

      if (existingProduct) {
        throwConflictError(`Product with SKU ${data.sku} already exists`);
      }

      const product = await this.prisma.product.create({
        data
      });

      logger.info('Product created', { productId: product.id, sku: product.sku });
      return product;
    } catch (error) {
      logger.error('Error creating product', { error: error.message, data });
      throw error;
    }
  }

  async getProductById(id: string): Promise<Product> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id }
      });

      if (!product) {
        throwNotFoundError('Product');
      }

      return product;
    } catch (error) {
      logger.error('Error getting product by ID', { error: error.message, id });
      throw error;
    }
  }

  async getProductBySku(sku: string): Promise<Product> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { sku }
      });

      if (!product) {
        throwNotFoundError('Product');
      }

      return product;
    } catch (error) {
      logger.error('Error getting product by SKU', { error: error.message, sku });
      throw error;
    }
  }

  async getAllProducts(query: QueryParams): Promise<{ products: Product[]; total: number; page: number; limit: number }> {
    try {
      const { page, limit, search, category } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }
      if (category) {
        where.category = category;
      }

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        this.prisma.product.count({ where })
      ]);

      logger.info('Products retrieved', { count: products.length, total, page, limit });
      return { products, total, page, limit };
    } catch (error) {
      logger.error('Error getting all products', { error: error.message, query });
      throw error;
    }
  }

  async updateProduct(id: string, data: UpdateProductInput): Promise<Product> {
    try {
      // Check if product exists
      const existingProduct = await this.prisma.product.findUnique({
        where: { id }
      });

      if (!existingProduct) {
        throwNotFoundError('Product');
      }

      // If SKU is being updated, check for conflicts
      if (data.sku && data.sku !== existingProduct.sku) {
        const skuExists = await this.prisma.product.findUnique({
          where: { sku: data.sku }
        });

        if (skuExists) {
          throwConflictError(`Product with SKU ${data.sku} already exists`);
        }
      }

      const product = await this.prisma.product.update({
        where: { id },
        data
      });

      logger.info('Product updated', { productId: product.id, sku: product.sku });
      return product;
    } catch (error) {
      logger.error('Error updating product', { error: error.message, id, data });
      throw error;
    }
  }

  async deleteProduct(id: string): Promise<void> {
    try {
      // Check if product exists
      const existingProduct = await this.prisma.product.findUnique({
        where: { id },
        include: {
          inventoryItems: true,
          orderItems: true
        }
      });

      if (!existingProduct) {
        throwNotFoundError('Product');
      }

      // Check if product is in use
      if (existingProduct.inventoryItems.length > 0) {
        throw new Error('Cannot delete product that has inventory items');
      }

      if (existingProduct.orderItems.length > 0) {
        throw new Error('Cannot delete product that has order items');
      }

      await this.prisma.product.delete({
        where: { id }
      });

      logger.info('Product deleted', { productId: id });
    } catch (error) {
      logger.error('Error deleting product', { error: error.message, id });
      throw error;
    }
  }

  async getProductCategories(): Promise<string[]> {
    try {
      const categories = await this.prisma.product.findMany({
        select: { category: true },
        distinct: ['category']
      });

      return categories.map(cat => cat.category);
    } catch (error) {
      logger.error('Error getting product categories', { error: error.message });
      throw error;
    }
  }

  async getProductsByCategory(category: string, query: QueryParams): Promise<{ products: Product[]; total: number; page: number; limit: number }> {
    try {
      const { page, limit, search } = query;
      const skip = (page - 1) * limit;

      const where: any = { category };
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        this.prisma.product.count({ where })
      ]);

      logger.info('Products by category retrieved', { category, count: products.length, total });
      return { products, total, page, limit };
    } catch (error) {
      logger.error('Error getting products by category', { error: error.message, category });
      throw error;
    }
  }
} 