import { Request, Response } from 'express';
import { InventoryService } from '../services/inventory.service';
import { logger } from '../utils/logger';

export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  getAllInventory = async (req: Request, res: Response): Promise<void> => {
    try {
      const inventory = await this.inventoryService.getAllInventory();
      
      res.status(200).json({
        success: true,
        data: inventory,
        message: 'Inventory retrieved successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getAllInventory controller', { error: errorMessage });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve inventory'
      });
    }
  };

  getInventoryBySku = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sku } = req.params;
      
      // For now, we'll get all inventory and filter by SKU
      const allInventory = await this.inventoryService.getAllInventory();
      const inventory = allInventory.filter(inv => inv.item.sku === sku);
      
      if (inventory.length === 0) {
        res.status(404).json({
          success: false,
          error: 'No inventory found for this SKU'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: inventory,
        message: 'Inventory retrieved successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getInventoryBySku controller', { error: errorMessage, sku: req.params['sku'] });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve inventory by SKU'
      });
    }
  };

  createInventory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { itemId, locationId, sku, quantity } = req.body;
      
      const inventory = await this.inventoryService.createInventory({
        itemId,
        locationId,
        sku,
        quantity
      });

      res.status(201).json({
        success: true,
        data: inventory,
        message: 'Inventory created successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in createInventory controller', { error: errorMessage, body: req.body });
      res.status(500).json({
        success: false,
        error: 'Failed to create inventory'
      });
    }
  };

  updateInventory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Inventory ID is required'
        });
        return;
      }
      
      const updateData = req.body;
      const inventory = await this.inventoryService.updateInventory(parseInt(id), updateData);

      res.status(200).json({
        success: true,
        data: inventory,
        message: 'Inventory updated successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in updateInventory controller', { error: errorMessage, id: req.params['id'], body: req.body });
      res.status(500).json({
        success: false,
        error: 'Failed to update inventory'
      });
    }
  };

  deleteInventory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Inventory ID is required'
        });
        return;
      }
      
      await this.inventoryService.deleteInventory(parseInt(id));

      res.status(200).json({
        success: true,
        message: 'Inventory deleted successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in deleteInventory controller', { error: errorMessage, id: req.params['id'] });
      res.status(500).json({
        success: false,
        error: 'Failed to delete inventory'
      });
    }
  };
} 