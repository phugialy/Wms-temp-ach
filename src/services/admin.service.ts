import { PrismaClient, Item, Inventory } from '@prisma/client';
import { InventoryPushInput } from '../utils/validator';
import { generateSku } from '../utils/skuGenerator';
import { logger } from '../utils/logger';

export class AdminService {
  constructor(private prisma: PrismaClient) {}

  async pushInventory(data: InventoryPushInput): Promise<{ itemId: number; sku: string; location: string; quantity: number }> {
    try {
      // Generate SKU if not provided
      let finalSku = data.sku;
      if (!finalSku) {
        finalSku = generateSku({
          brand: data.brand,
          model: data.model,
          storage: data.storage,
          color: data.color,
          carrier: data.carrier
        });
      }

      // Find or create the Item record
      let item: Item | null = null;
      
      // Try to find by IMEI first
      if (data.imei) {
        item = await this.prisma.item.findUnique({
          where: { imei: data.imei }
        });
      }
      // Try to find by serial number if IMEI not found
      else if (data.serialNumber) {
        item = await this.prisma.item.findUnique({
          where: { serialNumber: data.serialNumber }
        });
      }
      // Try to find by SKU as fallback
      else {
        item = await this.prisma.item.findFirst({
          where: { sku: finalSku }
        });
      }

      // Create item if not found
      if (!item) {
        item = await this.prisma.item.create({
          data: {
            name: data.name,
            brand: data.brand,
            model: data.model,
            storage: data.storage,
            color: data.color,
            carrier: data.carrier,
            type: data.type,
            imei: data.imei,
            serialNumber: data.serialNumber,
            sku: finalSku,
            skuGeneratedAt: data.sku ? null : new Date(), // Only set if SKU was auto-generated
            condition: 'used', // Default condition
            working: data.working || 'PENDING', // Use provided working status or default to PENDING
            isActive: true
          }
        });
        logger.info('New item created', { itemId: item.id, sku: finalSku });
      } else {
        // Update existing item with new data if needed
        const updateData: Partial<Item> = {};
        let needsUpdate = false;

        if (item.name !== data.name) {
          updateData.name = data.name;
          needsUpdate = true;
        }
        if (item.brand !== data.brand) {
          updateData.brand = data.brand;
          needsUpdate = true;
        }
        if (item.model !== data.model) {
          updateData.model = data.model;
          needsUpdate = true;
        }
        if (item.storage !== data.storage) {
          updateData.storage = data.storage;
          needsUpdate = true;
        }
        if (item.color !== data.color) {
          updateData.color = data.color;
          needsUpdate = true;
        }
        if (item.carrier !== data.carrier) {
          updateData.carrier = data.carrier;
          needsUpdate = true;
        }
        if (item.type !== data.type) {
          updateData.type = data.type;
          needsUpdate = true;
        }
        if (item.sku !== finalSku) {
          updateData.sku = finalSku;
          updateData.skuGeneratedAt = data.sku ? null : new Date();
          needsUpdate = true;
        }
        if (item.working !== data.working && data.working) {
          updateData.working = data.working;
          needsUpdate = true;
        }

        if (needsUpdate) {
          // Remove id and handle JSON fields properly
          const { id, testResults, ...updateDataWithoutId } = updateData;
          const updatePayload: any = { ...updateDataWithoutId };
          
          // Handle testResults JSON field properly if it exists
          if (testResults !== undefined) {
            updatePayload.testResults = testResults === null ? null : testResults;
          }
          
          item = await this.prisma.item.update({
            where: { id: item.id },
            data: updatePayload
          });
          logger.info('Item updated', { itemId: item.id, sku: finalSku });
        }
      }

      // Parse location name - support both "DNCL-LocationName" and plain "LocationName" formats
      let locationName = data.location;
      if (data.location.startsWith('DNCL-')) {
        locationName = data.location.replace('DNCL-', '');
      }
      
      // Find the location by name
      let location = await this.prisma.location.findFirst({
        where: {
          name: locationName,
          warehouse: {
            name: 'DNCL'
          }
        },
        include: {
          warehouse: true
        }
      });

      // If location doesn't exist, try to create it
      if (!location) {
        // First ensure DNCL warehouse exists
        let warehouse = await this.prisma.warehouse.findUnique({
          where: { name: 'DNCL' }
        });

        if (!warehouse) {
          warehouse = await this.prisma.warehouse.create({
            data: {
              name: 'DNCL',
              description: 'DNCL Main Warehouse'
            }
          });
          logger.info('Created DNCL warehouse', { warehouseId: warehouse.id });
        }

        // Create the location
        location = await this.prisma.location.create({
          data: {
            name: locationName,
            warehouseId: warehouse.id,
            description: `Location: ${locationName}`
          },
          include: {
            warehouse: true
          }
        });
        logger.info('Created new location', { locationId: location.id, locationName });
      }

      // Check if item already exists in any location and remove it (one location per item)
      const existingInventory = await this.prisma.inventory.findFirst({
        where: { itemId: item.id }
      });

      let inventory: Inventory;
      let finalQuantity: number;

      if (existingInventory) {
        // Update existing inventory - move to new location and update quantity
        finalQuantity = data.quantity;
        inventory = await this.prisma.inventory.update({
          where: { id: existingInventory.id },
          data: {
            locationId: location.id,
            quantity: finalQuantity,
            sku: finalSku // Update SKU in case it changed
          }
        });
        logger.info('Inventory updated (moved location)', { 
          itemId: item.id, 
          oldLocationId: existingInventory.locationId,
          newLocationId: location.id,
          quantity: finalQuantity 
        });
      } else {
        // Create new inventory record
        finalQuantity = data.quantity;
        inventory = await this.prisma.inventory.create({
          data: {
            itemId: item.id,
            locationId: location.id,
            sku: finalSku,
            quantity: data.quantity
          }
        });
        logger.info('New inventory record created', { 
          itemId: item.id, 
          locationId: location.id,
          quantity: data.quantity 
        });
      }

      return {
        itemId: item.id,
        sku: finalSku,
        location: `${location.warehouse.name}-${location.name}`,
        quantity: finalQuantity
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in pushInventory service', { error: errorMessage, data });
      throw error;
    }
  }

  async getInventory(): Promise<any[]> {
    try {
      const inventory = await this.prisma.inventory.findMany({
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

      // Transform the data to match the frontend expectations
      return inventory.map(inv => ({
        id: inv.id,
        name: inv.item.name,
        brand: inv.item.brand,
        model: inv.item.model,
        storage: inv.item.storage,
        color: inv.item.color,
        carrier: inv.item.carrier,
        type: inv.item.type,
        imei: inv.item.imei,
        serialNumber: inv.item.serialNumber,
        condition: inv.item.condition,
        working: inv.item.working,
        quantity: inv.quantity,
        location: `${inv.location.warehouse.name}-${inv.location.name}`,
        sku: inv.sku,
        updatedAt: inv.updatedAt
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getInventory service', { error: errorMessage });
      throw error;
    }
  }

  async updateInventoryItem(id: number, updateData: any): Promise<any> {
    try {
      // First, find the inventory record
      const inventory = await this.prisma.inventory.findUnique({
        where: { id },
        include: { 
          item: true,
          location: {
            include: {
              warehouse: true
            }
          }
        }
      });

      if (!inventory) {
        throw new Error(`Inventory item with id ${id} not found`);
      }

      // Find the new location if location is being updated
      let newLocationId = inventory.locationId;
      if (updateData.location && updateData.location !== `${inventory.location.warehouse.name}-${inventory.location.name}`) {
        const locationName = updateData.location.replace('DNCL-', '');
        const newLocation = await this.prisma.location.findFirst({
          where: {
            name: locationName,
            warehouse: {
              name: 'DNCL'
            }
          }
        });
        
        if (!newLocation) {
          throw new Error(`Location '${updateData.location}' not found`);
        }
        newLocationId = newLocation.id;
      }

      // Update the item record
      const updatedItem = await this.prisma.item.update({
        where: { id: inventory.itemId },
        data: {
          name: updateData.name,
          brand: updateData.brand,
          model: updateData.model,
          storage: updateData.storage,
          color: updateData.color,
          carrier: updateData.carrier,
          type: updateData.type,
          condition: updateData.condition
        }
      });

      // Update the inventory record
      const updatedInventory = await this.prisma.inventory.update({
        where: { id },
        data: {
          locationId: newLocationId,
          quantity: updateData.quantity
        },
        include: { 
          item: true,
          location: {
            include: {
              warehouse: true
            }
          }
        }
      });

      logger.info('Inventory item updated', { 
        inventoryId: id, 
        itemId: updatedItem.id,
        updates: updateData 
      });

      return {
        id: updatedInventory.id,
        name: updatedInventory.item.name,
        brand: updatedInventory.item.brand,
        model: updatedInventory.item.model,
        storage: updatedInventory.item.storage,
        color: updatedInventory.item.color,
        carrier: updatedInventory.item.carrier,
        type: updatedInventory.item.type,
        imei: updatedInventory.item.imei,
        serialNumber: updatedInventory.item.serialNumber,
        condition: updatedInventory.item.condition,
        quantity: updatedInventory.quantity,
        location: `${updatedInventory.location.warehouse.name}-${updatedInventory.location.name}`,
        sku: updatedInventory.sku,
        updatedAt: updatedInventory.updatedAt
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in updateInventoryItem service', { error: errorMessage, id, updateData });
      throw error;
    }
  }

  async deleteInventoryItems(ids: number[]): Promise<{ count: number }> {
    try {
      const result = await this.prisma.inventory.deleteMany({
        where: {
          id: {
            in: ids
          }
        }
      });

      logger.info('Inventory items deleted', { 
        count: result.count, 
        ids 
      });

      return { count: result.count };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in deleteInventoryItems service', { error: errorMessage, ids });
      throw error;
    }
  }

  async getLocations(): Promise<any[]> {
    try {
      const locations = await this.prisma.location.findMany({
        where: {
          warehouse: {
            name: 'DNCL'
          },
          isActive: true
        },
        include: {
          warehouse: true
        },
        orderBy: {
          name: 'asc'
        }
      });

      return locations.map(location => ({
        id: location.id,
        name: `${location.warehouse.name}-${location.name}`,
        description: location.description,
        warehouseName: location.warehouse.name,
        locationName: location.name
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getLocations service', { error: errorMessage });
      throw error;
    }
  }
} 