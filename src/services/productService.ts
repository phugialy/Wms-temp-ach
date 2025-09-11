import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export interface CreateProductInput {
  imei: string;
  sku: string;
  brand?: string;
}

export interface UpdateProductInput {
  sku?: string;
  brand?: string;
}

export class ProductService {
  constructor(private prisma: PrismaClient) {}

  async createProduct(data: CreateProductInput) {
    try {
      // Check if IMEI already exists
      const existingProduct = await this.prisma.product.findUnique({
        where: { imei: data.imei }
      });

      if (existingProduct) {
        throw new Error(`Product with IMEI ${data.imei} already exists`);
      }

      const product = await this.prisma.product.create({
        data
      });

      logger.info('Product created', { imei: product.imei, sku: product.sku });
      return product;
    } catch (error) {
      logger.error('Error creating product', { error, data });
      throw error;
    }
  }

  async getProductByImei(imei: string) {
    try {
      const product = await this.prisma.product.findUnique({
        where: { imei }
      });

      if (!product) {
        throw new Error(`Product with IMEI ${imei} not found`);
      }

      return product;
    } catch (error) {
      logger.error('Error getting product by IMEI', { error, imei });
      throw error;
    }
  }

  async getProductBySku(sku: string) {
    try {
      const product = await this.prisma.product.findFirst({
        where: { sku }
      });

      if (!product) {
        throw new Error(`Product with SKU ${sku} not found`);
      }

      return product;
    } catch (error) {
      logger.error('Error getting product by SKU', { error, sku });
      throw error;
    }
  }

  async updateProduct(imei: string, data: UpdateProductInput) {
    try {
      const product = await this.prisma.product.update({
        where: { imei },
        data
      });

      logger.info('Product updated', { imei: product.imei, sku: product.sku });
      return product;
    } catch (error) {
      logger.error('Error updating product', { error, imei, data });
      throw error;
    }
  }

  async deleteProduct(imei: string) {
    try {
      await this.prisma.product.delete({
        where: { imei }
      });

      logger.info('Product deleted', { imei });
    } catch (error) {
      logger.error('Error deleting product', { error, imei });
      throw error;
    }
  }

  async getAllProducts() {
    try {
      const products = await this.prisma.product.findMany({
        orderBy: { createdAt: 'desc' }
      });

      return products;
    } catch (error) {
      logger.error('Error getting all products', { error });
      throw error;
    }
  }

  async getProductCategories(): Promise<string[]> {
    try {
      const products = await this.prisma.product.findMany({
        select: { brand: true },
        where: { brand: { not: null } },
        distinct: ['brand']
      });

      return products.map(p => p.brand).filter(Boolean) as string[];
    } catch (error) {
      logger.error('Error getting product categories', { error });
      throw error;
    }
  }

  async getProductsByCategory(category: string, queryParams: any): Promise<any[]> {
    try {
      const products = await this.prisma.product.findMany({
        where: { brand: category }
      });

      return products;
    } catch (error) {
      logger.error('Error getting products by category', { error, category });
      throw error;
    }
  }
}