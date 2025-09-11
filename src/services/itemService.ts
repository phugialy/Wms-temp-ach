import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export interface CreateItemInput {
  imei: string;
  model?: string;
  modelNumber?: string;
  carrier?: string;
  capacity?: string;
  color?: string;
  batteryHealth?: string;
  batteryCount?: number;
  working?: string;
  location?: string;
}

export interface UpdateItemInput {
  model?: string;
  modelNumber?: string;
  carrier?: string;
  capacity?: string;
  color?: string;
  batteryHealth?: string;
  batteryCount?: number;
  working?: string;
  location?: string;
}

export class ItemService {
  constructor(private prisma: PrismaClient) {}

  async createItem(data: CreateItemInput) {
    try {
      // Check if IMEI already exists
      const existingItem = await this.prisma.item.findUnique({
        where: { imei: data.imei }
      });

      if (existingItem) {
        throw new Error(`Item with IMEI ${data.imei} already exists`);
      }

      // Create item (Product will be created separately due to schema constraints)
      const item = await this.prisma.item.create({
        data: {
          imei: data.imei,
          model: data.model,
          modelNumber: data.modelNumber,
          carrier: data.carrier,
          capacity: data.capacity,
          color: data.color,
          batteryHealth: data.batteryHealth,
          batteryCount: data.batteryCount,
          working: data.working || 'PENDING',
          location: data.location || 'Default Location'
        }
      });

      // Create associated product
      await this.prisma.product.create({
        data: {
          imei: data.imei,
          sku: `SKU-${data.imei}`, // Generate a basic SKU
          brand: data.model?.split(' ')[0] || 'Unknown'
        }
      });

      logger.info('Item created', { imei: item.imei });
      return item;
    } catch (error) {
      logger.error('Error creating item', { error, data });
      throw error;
    }
  }

  async getItemByImei(imei: string) {
    try {
      const item = await this.prisma.item.findUnique({
        where: { imei }
      });

      if (!item) {
        throw new Error(`Item with IMEI ${imei} not found`);
      }

      return item;
    } catch (error) {
      logger.error('Error getting item by IMEI', { error, imei });
      throw error;
    }
  }

  async updateItem(imei: string, data: UpdateItemInput) {
    try {
      const item = await this.prisma.item.update({
        where: { imei },
        data
      });

      logger.info('Item updated', { imei: item.imei });
      return item;
    } catch (error) {
      logger.error('Error updating item', { error, imei, data });
      throw error;
    }
  }

  async deleteItem(imei: string) {
    try {
      await this.prisma.item.delete({
        where: { imei }
      });

      logger.info('Item deleted', { imei });
    } catch (error) {
      logger.error('Error deleting item', { error, imei });
      throw error;
    }
  }

  async getAllItems() {
    try {
      const items = await this.prisma.item.findMany({
        orderBy: { createdAt: 'desc' }
      });

      return items;
    } catch (error) {
      logger.error('Error getting all items', { error });
      throw error;
    }
  }

  async getItemsByBrand() {
    try {
      const items = await this.prisma.item.findMany({
        select: { model: true },
        where: { model: { not: null } },
        distinct: ['model']
      });

      return items.map(item => item.model).filter(Boolean);
    } catch (error) {
      logger.error('Error getting items by brand', { error });
      throw error;
    }
  }
}