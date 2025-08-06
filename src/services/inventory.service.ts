import { PrismaClient, Inventory } from '@prisma/client';
import { CreateInventoryInput, UpdateInventoryInput, QueryParams } from '../utils/validator';
import { logger } from '../utils/logger';

export class InventoryService {
  constructor(private prisma: PrismaClient) {}

  async getAllInventory(query: QueryParams): Promise<{ inventory: Inventory[]; total: number; page: number; limit: number }> {
    try {
      const { page = 1, limit = 10, search, sku, location } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};
      if (search) {
        where.OR = [
          { sku: { contains: search, mode: 'insensitive' } },
          { location: { contains: search, mode: 'insensitive' } }
        ];
      }
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
          include: {
            item: true
          },
          orderBy: { updatedAt: 'desc' }
        }),
        this.prisma.inventory.count({ where })
      ]);

      logger.info('Inventory retrieved', { count: inventory.length, total, page, limit });
      return { inventory, total, page, limit };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error getting all inventory', { error: errorMessage, query });
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

      if (inventory.length === 0) {
        throw new Error('No inventory found for this SKU');
      }

      logger.info('Inventory retrieved by SKU', { sku, count: inventory.length });
      return inventory;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error getting inventory by SKU', { error: errorMessage, sku });
      throw error;
    }
  }

  async createOrUpdateInventory(data: CreateInventoryInput): Promise<Inventory> {
    try {
      // Check if item exists
      const item = await this.prisma.item.findFirst({
        where: { id: data.itemId }
      });

      if (!item) {
        throw new Error(`Item with ID ${data.itemId} does not exist`);
      }

      // Check if inventory record already exists for this item and location
      const existingInventory = await this.prisma.inventory.findFirst({
        where: {
          itemId: data.itemId,
          location: data.location
        }
      });

      let inventory: Inventory;

      if (existingInventory) {
        // Update existing inventory
        inventory = await this.prisma.inventory.update({
          where: { id: existingInventory.id },
          data: {
            quantity: data.quantity,
            sku: data.sku // Update SKU in case it changed
          }
        });
        logger.info('Inventory updated', { itemId: data.itemId, location: data.location, quantity: data.quantity });
      } else {
        // Create new inventory record
        inventory = await this.prisma.inventory.create({
          data: {
            itemId: data.itemId,
            sku: data.sku,
            quantity: data.quantity,
            location: data.location
          }
        });
        logger.info('Inventory created', { itemId: data.itemId, location: data.location, quantity: data.quantity });
      }

      return inventory;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error creating/updating inventory', { error: errorMessage, data });
      throw error;
    }
  }

  async updateInventory(id: number, data: UpdateInventoryInput): Promise<Inventory> {
    try {
      const existingInventory = await this.prisma.inventory.findUnique({
        where: { id }
      });

      if (!existingInventory) {
        throw new Error('Inventory record not found');
      }

      const updateData: any = {};
      if (data.quantity !== undefined) updateData.quantity = data.quantity;
      if (data.location !== undefined) updateData.location = data.location;

      const inventory = await this.prisma.inventory.update({
        where: { id },
        data: updateData
      });

      logger.info('Inventory updated', { inventoryId: inventory.id, sku: inventory.sku, location: inventory.location });
      return inventory;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error updating inventory', { error: errorMessage, id, data });
      throw error;
    }
  }

  async deleteInventory(id: number): Promise<void> {
    try {
      const existingInventory = await this.prisma.inventory.findUnique({
        where: { id }
      });

      if (!existingInventory) {
        throw new Error('Inventory record not found');
      }

      await this.prisma.inventory.delete({
        where: { id }
      });

      logger.info('Inventory deleted', { id });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error deleting inventory', { error: errorMessage, id });
      throw error;
    }
  }
} 