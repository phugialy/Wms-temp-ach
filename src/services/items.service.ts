import { PrismaClient, Item } from '@prisma/client';
import { CreateItemInput, UpdateItemInput, QueryParams } from '../utils/validator';
import { logger } from '../utils/logger';
import { generateSkuWithTimestamp } from '../utils/skuGenerator';

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
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { imei: { contains: search, mode: 'insensitive' } }
        ];
      }
      if (brand) {
        where.description = { contains: brand, mode: 'insensitive' };
      }
      if (condition) {
        where.status = condition;
      }
      if (type) {
        where.description = { contains: type, mode: 'insensitive' };
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
      const items = await this.prisma.item.findMany({
        where: { sku }
      });

      if (items.length === 0) {
        throw new Error('No items found with this SKU');
      }

      logger.info('Items retrieved by SKU', { sku, count: items.length });
      return items;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error getting items by SKU', { error: errorMessage, sku });
      throw error;
    }
  }

  async createItem(data: CreateItemInput): Promise<Item> {
    try {
      // Generate SKU if not provided
      let skuData: { sku: string; skuGeneratedAt: Date } | undefined;
      if (!data.sku) {
        skuData = generateSkuWithTimestamp(data);
        logger.info('SKU auto-generated', { sku: skuData.sku, itemData: data });
      }

      const item = await this.prisma.item.create({
        data: {
          sku: data.sku ?? skuData?.sku ?? 'DEFAULT-SKU',
          name: data.name,
          description: data.description ?? null,
          imei: data.imei ?? 'UNKNOWN-IMEI',
          status: data.status ?? 'active'
        }
      });

      logger.info('Item created', { itemId: item.id, sku: item.sku });
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
        where: { sku }
      });

      if (existingItems.length === 0) {
        throw new Error('No items found with this SKU');
      }

      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description ?? null;
      if (data.imei !== undefined) updateData.imei = data.imei ?? 'UNKNOWN-IMEI';
      if (data.status !== undefined) updateData.status = data.status ?? 'active';

      const updatedItems = await Promise.all(
        existingItems.map(item =>
          this.prisma.item.update({
            where: { id: item.id },
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
        where: { sku }
      });

      if (existingItems.length === 0) {
        throw new Error('No items found with this SKU');
      }

      await Promise.all(
        existingItems.map(item =>
          this.prisma.item.delete({
            where: { id: item.id }
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