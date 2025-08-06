import { PrismaClient, Item } from '@prisma/client';
import { throwNotFoundError, throwConflictError } from '../utils/errorHandler';
import { logger } from '../utils/logger';

export interface CreateItemInput {
  sku: string;
  name: string;
  description?: string | null;
  upc?: string | null;
  brand?: string | null;
  model?: string | null;
  condition?: string | null;
  cost?: number | null;
  price?: number | null;
  weightOz?: number | null;
  dimensions?: string | null;
  imageUrl?: string | null;
  isActive?: boolean | null;
}

export interface UpdateItemInput {
  name?: string | null;
  description?: string | null;
  upc?: string | null;
  brand?: string | null;
  model?: string | null;
  condition?: string | null;
  cost?: number | null;
  price?: number | null;
  weightOz?: number | null;
  dimensions?: string | null;
  imageUrl?: string | null;
  isActive?: boolean | null;
}

export interface QueryParams {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  brand?: string | undefined;
  condition?: string | undefined;
}

export class ItemService {
  constructor(private prisma: PrismaClient) {}

  async createItem(data: CreateItemInput): Promise<Item> {
    try {
      // Check if SKU already exists
      const existingItem = await this.prisma.item.findUnique({
        where: { sku: data.sku }
      });

      if (existingItem) {
        throwConflictError(`Item with SKU ${data.sku} already exists`);
      }

      // Transform data to match Prisma expectations
      const prismaData = {
        sku: data.sku,
        name: data.name,
        description: data.description ?? null,
        upc: data.upc ?? null,
        brand: data.brand ?? null,
        model: data.model ?? null,
        condition: data.condition ?? 'used',
        cost: data.cost ?? null,
        price: data.price ?? null,
        weightOz: data.weightOz ?? null,
        dimensions: data.dimensions ?? null,
        imageUrl: data.imageUrl ?? null,
        isActive: data.isActive ?? true
      };

      const item = await this.prisma.item.create({
        data: prismaData
      });

      logger.info('Item created', { itemId: item.id, sku: item.sku });
      return item;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error creating item', { error: errorMessage, data });
      throw error;
    }
  }

  async getItemById(id: number): Promise<Item> {
    try {
      const item = await this.prisma.item.findUnique({
        where: { id }
      });

      if (!item) {
        throwNotFoundError('Item');
      }

      return item!;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error getting item by ID', { error: errorMessage, id });
      throw error;
    }
  }

  async getItemBySku(sku: string): Promise<Item> {
    try {
      const item = await this.prisma.item.findUnique({
        where: { sku }
      });

      if (!item) {
        throwNotFoundError('Item');
      }

      return item!;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error getting item by SKU', { error: errorMessage, sku });
      throw error;
    }
  }

  async getAllItems(query: QueryParams): Promise<{ items: Item[]; total: number; page: number; limit: number }> {
    try {
      const { page = 1, limit = 10, search, brand, condition } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { brand: { contains: search, mode: 'insensitive' } },
          { model: { contains: search, mode: 'insensitive' } }
        ];
      }
      if (brand) {
        where.brand = brand;
      }
      if (condition) {
        where.condition = condition;
      }

      const [items, total] = await Promise.all([
        this.prisma.item.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        this.prisma.item.count({ where })
      ]);

      logger.info('Items retrieved', { count: items.length, total, page, limit });
      return { items, total, page, limit };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error getting all items', { error: errorMessage, query });
      throw error;
    }
  }

  async updateItem(id: number, data: UpdateItemInput): Promise<Item> {
    try {
      // Check if item exists
      const existingItem = await this.prisma.item.findUnique({
        where: { id }
      });

      if (!existingItem) {
        throwNotFoundError('Item');
      }

      // Transform data to match Prisma expectations
      const prismaData: any = {};
      if (data.name !== undefined) prismaData.name = data.name;
      if (data.description !== undefined) prismaData.description = data.description;
      if (data.upc !== undefined) prismaData.upc = data.upc;
      if (data.brand !== undefined) prismaData.brand = data.brand;
      if (data.model !== undefined) prismaData.model = data.model;
      if (data.condition !== undefined) prismaData.condition = data.condition;
      if (data.cost !== undefined) prismaData.cost = data.cost;
      if (data.price !== undefined) prismaData.price = data.price;
      if (data.weightOz !== undefined) prismaData.weightOz = data.weightOz;
      if (data.dimensions !== undefined) prismaData.dimensions = data.dimensions;
      if (data.imageUrl !== undefined) prismaData.imageUrl = data.imageUrl;
      if (data.isActive !== undefined) prismaData.isActive = data.isActive;

      const item = await this.prisma.item.update({
        where: { id },
        data: prismaData
      });

      logger.info('Item updated', { itemId: item.id, sku: item.sku });
      return item;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error updating item', { error: errorMessage, id, data });
      throw error;
    }
  }

  async deleteItem(id: number): Promise<void> {
    try {
      // Check if item exists
      const existingItem = await this.prisma.item.findUnique({
        where: { id }
      });

      if (!existingItem) {
        throwNotFoundError('Item');
      }

      await this.prisma.item.delete({
        where: { id }
      });

      logger.info('Item deleted', { itemId: id });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error deleting item', { error: errorMessage, id });
      throw error;
    }
  }

  async getItemBrands(): Promise<string[]> {
    try {
      const brands = await this.prisma.item.findMany({
        select: { brand: true },
        where: { brand: { not: null } },
        distinct: ['brand']
      });

      return brands.map(item => item.brand!).filter(Boolean);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error getting item brands', { error: errorMessage });
      throw error;
    }
  }

  async getItemsByBrand(brand: string, query: QueryParams): Promise<{ items: Item[]; total: number; page: number; limit: number }> {
    try {
      const { page = 1, limit = 10, search } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = { brand };
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { model: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [items, total] = await Promise.all([
        this.prisma.item.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        this.prisma.item.count({ where })
      ]);

      logger.info('Items by brand retrieved', { brand, count: items.length, total, page, limit });
      return { items, total, page, limit };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error getting items by brand', { error: errorMessage, brand, query });
      throw error;
    }
  }
} 