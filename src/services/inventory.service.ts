import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface CreateInventoryInput {
  itemId: number;
  locationId: number;
  sku: string;
  quantity: number;
  reserved?: number;
  available?: number;
}

export class InventoryService {
  
  async createInventory(data: CreateInventoryInput) {
    try {
      // Check if inventory already exists for this item and location
      const existingInventory = await prisma.inventory.findUnique({
        where: {
          itemId_locationId: {
            itemId: data.itemId,
            locationId: data.locationId,
          },
        },
      });

      if (existingInventory) {
        // Update existing inventory
        const inventory = await prisma.inventory.update({
          where: { id: existingInventory.id },
          data: {
            quantity: existingInventory.quantity + data.quantity,
            available: existingInventory.available + data.quantity,
          },
        });
        logger.info('Inventory record updated', { inventoryId: inventory.id, sku: inventory.sku, locationId: inventory.locationId });
        return inventory;
      } else {
        // Create new inventory record
        const inventory = await prisma.inventory.create({
          data: {
            itemId: data.itemId,
            locationId: data.locationId,
            sku: data.sku,
            quantity: data.quantity,
            reserved: data.reserved || 0,
            available: data.available || data.quantity
          }
        });
        logger.info('Inventory record created', { inventoryId: inventory.id, sku: inventory.sku, locationId: inventory.locationId });
        return inventory;
      }
    } catch (error) {
      logger.error('Error creating inventory', { error, data });
      throw error;
    }
  }

  async updateInventory(id: number, data: Partial<CreateInventoryInput>) {
    try {
      const inventory = await prisma.inventory.update({
        where: { id },
        data
      });
      logger.info('Inventory record updated', { inventoryId: inventory.id, sku: inventory.sku, locationId: inventory.locationId });
      return inventory;
    } catch (error) {
      logger.error('Error updating inventory', { error, id, data });
      throw error;
    }
  }

  async getInventoryByItemId(itemId: number) {
    try {
      return await prisma.inventory.findFirst({
        where: { itemId },
        include: {
          item: true,
          location: true
        }
      });
    } catch (error) {
      logger.error('Error getting inventory by item ID', { error, itemId });
      throw error;
    }
  }

  async getInventoryByLocation(locationId: number) {
    try {
      return await prisma.inventory.findMany({
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
      logger.error('Error getting inventory by location', { error, locationId });
      throw error;
    }
  }

  async getAllInventory() {
    try {
      return await prisma.inventory.findMany({
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
      logger.error('Error getting all inventory', { error });
      throw error;
    }
  }

  async deleteInventory(id: number) {
    try {
      await prisma.inventory.delete({
        where: { id }
      });
      logger.info('Inventory record deleted', { inventoryId: id });
    } catch (error) {
      logger.error('Error deleting inventory record', { error, id });
      throw error;
    }
  }

  async getInventorySummary() {
    try {
      const inventory = await prisma.inventory.findMany({
        include: {
          item: true,
          location: true
        }
      });

      const summary = {
        totalItems: inventory.length,
        availableItems: inventory.reduce((sum, inv) => sum + inv.available, 0),
        reservedItems: inventory.reduce((sum, inv) => sum + inv.reserved, 0),
        byBrand: {} as Record<string, number>,
        byModel: {} as Record<string, number>,
        byCondition: {} as Record<string, number>,
      };

      inventory.forEach((inv) => {
        if (inv.item?.brand) {
          summary.byBrand[inv.item.brand] = (summary.byBrand[inv.item.brand] || 0) + inv.quantity;
        }
        if (inv.item?.model) {
          summary.byModel[inv.item.model] = (summary.byModel[inv.item.model] || 0) + inv.quantity;
        }
        if (inv.item?.condition) {
          summary.byCondition[inv.item.condition] = (summary.byCondition[inv.item.condition] || 0) + inv.quantity;
        }
      });

      return summary;
    } catch (error) {
      logger.error('Error getting inventory summary', { error });
      throw error;
    }
  }

  async searchInventory(query: string) {
    try {
      const inventory = await prisma.inventory.findMany({
        where: {
          OR: [
            { sku: { contains: query, mode: 'insensitive' } },
            { item: { name: { contains: query, mode: 'insensitive' } } },
            { item: { brand: { contains: query, mode: 'insensitive' } } },
            { item: { model: { contains: query, mode: 'insensitive' } } },
            { item: { imei: { contains: query, mode: 'insensitive' } } },
          ],
        },
        include: {
          item: true,
          location: true,
        },
      });
      return inventory;
    } catch (error) {
      logger.error('Error searching inventory', { error, query });
      throw error;
    }
  }
} 