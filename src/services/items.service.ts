import { PrismaClient, Item } from '@prisma/client';
import { CreateItemInput, UpdateItemInput, QueryParams } from '../utils/validator';
import { logger } from '../utils/logger';
// import { generateSkuWithTimestamp } from '../utils/skuGenerator'; // Not needed - SKU handled in Product table

export class ItemsService {
  constructor(private prisma: PrismaClient) {}

  async getAllItems(query: QueryParams): Promise<{ items: Item[]; total: number; page: number; limit: number }> {
    try {
      const { page = 1, limit = 10, search, brand, condition, type } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};
      if (search) {
        where.OR = [
          { model: { contains: search, mode: 'insensitive' } },
          { imei: { contains: search, mode: 'insensitive' } },
          { carrier: { contains: search, mode: 'insensitive' } },
          { color: { contains: search, mode: 'insensitive' } }
        ];
      }
      if (brand) {
        where.model = { contains: brand, mode: 'insensitive' };
      }
      if (condition) {
        where.working = condition;
      }
      if (type) {
        where.model = { contains: type, mode: 'insensitive' };
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

  async getItemBySku(sku: string): Promise<Item[]> {
    try {
      // Note: Item model doesn't have sku field, using imei as identifier
      const items = await this.prisma.item.findMany({
        where: { imei: sku } // Using imei as the identifier
      });

      if (items.length === 0) {
        throw new Error('No items found with this identifier');
      }

      logger.info('Items retrieved by identifier', { sku, count: items.length });
      return items;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error getting items by identifier', { error: errorMessage, sku });
      throw error;
    }
  }

  async createItem(data: CreateItemInput): Promise<Item> {
    try {
      // Note: SKU generation removed - Item model doesn't have sku field
      // SKU is handled in the Product table instead

      const item = await this.prisma.item.create({
        data: {
          imei: data.imei ?? 'UNKNOWN-IMEI',
          model: data.model ?? null,
          modelNumber: data.modelNumber ?? null,
          carrier: data.carrier ?? null,
          capacity: data.capacity ?? null,
          color: data.color ?? null,
          batteryHealth: data.batteryHealth ?? null,
          batteryCount: data.batteryCount ?? null,
          working: data.working ?? null,
          location: data.location ?? null
        }
      });

      logger.info('Item created', { imei: item.imei });
      return item;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error creating item', { error: errorMessage, data });
      throw error;
    }
  }

  async updateItem(sku: string, data: UpdateItemInput): Promise<Item[]> {
    try {
      const existingItems = await this.prisma.item.findMany({
        where: { imei: sku }
      });

      if (existingItems.length === 0) {
        throw new Error('No items found with this SKU');
      }

      const updateData: any = {};
      if (data.model !== undefined) updateData.model = data.model;
      if (data.modelNumber !== undefined) updateData.modelNumber = data.modelNumber;
      if (data.carrier !== undefined) updateData.carrier = data.carrier;
      if (data.capacity !== undefined) updateData.capacity = data.capacity;
      if (data.color !== undefined) updateData.color = data.color;
      if (data.batteryHealth !== undefined) updateData.batteryHealth = data.batteryHealth;
      if (data.batteryCount !== undefined) updateData.batteryCount = data.batteryCount;
      if (data.working !== undefined) updateData.working = data.working;
      if (data.location !== undefined) updateData.location = data.location;

      const updatedItems = await Promise.all(
        existingItems.map(item =>
          this.prisma.item.update({
            where: { imei: item.imei },
            data: updateData
          })
        )
      );

      logger.info('Items updated', { sku, count: updatedItems.length });
      return updatedItems;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error updating items', { error: errorMessage, sku, data });
      throw error;
    }
  }

  async deleteItem(sku: string): Promise<void> {
    try {
      const existingItems = await this.prisma.item.findMany({
        where: { imei: sku }
      });

      if (existingItems.length === 0) {
        throw new Error('No items found with this SKU');
      }

      await Promise.all(
        existingItems.map(item =>
          this.prisma.item.delete({
            where: { imei: item.imei }
          })
        )
      );

      logger.info('Items deleted', { sku, count: existingItems.length });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error deleting items', { error: errorMessage, sku });
      throw error;
    }
  }
} 