import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export interface EnhancedInventoryInput {
  name: string;
  brand: string;
  model: string;
  storage?: string;
  color?: string;
  carrier?: string;
  type: string;
  imei: string;
  serialNumber?: string;
  condition?: string;
  working: string;
  quantity: number;
  location: string;
  // Enhanced fields from Phonecheck
  batteryHealth?: string;
  batteryCycle?: string;
  mdm?: string;
  notes?: string;
  failed?: string;
  testerName?: string;
  repairNotes?: string;
  firstReceived?: string;
  lastUpdate?: string;
  checkDate?: string;
  // Additional metadata
  dataQuality?: string;
  processingLevel?: string;
  source?: string;
}

export interface EnhancedInventoryResult {
  success: boolean;
  productSku?: string;
  unitId?: number;
  itemId?: number;
  locationId?: number;
  error?: string;
  details?: any;
}

export class EnhancedInventoryService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Add a device to the enhanced WMS inventory system
   * This creates/updates the proper tables in the new schema
   */
  async addDeviceToInventory(input: EnhancedInventoryInput): Promise<EnhancedInventoryResult> {
    try {
      logger.info('Adding device to enhanced inventory', { 
        imei: input.imei, 
        brand: input.brand, 
        model: input.model,
        location: input.location 
      });

      // Step 1: Generate or find product SKU
      const productSku = await this.ensureProductExists(input);
      
      // Step 2: Ensure location exists
      const locationId = await this.ensureLocationExists(input.location);
      
      // Step 3: Create or update inventory unit (per-IMEI tracking)
      const unitId = await this.ensureInventoryUnitExists(input, productSku, locationId);
      
      // Step 4: Create or update IMEI details
      await this.ensureImeiDetailsExist(input, unitId);
      
      // Step 5: Update inventory item rollup (SKU-level)
      const itemId = await this.updateInventoryItemRollup(productSku, input.location.split('-')[0] || 'DNCL');
      
      // Step 6: Create ledger entry for receipt
      await this.createLedgerEntry(input, productSku, unitId, 'RECEIPT');

      logger.info('Successfully added device to enhanced inventory', { 
        imei: input.imei, 
        productSku, 
        unitId, 
        itemId, 
        locationId 
      });

      return {
        success: true,
        productSku,
        unitId: Number(unitId),
        itemId: Number(itemId),
        locationId: Number(locationId)
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error adding device to enhanced inventory', { 
        error: errorMessage, 
        input: { imei: input.imei, brand: input.brand, model: input.model } 
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Ensure product exists in the product catalog
   */
  private async ensureProductExists(input: EnhancedInventoryInput): Promise<string> {
    // Generate SKU based on brand, model, storage, color
    const sku = this.generateProductSku(input);
    
    try {
      // Try to find existing product
      const existingProduct = await this.prisma.$queryRaw`
        SELECT sku FROM product WHERE sku = ${sku}
      `;

      if (existingProduct && Array.isArray(existingProduct) && existingProduct.length > 0) {
        logger.info('Product already exists', { sku });
        return sku;
      }

      // Create new product
      await this.prisma.$executeRaw`
        INSERT INTO product (sku, category, brand, model, grade_schema)
        VALUES (${sku}, ${input.type}, ${input.brand}, ${input.model}, 'abc')
        ON CONFLICT (sku) DO NOTHING
      `;

      logger.info('Created new product', { sku, brand: input.brand, model: input.model });
      return sku;

    } catch (error) {
      logger.error('Error ensuring product exists', { error, sku });
      throw error;
    }
  }

  /**
   * Generate a consistent SKU for the product
   */
  private generateProductSku(input: EnhancedInventoryInput): string {
    const brand = input.brand?.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'UNK';
    const model = input.model?.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'UNK';
    const storage = input.storage?.toUpperCase().replace(/[^A-Z0-9]/g, '') || '';
    const color = input.color?.toUpperCase().replace(/[^A-Z0-9]/g, '') || '';
    
    return `${brand}-${model}${storage ? `-${storage}` : ''}${color ? `-${color}` : ''}`;
  }

  /**
   * Ensure location exists in the location table
   */
  private async ensureLocationExists(locationString: string): Promise<number> {
    try {
      // Parse location string (e.g., "DNCL-Inspection" -> site: "DNCL", zone: "A", bin: "Inspection")
      const parts = locationString.split('-');
      const site = parts[0] || 'DNCL';
      const zone = parts[1] || 'A';
      const bin = parts.slice(2).join('-') || 'Default';

      // Try to find existing location
      const existingLocation = await this.prisma.$queryRaw`
        SELECT id FROM location WHERE site = ${site} AND zone = ${zone} AND bin = ${bin}
      `;

      if (existingLocation && Array.isArray(existingLocation) && existingLocation.length > 0) {
        const location = existingLocation[0] as any;
        logger.info('Location already exists', { locationId: location.id, site, zone, bin });
        return location.id;
      }

      // Create new location
      const result = await this.prisma.$queryRaw`
        INSERT INTO location (site, zone, bin)
        VALUES (${site}, ${zone}, ${bin})
        ON CONFLICT (site, zone, bin) DO UPDATE SET id = location.id
        RETURNING id
      `;

      const location = (result as any[])[0];
      logger.info('Created new location', { locationId: location.id, site, zone, bin });
      return location.id;

    } catch (error) {
      logger.error('Error ensuring location exists', { error, locationString });
      throw error;
    }
  }

  /**
   * Ensure inventory unit exists (per-IMEI tracking)
   */
  private async ensureInventoryUnitExists(
    input: EnhancedInventoryInput, 
    productSku: string, 
    locationId: number
  ): Promise<number> {
    try {
      // Try to find existing unit by IMEI
      const existingUnit = await this.prisma.$queryRaw`
        SELECT id FROM inventory_unit WHERE imei = ${input.imei}
      `;

      if (existingUnit && Array.isArray(existingUnit) && existingUnit.length > 0) {
        const unit = existingUnit[0] as any;
        logger.info('Inventory unit already exists, updating', { unitId: unit.id, imei: input.imei });
        
        // Update existing unit
        await this.prisma.$executeRaw`
          UPDATE inventory_unit 
          SET sku = ${productSku},
              sku_current = ${productSku},
              site = ${input.location.split('-')[0] || 'DNCL'},
              status = 'RECEIVED',
              location_id = ${locationId},
              working = ${input.working},
              date_in = CURRENT_DATE,
              updated_at = NOW()
          WHERE id = ${unit.id}
        `;

        return unit.id;
      }

      // Create new unit
      const result = await this.prisma.$queryRaw`
        INSERT INTO inventory_unit (
          imei, sku, sku_current, site, status, location_id, working, date_in, created_at, updated_at
        )
        VALUES (
          ${input.imei}, 
          ${productSku}, 
          ${productSku}, 
          ${input.location.split('-')[0] || 'DNCL'}, 
          'RECEIVED', 
          ${locationId}, 
          ${input.working}, 
          CURRENT_DATE, 
          NOW(), 
          NOW()
        )
        RETURNING id
      `;

      const unit = (result as any[])[0];
      logger.info('Created new inventory unit', { unitId: unit.id, imei: input.imei });
      return unit.id;

    } catch (error) {
      logger.error('Error ensuring inventory unit exists', { error, imei: input.imei });
      throw error;
    }
  }

  /**
   * Ensure IMEI details exist
   */
  private async ensureImeiDetailsExist(input: EnhancedInventoryInput, unitId: number): Promise<void> {
    try {
      // Check if details already exist
      const existingDetails = await this.prisma.$queryRaw`
        SELECT unit_id FROM imei_detail WHERE unit_id = ${unitId}
      `;

      if (existingDetails && Array.isArray(existingDetails) && existingDetails.length > 0) {
        logger.info('IMEI details already exist, updating', { unitId });
        
        // Update existing details
        await this.prisma.$executeRaw`
          UPDATE imei_detail 
          SET model = ${input.model},
              carrier = ${input.carrier || null},
              bh = ${input.batteryHealth || null},
              bcc = ${input.batteryCycle || null},
              ram = ${input.storage || null},
              tester = ${input.testerName || null},
              last_phonecheck_update = ${input.lastUpdate ? new Date(input.lastUpdate) : null}
          WHERE unit_id = ${unitId}
        `;
      } else {
        // Create new details
        await this.prisma.$executeRaw`
          INSERT INTO imei_detail (
            unit_id, model, carrier, bh, bcc, ram, tester, last_phonecheck_update
          )
          VALUES (
            ${unitId},
            ${input.model},
            ${input.carrier || null},
            ${input.batteryHealth || null},
            ${input.batteryCycle || null},
            ${input.storage || null},
            ${input.testerName || null},
            ${input.lastUpdate ? new Date(input.lastUpdate) : null}
          )
        `;

        logger.info('Created new IMEI details', { unitId });
      }

    } catch (error) {
      logger.error('Error ensuring IMEI details exist', { error, unitId });
      throw error;
    }
  }

  /**
   * Update inventory item rollup (SKU-level)
   */
  private async updateInventoryItemRollup(productSku: string, site: string): Promise<number> {
    try {
      // Trigger the recalc function to update the rollup
      await this.prisma.$executeRaw`
        SELECT recalc_item_counts(${productSku}, ${site})
      `;

      // Get the updated item ID
      const result = await this.prisma.$queryRaw`
        SELECT id FROM inventory_item WHERE sku = ${productSku} AND site = ${site}
      `;

      const item = (result as any[])[0];
      logger.info('Updated inventory item rollup', { itemId: item.id, sku: productSku, site });
      return item.id;

    } catch (error) {
      logger.error('Error updating inventory item rollup', { error, sku: productSku, site });
      throw error;
    }
  }

  /**
   * Create ledger entry for the transaction
   */
  private async createLedgerEntry(
    input: EnhancedInventoryInput, 
    productSku: string, 
    unitId: number, 
    reason: string
  ): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO inventory_ledger (
          site, sku, qty_delta, unit_id, reason, ref_table, ref_id, note
        )
        VALUES (
          ${input.location.split('-')[0] || 'DNCL'},
          ${productSku},
          1,
          ${unitId},
          ${reason}::ledger_reason,
          'inventory_unit',
          ${unitId},
          ${`Receipt: ${input.imei}`}
        )
      `;

      logger.info('Created ledger entry', { sku: productSku, unitId, reason });

    } catch (error) {
      logger.error('Error creating ledger entry', { error, sku: productSku, unitId });
      throw error;
    }
  }

  /**
   * Bulk add devices to enhanced inventory
   */
  async bulkAddDevices(devices: EnhancedInventoryInput[]): Promise<EnhancedInventoryResult[]> {
    logger.info('Starting bulk add to enhanced inventory', { deviceCount: devices.length });

    const results: EnhancedInventoryResult[] = [];
    
    for (const device of devices) {
      try {
        const result = await this.addDeviceToInventory(device);
        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        logger.error('Error in bulk add for device', { error: errorMessage, imei: device.imei });
        results.push({
          success: false,
          error: errorMessage
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    logger.info('Bulk add to enhanced inventory completed', { 
      total: devices.length, 
      success: successCount, 
      errors: errorCount 
    });

    return results;
  }

  /**
   * Get inventory summary for a site
   */
  async getInventorySummary(site: string): Promise<any> {
    try {
      const summary = await this.prisma.$queryRaw`
        SELECT 
          COUNT(*) as total_products,
          SUM(on_hand) as total_on_hand,
          SUM(ready) as total_ready,
          SUM(available) as total_available,
          SUM(qa_hold) as total_qa_hold,
          SUM(damaged) as total_damaged
        FROM inventory_item 
        WHERE site = ${site}
      `;

      const locationSummary = await this.prisma.$queryRaw`
        SELECT 
          l.site,
          l.zone,
          l.bin,
          COUNT(iu.id) as unit_count
        FROM location l
        LEFT JOIN inventory_unit iu ON l.id = iu.location_id
        WHERE l.site = ${site}
        GROUP BY l.site, l.zone, l.bin
        ORDER BY l.zone, l.bin
      `;

      // Convert BigInt values to numbers for JSON serialization
      const summaryData = (summary as any[])[0];
      const locationsData = (locationSummary as any[]).map(loc => ({
        ...loc,
        unit_count: Number(loc.unit_count)
      }));

      return {
        site,
        summary: {
          total_products: Number(summaryData.total_products),
          total_on_hand: Number(summaryData.total_on_hand),
          total_ready: Number(summaryData.total_ready),
          total_available: Number(summaryData.total_available),
          total_qa_hold: Number(summaryData.total_qa_hold),
          total_damaged: Number(summaryData.total_damaged)
        },
        locations: locationsData
      };

    } catch (error) {
      logger.error('Error getting inventory summary', { error, site });
      throw error;
    }
  }

  /**
   * Get devices by location
   */
  async getDevicesByLocation(location: string, limit: number = 100, offset: number = 0): Promise<any[]> {
    try {
      const devices = await this.prisma.$queryRaw`
        SELECT 
          iu.id as unit_id,
          iu.imei,
          iu.sku,
          iu.status,
          iu.working,
          iu.created_at,
          iu.updated_at,
          p.brand,
          p.model,
          p.category,
          id.carrier,
          id.bh as battery_health,
          id.ram as storage,
          l.site,
          l.zone,
          l.bin
        FROM inventory_unit iu
        JOIN product p ON iu.sku = p.sku
        LEFT JOIN imei_detail id ON iu.id = id.unit_id
        LEFT JOIN location l ON iu.location_id = l.id
        WHERE l.site || '-' || l.zone || '-' || l.bin = ${location}
        ORDER BY iu.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      // Convert BigInt values to numbers for JSON serialization
      const devicesData = (devices as any[]).map(device => ({
        ...device,
        unit_id: Number(device.unit_id)
      }));

      return devicesData;

    } catch (error) {
      logger.error('Error getting devices by location', { error, location });
      throw error;
    }
  }
}
