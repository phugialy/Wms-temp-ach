import { Request, Response } from 'express';
import { hybridQueueService } from '../services/hybrid-queue.service';
import { logger } from '../utils/logger';

export class HybridQueueController {
  /**
   * Add items to queue
   */
  addToQueue = async (req: Request, res: Response): Promise<void> => {
    try {
      const { items, source, priority } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Items array is required and must not be empty'
        });
        return;
      }

      const result = await hybridQueueService.addToQueue(
        items,
        source || 'bulk-add',
        priority || 5
      );

      res.status(result.success ? 200 : 500).json({
        success: result.success,
        data: {
          processed: result.processed,
          errors: result.errors
        },
        message: result.message
      });

    } catch (error) {
      logger.error('Error in addToQueue controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get queue statistics
   */
  getQueueStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await hybridQueueService.getQueueStats();

      res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error in getQueueStats controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Process next item
   */
  processNextItem = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await hybridQueueService.processNextItem();

      res.status(result.success ? 200 : 500).json({
        success: result.success,
        data: {
          processed: result.processed,
          errors: result.errors
        },
        message: result.message
      });

    } catch (error) {
      logger.error('Error in processNextItem controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get queue items by status
   */
  getQueueItems = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, limit } = req.query;
      const items = await hybridQueueService.getQueueItems(
        status as string,
        limit ? parseInt(limit as string) : 100
      );

      res.status(200).json({
        success: true,
        data: items,
        count: items.length
      });

    } catch (error) {
      logger.error('Error in getQueueItems controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Retry failed items
   */
  retryFailedItems = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await hybridQueueService.retryFailedItems();

      res.status(result.success ? 200 : 500).json({
        success: result.success,
        data: {
          processed: result.processed,
          errors: result.errors
        },
        message: result.message
      });

    } catch (error) {
      logger.error('Error in retryFailedItems controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Clear completed items
   */
  clearCompletedItems = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await hybridQueueService.clearCompletedItems();

      res.status(result.success ? 200 : 500).json({
        success: result.success,
        data: {
          processed: result.processed,
          errors: result.errors
        },
        message: result.message
      });

    } catch (error) {
      logger.error('Error in clearCompletedItems controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get batch statistics
   */
  getBatchStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const { batchId } = req.params;

      if (!batchId) {
        res.status(400).json({
          success: false,
          message: 'Batch ID is required'
        });
        return;
      }

      const stats = await hybridQueueService.getBatchStats(batchId);

      if (!stats) {
        res.status(404).json({
          success: false,
          message: 'Batch not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error in getBatchStats controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Start queue processing
   */
  startProcessing = async (req: Request, res: Response): Promise<void> => {
    try {
      await hybridQueueService.startProcessing();

      res.status(200).json({
        success: true,
        message: 'Queue processing started'
      });

    } catch (error) {
      logger.error('Error in startProcessing controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Stop queue processing
   */
  stopProcessing = async (req: Request, res: Response): Promise<void> => {
    try {
      await hybridQueueService.stopProcessing();

      res.status(200).json({
        success: true,
        message: 'Queue processing stopped'
      });

    } catch (error) {
      logger.error('Error in stopProcessing controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}

export const hybridQueueController = new HybridQueueController();

