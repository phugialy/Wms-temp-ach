import { PrismaClient } from '@prisma/client';
import { InventoryPushInput } from '../utils/validator';
import { generateSku } from '../utils/skuGenerator';
import { logger } from '../utils/logger';

export class AdminService {
  constructor(private prisma: PrismaClient) {}

  async pushInventory(data: InventoryPushInput): Promise<{ imei: string; sku: string; location: string; quantity: number }> {
    try {
      // Generate SKU if not provided
      let finalSku = data.sku;
      if (!finalSku) {
        finalSku = generateSku({
          imei: data.imei || `TEMP-${Date.now()}`,
          model: data.model
        });
      }

      // Find or create the Item record
      let item = null;
      
      // Try to find by IMEI first
      if (data.imei) {
        item = await this.prisma.item.findUnique({
          where: { imei: data.imei }
        });
      }

      if (!item) {
        // Create new item
        item = await this.prisma.item.create({
          data: {
            imei: data.imei || `TEMP-${Date.now()}`,
            model: data.model,
            capacity: data.storage,
            color: data.color,
            carrier: data.carrier,
            working: data.working || 'PENDING',
            location: data.location || 'Default Location'
          }
        });

        // Create associated product
        await this.prisma.product.create({
          data: {
            imei: item.imei,
            sku: finalSku,
            brand: data.brand
          }
        });

        logger.info('New item created', { imei: item.imei, sku: finalSku });
      } else {
        // Update existing item if needed
        const updateData: any = {};
        
        if (data.model && item.model !== data.model) {
          updateData.model = data.model;
        }
        
        if (data.storage && item.capacity !== data.storage) {
          updateData.capacity = data.storage;
        }
        
        if (data.color && item.color !== data.color) {
          updateData.color = data.color;
        }
        
        if (data.carrier && item.carrier !== data.carrier) {
          updateData.carrier = data.carrier;
        }
        
        if (data.working && item.working !== data.working) {
          updateData.working = data.working;
        }

        if (Object.keys(updateData).length > 0) {
          await this.prisma.item.update({
            where: { imei: item.imei },
            data: updateData
          });
          logger.info('Item updated', { imei: item.imei, sku: finalSku });
        }
      }

      // Handle inventory
      const location = data.location || 'Default Location';
      
      // Find existing inventory
      const existingInventory = await this.prisma.inventory.findFirst({
        where: { 
          sku: finalSku,
          location: location
        }
      });

      if (existingInventory) {
        // Update existing inventory
        await this.prisma.inventory.update({
          where: { id: existingInventory.id },
          data: {
            qty_total: (existingInventory.qty_total || 0) + (data.quantity || 1)
          }
        });
      } else {
        // Create new inventory record
        await this.prisma.inventory.create({
          data: {
            sku: finalSku,
            location: location,
            qty_total: data.quantity || 1,
            pass_devices: data.working === 'PASS' ? 1 : 0,
            failed_devices: data.working === 'FAIL' ? 1 : 0,
            reserved: 0,
            available: data.quantity || 1
          }
        });
      }

      return {
        imei: item.imei,
        sku: finalSku,
        location: location,
        quantity: data.quantity || 1
      };
    } catch (error) {
      logger.error('Error pushing inventory', { error, data });
      throw error;
    }
  }

  async getInventorySummary() {
    try {
      const inventory = await this.prisma.inventory.findMany();

      return inventory.map(inv => ({
        sku: inv.sku,
        location: inv.location,
        quantity: inv.qty_total || 0,
        passDevices: inv.pass_devices || 0,
        failedDevices: inv.failed_devices || 0,
        reserved: inv.reserved || 0,
        available: inv.available || 0
      }));
    } catch (error) {
      logger.error('Error getting inventory summary', { error });
      throw error;
    }
  }

  async getInventoryById(id: number) {
    try {
      const inventory = await this.prisma.inventory.findUnique({
        where: { id: BigInt(id) }
      });

      if (!inventory) {
        throw new Error(`Inventory with ID ${id} not found`);
      }

      return {
        id: inventory.id.toString(),
        sku: inventory.sku,
        location: inventory.location,
        quantity: inventory.qty_total || 0,
        passDevices: inventory.pass_devices || 0,
        failedDevices: inventory.failed_devices || 0,
        reserved: inventory.reserved || 0,
        available: inventory.available || 0
      };
    } catch (error) {
      logger.error('Error getting inventory by ID', { error, id });
      throw error;
    }
  }

  async updateInventory(id: number, updateData: any) {
    try {
      const inventory = await this.prisma.inventory.findUnique({
        where: { id: BigInt(id) }
      });

      if (!inventory) {
        throw new Error(`Inventory with ID ${id} not found`);
      }

      // Update inventory
      const updatedInventory = await this.prisma.inventory.update({
        where: { id: BigInt(id) },
        data: {
          qty_total: updateData.quantity,
          pass_devices: updateData.passDevices,
          failed_devices: updateData.failedDevices,
          reserved: updateData.reserved,
          available: updateData.available
        }
      });

      return {
        id: updatedInventory.id.toString(),
        sku: updatedInventory.sku,
        location: updatedInventory.location,
        quantity: updatedInventory.qty_total || 0,
        passDevices: updatedInventory.pass_devices || 0,
        failedDevices: updatedInventory.failed_devices || 0,
        reserved: updatedInventory.reserved || 0,
        available: updatedInventory.available || 0
      };
    } catch (error) {
      logger.error('Error updating inventory', { error, id, updateData });
      throw error;
    }
  }

  async getLocations() {
    try {
      // Get unique locations from inventory
      const locations = await this.prisma.inventory.findMany({
        select: { location: true },
        distinct: ['location']
      });

      return locations.map(location => ({
        id: location.location,
        name: location.location,
        warehouse: 'DNCL' // Default warehouse
      }));
    } catch (error) {
      logger.error('Error getting locations', { error });
      throw error;
    }
  }

  async deleteInventoryItems(ids: number[]): Promise<{ deletedCount: number }> {
    try {
      const result = await this.prisma.inventory.deleteMany({
        where: {
          id: {
            in: ids.map(id => BigInt(id))
          }
        }
      });

      return { deletedCount: Number(result.count) };
    } catch (error) {
      logger.error('Error deleting inventory items', { error, ids });
      throw error;
    }
  }

  async cleanupImeiData(imei: string): Promise<{ success: boolean; message: string }> {
    try {
      // Delete related records
      await this.prisma.deviceTest.deleteMany({
        where: { imei }
      });

      await this.prisma.product.deleteMany({
        where: { imei }
      });

      await this.prisma.item.deleteMany({
        where: { imei }
      });

      return { success: true, message: `Cleaned up data for IMEI: ${imei}` };
    } catch (error) {
      logger.error('Error cleaning up IMEI data', { error, imei });
      throw error;
    }
  }
}