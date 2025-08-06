import { PrismaClient, Inventory } from '@prisma/client';
import { throwNotFoundError, throwConflictError } from '../utils/errorHandler';
import { logger } from '../utils/logger';

export interface CreateInventoryInput {
  sku: string;
  quantity: number;
  location: string;
}

export interface UpdateInventoryInput {
  quantity?: number | undefined;
  location?: string | undefined;
}

export interface QueryParams {
  page?: number | undefined;
  limit?: number | undefined;
  sku?: string | undefined;
  location?: string | undefined;
}

export class InventoryService {
  constructor(private prisma: PrismaClient) {}

  async createInventory(data: CreateInventoryInput): Promise<Inventory> {
    try {
      // Check if inventory record already exists for this SKU and location
      const existingInventory = await this.prisma.inventory.findUnique({
        where: { 
          sku_location: {
            sku: data.sku,
            location: data.location
          }
        }
      });

      if (existingInventory) {
        throwConflictError(`Inventory record for SKU ${data.sku} at location ${data.location} already exists`);
      }

      // Check if item exists
      const item = await this.prisma.item.findUnique({
        where: { sku: data.sku }
      });

      if (!item) {
        throwNotFoundError('Item');
      }

      const inventory = await this.prisma.inventory.create({
        data
      });

      logger.info('Inventory record created', { inventoryId: inventory.id, sku: inventory.sku, location: inventory.location });
      return inventory;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error creating inventory record', { error: errorMessage, data });
      throw error;
    }
  }

  async getInventoryById(id: number): Promise<Inventory> {
    try {
      const inventory = await this.prisma.inventory.findUnique({
        where: { id }
      });

      if (!inventory) {
        throwNotFoundError('Inventory');
      }

      return inventory!;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error getting inventory by ID', { error: errorMessage, id });
      throw error;
    }
  }

  async getInventoryBySkuAndLocation(sku: string, location: string): Promise<Inventory> {
    try {
      const inventory = await this.prisma.inventory.findUnique({
        where: { 
          sku_location: {
            sku,
            location
          }
        }
      });

      if (!inventory) {
        throwNotFoundError('Inventory');
      }

      return inventory!;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error getting inventory by SKU and location', { error: errorMessage, sku, location });
      throw error;
    }
  }

  async getAllInventory(query: QueryParams): Promise<{ inventory: Inventory[]; total: number; page: number; limit: number }> {
    try {
      const { page = 1, limit = 10, sku, location } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};
      if (sku) {
        where.sku = sku;
      }
      if (location) {
        where.location = location;
      }

      const [inventory, total] = await Promise.all([
        this.prisma.inventory.findMany({
          where,
          skip,
          take: limit,
          orderBy: { updatedAt: 'desc' },
          include: {
            item: true
          }
        }),
        this.prisma.inventory.count({ where })
      ]);

      logger.info('Inventory records retrieved', { count: inventory.length, total, page, limit });
      return { inventory, total, page, limit };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error getting all inventory', { error: errorMessage, query });
      throw error;
    }
  }

  async updateInventory(id: number, data: UpdateInventoryInput): Promise<Inventory> {
    try {
      // Check if inventory exists
      const existingInventory = await this.prisma.inventory.findUnique({
        where: { id }
      });

      if (!existingInventory) {
        throwNotFoundError('Inventory');
      }

      // Transform data to match Prisma expectations
      const prismaData: any = {};
      if (data.quantity !== undefined) prismaData.quantity = data.quantity;
      if (data.location !== undefined) prismaData.location = data.location;

      const inventory = await this.prisma.inventory.update({
        where: { id },
        data: prismaData
      });

      logger.info('Inventory record updated', { inventoryId: inventory.id, sku: inventory.sku, location: inventory.location });
      return inventory;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error updating inventory', { error: errorMessage, id, data });
      throw error;
    }
  }

  async deleteInventory(id: number): Promise<void> {
    try {
      // Check if inventory exists
      const existingInventory = await this.prisma.inventory.findUnique({
        where: { id }
      });

      if (!existingInventory) {
        throwNotFoundError('Inventory');
      }

      await this.prisma.inventory.delete({
        where: { id }
      });

      logger.info('Inventory record deleted', { inventoryId: id });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error deleting inventory', { error: errorMessage, id });
      throw error;
    }
  }

  async getInventoryBySku(sku: string): Promise<Inventory[]> {
    try {
      const inventory = await this.prisma.inventory.findMany({
        where: { sku },
        include: {
          item: true
        },
        orderBy: { updatedAt: 'desc' }
      });

      logger.info('Inventory by SKU retrieved', { sku, count: inventory.length });
      return inventory;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error getting inventory by SKU', { error: errorMessage, sku });
      throw error;
    }
  }

  async getInventoryByLocation(location: string): Promise<Inventory[]> {
    try {
      const inventory = await this.prisma.inventory.findMany({
        where: { location },
        include: {
          item: true
        },
        orderBy: { updatedAt: 'desc' }
      });

      logger.info('Inventory by location retrieved', { location, count: inventory.length });
      return inventory;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error getting inventory by location', { error: errorMessage, location });
      throw error;
    }
  }
} 