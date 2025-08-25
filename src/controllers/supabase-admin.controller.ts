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

  cleanupImeiData = async (req: Request, res: Response): Promise<void> => {
    try {
      const { imei } = req.body;

      if (!imei) {
        res.status(400).json({
          success: false,
          error: 'IMEI is required'
        });
        return;
      }

      // Validate IMEI format (basic validation)
      if (!/^\d{15}$/.test(imei)) {
        res.status(400).json({
          success: false,
          error: 'Invalid IMEI format. Must be 15 digits.'
        });
        return;
      }

      const result = await this.supabaseAdminService.cleanupImeiData(imei);

      res.status(200).json({
        success: true,
        message: `Successfully cleaned up data for IMEI: ${imei}`,
        archivedCount: result.archivedCount,
        imei: imei
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in cleanupImeiData controller (Supabase)', { error: errorMessage, body: req.body });
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup IMEI data via Supabase',
        details: errorMessage
      });
    }
  };

  searchAllImeiData = async (req: Request, res: Response): Promise<void> => {
    try {
      const { searchTerm } = req.query;

      if (!searchTerm || typeof searchTerm !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Search term is required'
        });
        return;
      }

      if (searchTerm.trim().length < 2) {
        res.status(400).json({
          success: false,
          error: 'Search term must be at least 2 characters long'
        });
        return;
      }

      const result = await this.supabaseAdminService.searchAllImeiData(searchTerm.trim());

      res.status(200).json({
        success: true,
        data: result,
        message: `Found ${result.totalRecords} records matching "${searchTerm}"`
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in searchAllImeiData controller', { error: errorMessage, query: req.query });
      res.status(500).json({
        success: false,
        error: 'Failed to search IMEI data',
        details: errorMessage
      });
    }
  };

  getAllImeiData = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.supabaseAdminService.getAllImeiData();

      res.status(200).json({
        success: true,
        data: result,
        message: `Retrieved ${result.totalRecords} total records from all IMEI tables for bulk selection`
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getAllImeiData controller', { error: errorMessage });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve all IMEI data',
        details: errorMessage
      });
    }
  };

  cleanupMultipleImeiData = async (req: Request, res: Response): Promise<void> => {
    try {
      const { imeiList } = req.body;

      if (!imeiList || !Array.isArray(imeiList) || imeiList.length === 0) {
        res.status(400).json({
          success: false,
          error: 'IMEI list is required and must be a non-empty array'
        });
        return;
      }

      // Validate IMEI format for each IMEI
      for (const imei of imeiList) {
        if (!/^\d{15}$/.test(imei)) {
          res.status(400).json({
            success: false,
            error: `Invalid IMEI format: ${imei}. Must be 15 digits.`
          });
          return;
        }
      }

      const result = await this.supabaseAdminService.cleanupMultipleImeiData(imeiList);

      res.status(200).json({
        success: true,
        data: result,
        message: `Bulk cleanup completed. Processed ${result.totalProcessed} IMEIs, ${result.successCount} successful, ${result.errorCount} failed.`
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in cleanupMultipleImeiData controller', { error: errorMessage, body: req.body });
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup multiple IMEI data',
        details: errorMessage
      });
    }
  };

  cleanupAllImeiData = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.supabaseAdminService.cleanupAllImeiData();

      res.status(200).json({
        success: true,
        data: result,
        message: result.message
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in cleanupAllImeiData controller', { error: errorMessage });
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup all IMEI data',
        details: errorMessage
      });
    }
  };

  getDeletionStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.supabaseAdminService.getDeletionStats();

      res.status(200).json({
        success: true,
        data: result,
        message: 'Deletion statistics retrieved successfully'
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getDeletionStats controller', { error: errorMessage });
      res.status(500).json({
        success: false,
        error: 'Failed to get deletion statistics',
        details: errorMessage
      });
    }
  };

  restoreImeiData = async (req: Request, res: Response): Promise<void> => {
    try {
      const { imei } = req.body;

      if (!imei) {
        res.status(400).json({
          success: false,
          error: 'IMEI is required'
        });
        return;
      }

      // Validate IMEI format
      if (!/^\d{15}$/.test(imei)) {
        res.status(400).json({
          success: false,
          error: 'Invalid IMEI format. Must be 15 digits.'
        });
        return;
      }

      const result = await this.supabaseAdminService.restoreImeiData(imei);

      res.status(200).json({
        success: true,
        data: result,
        message: result.message
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in restoreImeiData controller', { error: errorMessage, body: req.body });
      res.status(500).json({
        success: false,
        error: 'Failed to restore IMEI data',
        details: errorMessage
      });
    }
  };
}
