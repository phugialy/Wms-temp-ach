import { Request, Response } from 'express';
import { Pool } from 'pg';
import { DbIntegrityCheckService } from '../services/db-integrity-check.service';
import { logger } from '../utils/logger';

export class DbIntegrityCheckController {
  private integrityCheckService: DbIntegrityCheckService;

  constructor(pool: Pool) {
    this.integrityCheckService = new DbIntegrityCheckService(pool);
  }

  /**
   * Get statistics about missing data
   */
  getStats = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.info('Getting missing data statistics');

      const stats = await this.integrityCheckService.getMissingDataStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting missing data stats', { error: errorMessage });

      res.status(500).json({
        success: false,
        error: `Failed to get statistics: ${errorMessage}`
      });
    }
  };

  /**
   * Scan database for records with missing data (without processing)
   */
  scanMissingData = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        missingFields,
        maxItems = 1000
      } = req.body;

      logger.info('Scanning for missing data', { missingFields, maxItems });

      const result = await this.integrityCheckService.scanForMissingData({
        missingFields: missingFields || ['model', 'capacity', 'color', 'carrier'],
        maxItems: parseInt(maxItems) || 1000
      });

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error scanning for missing data', { error: errorMessage });

      res.status(500).json({
        success: false,
        error: `Failed to scan for missing data: ${errorMessage}`
      });
    }
  };

  /**
   * Run complete integrity check (scan + process)
   */
  runIntegrityCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        missingFields,
        batchSize = 5,
        maxItems = 100,
        delayBetweenBatches = 1000
      } = req.body;

      logger.info('Running integrity check', {
        missingFields,
        batchSize,
        maxItems,
        delayBetweenBatches
      });

      const result = await this.integrityCheckService.runIntegrityCheck({
        missingFields: missingFields || ['model', 'capacity', 'color', 'carrier'],
        batchSize: parseInt(batchSize) || 5,
        maxItems: parseInt(maxItems) || 100,
        delayBetweenBatches: parseInt(delayBetweenBatches) || 1000
      });

      res.json({
        success: result.success,
        data: result,
        message: `Integrity check completed. Updated ${result.recordsUpdated} records, ${result.recordsFailed} failed.`
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error running integrity check', { error: errorMessage });

      res.status(500).json({
        success: false,
        error: `Failed to run integrity check: ${errorMessage}`
      });
    }
  };

  /**
   * Process specific IMEIs (provided in request body)
   */
  processSpecificImeis = async (req: Request, res: Response): Promise<void> => {
    try {
      const { imeis } = req.body;

      if (!imeis || !Array.isArray(imeis) || imeis.length === 0) {
        res.status(400).json({
          success: false,
          error: 'IMEIs array is required'
        });
        return;
      }

      logger.info('Processing specific IMEIs', { count: imeis.length });

      // Convert IMEIs to MissingDataRecord format
      const records = imeis.map((imei: string) => ({
        imei,
        missingFields: ['model', 'capacity', 'color', 'carrier'] // Assume all are missing
      }));

      const {
        batchSize = 5,
        delayBetweenBatches = 1000
      } = req.body;

      const result = await this.integrityCheckService.processMissingData(records, {
        batchSize: parseInt(batchSize) || 5,
        delayBetweenBatches: parseInt(delayBetweenBatches) || 1000
      });

      res.json({
        success: result.success,
        data: result,
        message: `Processed ${result.recordsUpdated} records, ${result.recordsFailed} failed.`
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error processing specific IMEIs', { error: errorMessage });

      res.status(500).json({
        success: false,
        error: `Failed to process IMEIs: ${errorMessage}`
      });
    }
  };
}

