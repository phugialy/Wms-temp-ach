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
      const existingInventory = await prisma.inventory.findFirst({
        where: {
          itemId: data.itemId,
          locationId: data.locationId,
        },
      });

      if (existingInventory) {
        // Update existing inventory
        const inventory = await prisma.inventory.update({
          where: { id: existingInventory.id },
          data: {
            quantity: existingInventory.quantity + data.quantity,
          },
        });
        logger.info('Inventory record updated', { inventoryId: inventory.id, locationId: inventory.locationId });
        return inventory;
      } else {
        // Create new inventory record
        const inventory = await prisma.inventory.create({
          data: {
            itemId: data.itemId,
            locationId: data.locationId,
            quantity: data.quantity,
          }
        });
        logger.info('Inventory record created', { inventoryId: inventory.id, locationId: inventory.locationId });
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
      logger.info('Inventory record updated', { inventoryId: inventory.id, locationId: inventory.locationId });
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
        availableItems: inventory.reduce((sum, inv) => sum + inv.quantity, 0),
        reservedItems: 0, // No reserved items in current schema
        byBrand: {} as Record<string, number>,
        byModel: {} as Record<string, number>,
        byCondition: {} as Record<string, number>,
      };

      inventory.forEach((inv) => {
        // Since the current schema doesn't have brand, model, condition directly on item,
        // we'll use description or status for categorization
        if (inv.item?.description) {
          const description = inv.item.description.toLowerCase();
          if (description.includes('apple') || description.includes('iphone')) {
            summary.byBrand['Apple'] = (summary.byBrand['Apple'] || 0) + inv.quantity;
          } else if (description.includes('samsung')) {
            summary.byBrand['Samsung'] = (summary.byBrand['Samsung'] || 0) + inv.quantity;
          } else {
            summary.byBrand['Other'] = (summary.byBrand['Other'] || 0) + inv.quantity;
          }
        }
        
        // Use status for condition
        if (inv.item?.status) {
          summary.byCondition[inv.item.status] = (summary.byCondition[inv.item.status] || 0) + inv.quantity;
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
            { item: { sku: { contains: query, mode: 'insensitive' } } },
            { item: { name: { contains: query, mode: 'insensitive' } } },
            { item: { description: { contains: query, mode: 'insensitive' } } },
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