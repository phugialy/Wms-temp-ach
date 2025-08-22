import { Request, Response } from 'express';
import { SupabaseAdminService } from '../services/supabase-admin.service';
import { inventoryPushSchema } from '../utils/validator';
import { logger } from '../utils/logger';

export class SupabaseAdminController {
  constructor(private supabaseAdminService: SupabaseAdminService) {}

  pushInventory = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = inventoryPushSchema.parse(req.body);
      const result = await this.supabaseAdminService.pushInventory(validatedData);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Inventory pushed successfully via Supabase API'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in pushInventory controller (Supabase)', { error: errorMessage, body: req.body });
      
      // Handle validation errors specifically
      if (errorMessage.includes('At least one of imei, serialNumber, or sku must be provided')) {
        res.status(400).json({
          success: false,
          error: errorMessage
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error occurred while processing inventory push via Supabase'
        });
      }
    }
  };

  getInventory = async (req: Request, res: Response): Promise<void> => {
    try {
      const inventory = await this.supabaseAdminService.getInventory();
      res.status(200).json(inventory);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getInventory controller (Supabase)', { error: errorMessage });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch inventory data via Supabase'
      });
    }
  };

  getLocations = async (req: Request, res: Response): Promise<void> => {
    try {
      const locations = await this.supabaseAdminService.getLocations();
      res.status(200).json(locations);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getLocations controller (Supabase)', { error: errorMessage });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch locations data via Supabase'
      });
    }
  };
}
