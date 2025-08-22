import { Request, Response } from 'express';
import { EnhancedInventoryService, EnhancedInventoryInput } from '../services/enhanced-inventory.service';
import { logger } from '../utils/logger';

export class EnhancedInventoryController {
  constructor(private enhancedInventoryService: EnhancedInventoryService) {}

  /**
   * Add a single device to enhanced inventory
   */
  addDeviceToInventory = async (req: Request, res: Response): Promise<void> => {
    try {
      const input: EnhancedInventoryInput = req.body;

      // Validate required fields
      if (!input.imei || !input.brand || !input.model || !input.location) {
        res.status(400).json({
          success: false,
          error: 'IMEI, brand, model, and location are required'
        });
        return;
      }

      logger.info('Adding device to enhanced inventory', { 
        imei: input.imei, 
        brand: input.brand, 
        model: input.model 
      });

      const result = await this.enhancedInventoryService.addDeviceToInventory(input);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: {
            productSku: result.productSku,
            unitId: result.unitId,
            itemId: result.itemId,
            locationId: result.locationId
          },
          message: 'Device successfully added to enhanced inventory'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || 'Failed to add device to inventory'
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in addDeviceToInventory controller', { error: errorMessage, body: req.body });
      
      res.status(500).json({
        success: false,
        error: `Failed to add device to inventory: ${errorMessage}`
      });
    }
  };

  /**
   * Bulk add devices to enhanced inventory
   */
  bulkAddDevicesToInventory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { devices }: { devices: EnhancedInventoryInput[] } = req.body;

      if (!devices || !Array.isArray(devices) || devices.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Devices array is required and must not be empty'
        });
        return;
      }

      // Validate each device has required fields
      const invalidDevices = devices.filter(device => 
        !device.imei || !device.brand || !device.model || !device.location
      );

      if (invalidDevices.length > 0) {
        res.status(400).json({
          success: false,
          error: `${invalidDevices.length} devices are missing required fields (IMEI, brand, model, location)`,
          invalidDevices: invalidDevices.map(d => ({ imei: d.imei, brand: d.brand, model: d.model }))
        });
        return;
      }

      logger.info('Bulk adding devices to enhanced inventory', { 
        deviceCount: devices.length 
      });

      const results = await this.enhancedInventoryService.bulkAddDevices(devices);

      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      res.status(200).json({
        success: true,
        data: {
          total: devices.length,
          success: successCount,
          errors: errorCount,
          results: results
        },
        message: `Successfully processed ${devices.length} devices: ${successCount} added, ${errorCount} failed`
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in bulkAddDevicesToInventory controller', { error: errorMessage, body: req.body });
      
      res.status(500).json({
        success: false,
        error: `Failed to bulk add devices: ${errorMessage}`
      });
    }
  };

  /**
   * Enhanced bulk processing from Phonecheck with proper schema integration
   */
  processBulkFromPhonecheck = async (req: Request, res: Response): Promise<void> => {
    try {
      const { 
        station, 
        startDate, 
        endDate, 
        location, 
        batchSize = 20, 
        streamMode = false 
      } = req.body;

      if (!station || !startDate || !location) {
        res.status(400).json({
          success: false,
          error: 'Station, start date, and location are required'
        });
        return;
      }

      logger.info('Processing bulk devices from Phonecheck to enhanced inventory', { 
        station, 
        startDate, 
        endDate, 
        location, 
        batchSize 
      });

      // This endpoint will be called after the Phonecheck data is processed
      // The frontend will send the processed devices to this endpoint
      // For now, we'll return a success response indicating the endpoint is ready
      
      res.status(200).json({
        success: true,
        data: {
          message: 'Enhanced bulk processing endpoint ready',
          station,
          startDate,
          endDate,
          location,
          batchSize,
          streamMode
        },
        note: 'Send processed devices to /api/enhanced-inventory/bulk-add for actual processing'
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in processBulkFromPhonecheck controller', { error: errorMessage, body: req.body });
      
      res.status(500).json({
        success: false,
        error: `Failed to process bulk from Phonecheck: ${errorMessage}`
      });
    }
  };

  /**
   * Get enhanced inventory summary
   */
  getInventorySummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const { site = 'DNCL' } = req.query;

      logger.info('Getting enhanced inventory summary', { site });

      // Get summary from inventory_item table
      const summary = await this.enhancedInventoryService.getInventorySummary(site as string);

      res.status(200).json({
        success: true,
        data: summary,
        message: 'Enhanced inventory summary retrieved successfully'
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getInventorySummary controller', { error: errorMessage, query: req.query });
      
      res.status(500).json({
        success: false,
        error: `Failed to get inventory summary: ${errorMessage}`
      });
    }
  };

  /**
   * Get devices by location
   */
  getDevicesByLocation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { location } = req.params;
      const { limit = 100, offset = 0 } = req.query;

      if (!location) {
        res.status(400).json({
          success: false,
          error: 'Location is required'
        });
        return;
      }

      logger.info('Getting devices by location', { location, limit, offset });

      const devices = await this.enhancedInventoryService.getDevicesByLocation(
        location, 
        parseInt(limit as string), 
        parseInt(offset as string)
      );

      res.status(200).json({
        success: true,
        data: devices,
        message: `Retrieved devices for location: ${location}`
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getDevicesByLocation controller', { error: errorMessage, params: req.params });
      
      res.status(500).json({
        success: false,
        error: `Failed to get devices by location: ${errorMessage}`
      });
    }
  };
}
