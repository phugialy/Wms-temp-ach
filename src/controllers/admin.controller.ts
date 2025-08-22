import { Request, Response } from 'express';
import { AdminService } from '../services/admin.service';
import { inventoryPushSchema } from '../utils/validator';
import { logger } from '../utils/logger';

export class AdminController {
  constructor(private adminService: AdminService) {}

  pushInventory = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.info('📥 pushInventory received request:', {
        bodyKeys: Object.keys(req.body),
        imei: req.body.imei,
        originalFailed: req.body.originalFailed,
        originalFailedType: typeof req.body.originalFailed,
        originalWorking: req.body.originalWorking,
        originalWorkingType: typeof req.body.originalWorking
      });

      const validatedData = inventoryPushSchema.parse(req.body);
      logger.info('✅ Validation passed:', {
        validatedKeys: Object.keys(validatedData),
        originalFailed: validatedData.originalFailed,
        originalFailedType: typeof validatedData.originalFailed
      });

      const result = await this.adminService.pushInventory(validatedData);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Inventory pushed successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('❌ Error in pushInventory controller', { 
        error: errorMessage, 
        body: req.body,
        errorStack: error instanceof Error ? error.stack : undefined
      });
      
      // Handle validation errors specifically
      if (errorMessage.includes('At least one of imei, serialNumber, or sku must be provided')) {
        res.status(400).json({
          success: false,
          error: errorMessage
        });
      } else if (errorMessage.includes('Expected')) {
        // Zod validation error
        res.status(400).json({
          success: false,
          error: `Validation error: ${errorMessage}`,
          details: error instanceof Error ? error.stack : undefined
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error occurred while processing inventory push'
        });
      }
    }
  };

  getInventory = async (req: Request, res: Response): Promise<void> => {
    try {
      const inventory = await this.adminService.getInventory();
      res.status(200).json(inventory);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getInventory controller', { error: errorMessage });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch inventory data'
      });
    }
  };

  updateInventoryItem = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'];
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Item ID is required'
        });
        return;
      }
      
      const updateData = req.body;
      const result = await this.adminService.updateInventoryItem(parseInt(id), updateData);
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'Inventory item updated successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in updateInventoryItem controller', { error: errorMessage, id: req.params['id'], body: req.body });
      res.status(500).json({
        success: false,
        error: 'Failed to update inventory item'
      });
    }
  };

  deleteInventoryItems = async (req: Request, res: Response): Promise<void> => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid or empty ids array'
        });
        return;
      }

      const result = await this.adminService.deleteInventoryItems(ids);
      res.status(200).json({
        success: true,
        data: result,
        message: `${result.count} items deleted successfully`
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in deleteInventoryItems controller', { error: errorMessage, body: req.body });
      res.status(500).json({
        success: false,
        error: 'Failed to delete inventory items'
      });
    }
  };

  getLocations = async (req: Request, res: Response): Promise<void> => {
    try {
      const locations = await this.adminService.getLocations();
      res.status(200).json(locations);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getLocations controller', { error: errorMessage });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch locations'
      });
    }
  };
} 