import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface CreateInventoryInput {
  sku: string;
  location: string;
  qtyTotal?: number;
  passDevices?: number;
  failedDevices?: number;
  reserved?: number;
  available?: number;
}

export class InventoryService {
  
  async createInventory(data: CreateInventoryInput) {
    try {
      // Check if inventory already exists for this SKU and location
      const existingInventory = await prisma.inventory.findFirst({
        where: {
          sku: data.sku,
          location: data.location,
        },
      });

      if (existingInventory) {
        // Update existing inventory
        const inventory = await prisma.inventory.update({
          where: { id: existingInventory.id },
          data: {
            qtyTotal: (existingInventory.qtyTotal || 0) + (data.qtyTotal || 0),
            passDevices: (existingInventory.passDevices || 0) + (data.passDevices || 0),
            failedDevices: (existingInventory.failedDevices || 0) + (data.failedDevices || 0),
            reserved: data.reserved || existingInventory.reserved,
            available: data.available || existingInventory.available,
          },
        });
        logger.info('Inventory record updated', { inventoryId: inventory.id, sku: inventory.sku, location: inventory.location });
        return inventory;
      } else {
        // Create new inventory record
        const inventory = await prisma.inventory.create({
          data: {
            sku: data.sku,
            location: data.location,
            qtyTotal: data.qtyTotal || 0,
            passDevices: data.passDevices || 0,
            failedDevices: data.failedDevices || 0,
            reserved: data.reserved || 0,
            available: data.available || 0,
          }
        });
        logger.info('Inventory record created', { inventoryId: inventory.id, sku: inventory.sku, location: inventory.location });
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

  async getInventoryBySku(sku: string) {
    try {
      return await prisma.inventory.findMany({
        where: { sku }
      });
    } catch (error) {
      logger.error('Error getting inventory by SKU', { error, sku });
      throw error;
    }
  }

  async getInventoryByLocation(location: string) {
    try {
      return await prisma.inventory.findMany({
        where: { location }
      });
    } catch (error) {
      logger.error('Error getting inventory by location', { error, location });
      throw error;
    }
  }

  async getAllInventory() {
    try {
      return await prisma.inventory.findMany({
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
      const inventory = await prisma.inventory.findMany();

      const summary = {
        totalItems: inventory.length,
        totalQuantity: inventory.reduce((sum, inv) => sum + (inv.qtyTotal || 0), 0),
        passDevices: inventory.reduce((sum, inv) => sum + (inv.passDevices || 0), 0),
        failedDevices: inventory.reduce((sum, inv) => sum + (inv.failedDevices || 0), 0),
        reserved: inventory.reduce((sum, inv) => sum + (inv.reserved || 0), 0),
        available: inventory.reduce((sum, inv) => sum + (inv.available || 0), 0),
        byLocation: {} as Record<string, number>,
        bySku: {} as Record<string, number>,
      };

      inventory.forEach((inv) => {
        // Group by location
        summary.byLocation[inv.location] = (summary.byLocation[inv.location] || 0) + (inv.qtyTotal || 0);
        
        // Group by SKU
        summary.bySku[inv.sku] = (summary.bySku[inv.sku] || 0) + (inv.qtyTotal || 0);
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
            { location: { contains: query, mode: 'insensitive' } },
          ],
        },
      });
      return inventory;
    } catch (error) {
      logger.error('Error searching inventory', { error, query });
      throw error;
    }
  }
} 