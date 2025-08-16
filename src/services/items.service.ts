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
          { brand: { contains: search, mode: 'insensitive' } },
          { model: { contains: search, mode: 'insensitive' } },
          { modelNumber: { contains: search, mode: 'insensitive' } },
          { storage: { contains: search, mode: 'insensitive' } },
          { color: { contains: search, mode: 'insensitive' } },
          { carrier: { contains: search, mode: 'insensitive' } },
          { carrierId: { contains: search, mode: 'insensitive' } }
        ];
      }
      if (brand) {
        where.brand = brand;
      }
      if (condition) {
        where.condition = condition;
      }
      if (type) {
        where.type = type;
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
          sku: data.sku ?? skuData?.sku ?? null,
          name: data.name,
          description: data.description ?? null,
          upc: data.upc ?? null,
          brand: data.brand ?? null,
          model: data.model ?? null,
          modelNumber: data.modelNumber ?? null,
          storage: data.storage ?? null,
          color: data.color ?? null,
          carrier: data.carrier ?? null,
          carrierId: data.carrierId ?? null,
          condition: data.condition ?? 'used',
          cost: data.cost ?? null,
          price: data.price ?? null,
          weightOz: data.weightOz ?? null,
          dimensions: data.dimensions ?? null,
          imageUrl: data.imageUrl ?? null,
          type: data.type,
          imei: data.imei ?? null,
          serialNumber: data.serialNumber ?? null,
          isActive: data.isActive ?? true,
          skuGeneratedAt: skuData?.skuGeneratedAt ?? null
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
      if (data.upc !== undefined) updateData.upc = data.upc ?? null;
      if (data.brand !== undefined) updateData.brand = data.brand ?? null;
      if (data.model !== undefined) updateData.model = data.model ?? null;
      if (data.modelNumber !== undefined) updateData.modelNumber = data.modelNumber ?? null;
      if (data.storage !== undefined) updateData.storage = data.storage ?? null;
      if (data.color !== undefined) updateData.color = data.color ?? null;
      if (data.carrier !== undefined) updateData.carrier = data.carrier ?? null;
      if (data.carrierId !== undefined) updateData.carrierId = data.carrierId ?? null;
      if (data.condition !== undefined) updateData.condition = data.condition ?? null;
      if (data.cost !== undefined) updateData.cost = data.cost ?? null;
      if (data.price !== undefined) updateData.price = data.price ?? null;
      if (data.weightOz !== undefined) updateData.weightOz = data.weightOz ?? null;
      if (data.dimensions !== undefined) updateData.dimensions = data.dimensions ?? null;
      if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl ?? null;
      if (data.type !== undefined) updateData.type = data.type;
      if (data.imei !== undefined) updateData.imei = data.imei ?? null;
      if (data.serialNumber !== undefined) updateData.serialNumber = data.serialNumber ?? null;
      if (data.isActive !== undefined) updateData.isActive = data.isActive ?? null;

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