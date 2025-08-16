import { PrismaClient, Inventory } from '@prisma/client';
import { logger } from '../utils/logger';

export class InventoryService {
  constructor(private prisma: PrismaClient) {}

  async createInventory(data: {
    itemId: number;
    locationId: number;
    sku: string;
    quantity: number;
  }): Promise<Inventory> {
    try {
      const inventory = await this.prisma.inventory.create({
        data: {
          itemId: data.itemId,
          locationId: data.locationId,
          sku: data.sku,
          quantity: data.quantity
        }
      });

      logger.info('Inventory record created', { 
        inventoryId: inventory.id, 
        sku: inventory.sku, 
        locationId: inventory.locationId 
      });

      return inventory;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error creating inventory record', { error: errorMessage, data });
      throw error;
    }
  }

  async updateInventory(id: number, data: {
    locationId?: number;
    sku?: string;
    quantity?: number;
  }): Promise<Inventory> {
    try {
      const inventory = await this.prisma.inventory.update({
        where: { id },
        data
      });

      logger.info('Inventory updated', { 
        inventoryId: inventory.id, 
        sku: inventory.sku, 
        locationId: inventory.locationId 
      });

      return inventory;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error updating inventory record', { error: errorMessage, id, data });
      throw error;
    }
  }

  async getInventoryByItemId(itemId: number): Promise<Inventory | null> {
    try {
      return await this.prisma.inventory.findFirst({
        where: { itemId }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error getting inventory by item ID', { error: errorMessage, itemId });
      throw error;
    }
  }

  async getInventoryByLocation(locationId: number): Promise<Inventory[]> {
    try {
      return await this.prisma.inventory.findMany({
        where: { locationId },
        include: {
          item: true,
          location: {
            include: {
              warehouse: true
            }
          }
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error getting inventory by location', { error: errorMessage, locationId });
      throw error;
    }
  }

  async getAllInventory(): Promise<Inventory[]> {
    try {
      return await this.prisma.inventory.findMany({
        include: {
          item: true,
          location: {
            include: {
              warehouse: true
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error getting all inventory', { error: errorMessage });
      throw error;
    }
  }

  async deleteInventory(id: number): Promise<void> {
    try {
      await this.prisma.inventory.delete({
        where: { id }
      });

      logger.info('Inventory record deleted', { inventoryId: id });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error deleting inventory record', { error: errorMessage, id });
      throw error;
    }
  }
} 