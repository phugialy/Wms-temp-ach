import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import ImeiArchivalService from '../services/imei-archival.service';

export class ImeiArchivalController {
  
  /**
   * Manually archive an IMEI and all its related data
   */
  async archiveImei(req: Request, res: Response): Promise<void> {
    try {
      const { imei, reason = 'manual_delete' } = req.body;
      
      if (!imei) {
        res.status(400).json({
          success: false,
          error: 'IMEI is required'
        });
        return;
      }
      
      logger.info('Manually archiving IMEI', { imei, reason });
      
      const result = await ImeiArchivalService.archiveImei(imei, reason);
      
      res.status(200).json({
        success: true,
        data: result,
        message: `Archived ${result.archived} records for IMEI ${imei}`
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in archiveImei controller', { error: errorMessage, body: req.body });
      
      res.status(500).json({
        success: false,
        error: `Failed to archive IMEI: ${errorMessage}`
      });
    }
  }
  
  /**
   * Get archive statistics
   */
  async getArchiveStats(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Getting archive statistics');
      
      const stats = await ImeiArchivalService.getArchiveStats();
      
      res.status(200).json({
        success: true,
        data: stats,
        message: 'Archive statistics retrieved successfully'
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getArchiveStats controller', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: `Failed to get archive statistics: ${errorMessage}`
      });
    }
  }
  
  /**
   * Get archived records for an IMEI
   */
  async getArchivedRecords(req: Request, res: Response): Promise<void> {
    try {
      const { imei } = req.params;
      
      if (!imei) {
        res.status(400).json({
          success: false,
          error: 'IMEI is required'
        });
        return;
      }
      
      logger.info('Getting archived records', { imei });
      
      const records = await ImeiArchivalService.getArchivedRecords(imei);
      
      res.status(200).json({
        success: true,
        data: records,
        count: records.length,
        message: `Retrieved ${records.length} archived records for IMEI ${imei}`
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getArchivedRecords controller', { error: errorMessage, params: req.params });
      
      res.status(500).json({
        success: false,
        error: `Failed to get archived records: ${errorMessage}`
      });
    }
  }
  
  /**
   * Get all archived records with filters
   */
  async getAllArchivedRecords(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 100, offset = 0, table, reason } = req.query;
      
      logger.info('Getting all archived records', { limit, offset, table, reason });
      
      const records = await ImeiArchivalService.getAllArchivedRecords(
        Number(limit),
        Number(offset),
        table as string | undefined,
        reason as string | undefined
      );
      
      res.status(200).json({
        success: true,
        data: records,
        count: records.length,
        message: 'Archived records retrieved successfully'
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getAllArchivedRecords controller', { error: errorMessage, query: req.query });
      
      res.status(500).json({
        success: false,
        error: `Failed to get archived records: ${errorMessage}`
      });
    }
  }
  
  /**
   * Restore archived IMEI data
   */
  async restoreArchivedImei(req: Request, res: Response): Promise<void> {
    try {
      const { imei } = req.params;
      
      if (!imei) {
        res.status(400).json({
          success: false,
          error: 'IMEI is required'
        });
        return;
      }
      
      logger.info('Restoring archived IMEI', { imei });
      
      const result = await ImeiArchivalService.restoreArchivedImei(imei);
      
      res.status(200).json({
        success: true,
        data: result,
        message: `Restored ${result.restored} records for IMEI ${imei}`
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in restoreArchivedImei controller', { error: errorMessage, params: req.params });
      
      res.status(500).json({
        success: false,
        error: `Failed to restore archived IMEI: ${errorMessage}`
      });
    }
  }
  
  /**
   * Get data log records
   */
  async getDataLogRecords(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 100, offset = 0, status, source } = req.query;
      
      logger.info('Getting data log records', { limit, offset, status, source });
      
      const records = await ImeiArchivalService.getDataLogRecords(
        Number(limit),
        Number(offset),
        status as string | undefined,
        source as string | undefined
      );
      
      res.status(200).json({
        success: true,
        data: records,
        count: records.length,
        message: 'Data log records retrieved successfully'
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getDataLogRecords controller', { error: errorMessage, query: req.query });
      
      res.status(500).json({
        success: false,
        error: `Failed to get data log records: ${errorMessage}`
      });
    }
  }
  
  /**
   * Get data log statistics
   */
  async getDataLogStats(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Getting data log statistics');
      
      const stats = await ImeiArchivalService.getDataLogStats();
      
      res.status(200).json({
        success: true,
        data: stats,
        message: 'Data log statistics retrieved successfully'
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getDataLogStats controller', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: `Failed to get data log statistics: ${errorMessage}`
      });
    }
  }
  
  /**
   * Cleanup old queue data
   */
  async cleanupOldQueueData(req: Request, res: Response): Promise<void> {
    try {
      const { olderThanDays = 7 } = req.body;
      
      logger.info('Cleaning up old queue data', { olderThanDays });
      
      const result = await ImeiArchivalService.cleanupOldQueueData(olderThanDays);
      
      res.status(200).json({
        success: true,
        data: result,
        message: `Cleaned up ${result.cleaned} old queue items`
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in cleanupOldQueueData controller', { error: errorMessage, body: req.body });
      
      res.status(500).json({
        success: false,
        error: `Failed to cleanup old queue data: ${errorMessage}`
      });
    }
  }
  
  /**
   * Permanently delete archived records
   */
  async permanentlyDeleteArchived(req: Request, res: Response): Promise<void> {
    try {
      const { imei } = req.params;
      
      if (!imei) {
        res.status(400).json({
          success: false,
          error: 'IMEI is required'
        });
        return;
      }
      
      logger.info('Permanently deleting archived IMEI', { imei });
      
      const result = await ImeiArchivalService.permanentlyDeleteArchived(imei);
      
      res.status(200).json({
        success: true,
        data: result,
        message: `Permanently deleted ${result.deleted} archived records for IMEI ${imei}`
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in permanentlyDeleteArchived controller', { error: errorMessage, params: req.params });
      
      res.status(500).json({
        success: false,
        error: `Failed to permanently delete archived IMEI: ${errorMessage}`
      });
    }
  }
  
  /**
   * Get processing performance metrics
   */
  async getProcessingMetrics(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Getting processing performance metrics');
      
      const metrics = await ImeiArchivalService.getProcessingMetrics();
      
      res.status(200).json({
        success: true,
        data: metrics,
        message: 'Processing metrics retrieved successfully'
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getProcessingMetrics controller', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: `Failed to get processing metrics: ${errorMessage}`
      });
    }
  }
}

export default new ImeiArchivalController();
