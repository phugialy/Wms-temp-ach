import { PrismaClient, InboundLog, OutboundLog } from '@prisma/client';
import { CreateInboundLogInput, CreateOutboundLogInput, LogQueryParams } from '../utils/validator';
import { logger } from '../utils/logger';

export class LogsService {
  constructor(private prisma: PrismaClient) {}

  async createInboundLog(data: CreateInboundLogInput): Promise<InboundLog> {
    return await this.prisma.$transaction(async (tx) => {
      // Verify item exists
      const item = await tx.item.findUnique({
        where: { id: data.itemId }
      });

      if (!item) {
        throw new Error(`Item with ID ${data.itemId} does not exist`);
      }

      // Create inbound log
      const inboundLog = await tx.inboundLog.create({
        data: {
          itemId: data.itemId,
          quantity: data.quantity,
          location: data.location,
          receivedBy: data.receivedBy
        },
        include: {
          item: true
        }
      });

      // Update or create inventory
      const existingInventory = await tx.inventory.findFirst({
        where: {
          itemId: data.itemId,
          location: data.location
        }
      });

      if (existingInventory) {
        // Update existing inventory
        await tx.inventory.update({
          where: { id: existingInventory.id },
          data: {
            quantity: existingInventory.quantity + data.quantity
          }
        });
        logger.info('Inventory updated for inbound', { 
          itemId: data.itemId, 
          location: data.location, 
          addedQuantity: data.quantity,
          newTotal: existingInventory.quantity + data.quantity 
        });
      } else {
        // Create new inventory record
        await tx.inventory.create({
          data: {
            itemId: data.itemId,
            sku: item.sku,
            quantity: data.quantity,
            location: data.location
          }
        });
        logger.info('New inventory created for inbound', { 
          itemId: data.itemId, 
          location: data.location, 
          quantity: data.quantity 
        });
      }

      logger.info('Inbound log created', { 
        logId: inboundLog.id, 
        itemId: data.itemId, 
        quantity: data.quantity,
        location: data.location,
        receivedBy: data.receivedBy 
      });

      return inboundLog;
    });
  }

  async createOutboundLog(data: CreateOutboundLogInput): Promise<OutboundLog> {
    return await this.prisma.$transaction(async (tx) => {
      // Verify item exists
      const item = await tx.item.findUnique({
        where: { id: data.itemId }
      });

      if (!item) {
        throw new Error(`Item with ID ${data.itemId} does not exist`);
      }

      // Check inventory availability
      const existingInventory = await tx.inventory.findFirst({
        where: {
          itemId: data.itemId,
          location: data.location
        }
      });

      if (!existingInventory) {
        throw new Error(`No inventory found for item ${data.itemId} at location ${data.location}`);
      }

      if (existingInventory.quantity < data.quantity) {
        throw new Error(`Insufficient inventory. Available: ${existingInventory.quantity}, Requested: ${data.quantity}`);
      }

      // Create outbound log
      const outboundLog = await tx.outboundLog.create({
        data: {
          itemId: data.itemId,
          quantity: data.quantity,
          location: data.location,
          shippedBy: data.shippedBy
        },
        include: {
          item: true
        }
      });

      // Update inventory
      await tx.inventory.update({
        where: { id: existingInventory.id },
        data: {
          quantity: existingInventory.quantity - data.quantity
        }
      });

      logger.info('Outbound log created and inventory updated', { 
        logId: outboundLog.id, 
        itemId: data.itemId, 
        quantity: data.quantity,
        location: data.location,
        shippedBy: data.shippedBy,
        remainingQuantity: existingInventory.quantity - data.quantity 
      });

      return outboundLog;
    });
  }

  async getAllInboundLogs(query: LogQueryParams): Promise<{ logs: InboundLog[]; total: number; page: number; limit: number }> {
    try {
      const { page = 1, limit = 10, itemId, location, startDate, endDate } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};
      if (itemId) {
        where.itemId = itemId;
      }
      if (location) {
        where.location = { contains: location, mode: 'insensitive' };
      }
      if (startDate || endDate) {
        where.receivedAt = {};
        if (startDate) {
          where.receivedAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.receivedAt.lte = new Date(endDate);
        }
      }

      const [logs, total] = await Promise.all([
        this.prisma.inboundLog.findMany({
          where,
          skip,
          take: limit,
          include: {
            item: true
          },
          orderBy: { receivedAt: 'desc' }
        }),
        this.prisma.inboundLog.count({ where })
      ]);

      logger.info('Inbound logs retrieved', { count: logs.length, total, page, limit });
      return { logs, total, page, limit };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error getting inbound logs', { error: errorMessage, query });
      throw error;
    }
  }

  async getAllOutboundLogs(query: LogQueryParams): Promise<{ logs: OutboundLog[]; total: number; page: number; limit: number }> {
    try {
      const { page = 1, limit = 10, itemId, location, startDate, endDate } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};
      if (itemId) {
        where.itemId = itemId;
      }
      if (location) {
        where.location = { contains: location, mode: 'insensitive' };
      }
      if (startDate || endDate) {
        where.shippedAt = {};
        if (startDate) {
          where.shippedAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.shippedAt.lte = new Date(endDate);
        }
      }

      const [logs, total] = await Promise.all([
        this.prisma.outboundLog.findMany({
          where,
          skip,
          take: limit,
          include: {
            item: true
          },
          orderBy: { shippedAt: 'desc' }
        }),
        this.prisma.outboundLog.count({ where })
      ]);

      logger.info('Outbound logs retrieved', { count: logs.length, total, page, limit });
      return { logs, total, page, limit };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error getting outbound logs', { error: errorMessage, query });
      throw error;
    }
  }
} 