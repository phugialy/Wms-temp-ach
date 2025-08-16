import { Request, Response } from 'express';
import { LogsService } from '../services/logs.service';
import { 
  createInboundLogSchema, 
  createOutboundLogSchema, 
  logQueryParamsSchema 
} from '../utils/validator';
import { logger } from '../utils/logger';

export class LogsController {
  constructor(private logsService: LogsService) {}

  createInboundLog = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = createInboundLogSchema.parse(req.body);
      const inboundLog = await this.logsService.createInboundLog(validatedData);

      res.status(201).json({
        success: true,
        data: inboundLog,
        message: 'Inbound log created and inventory updated successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in createInboundLog controller', { error: errorMessage });
      res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
  };

  createOutboundLog = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = createOutboundLogSchema.parse(req.body);
      const outboundLog = await this.logsService.createOutboundLog(validatedData);

      res.status(201).json({
        success: true,
        data: outboundLog,
        message: 'Outbound log created and inventory updated successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in createOutboundLog controller', { error: errorMessage });
      
      if (errorMessage.includes('Insufficient inventory') || errorMessage.includes('No inventory found')) {
        res.status(409).json({
          success: false,
          error: errorMessage
        });
      } else {
        res.status(400).json({
          success: false,
          error: errorMessage
        });
      }
    }
  };

  getAllInboundLogs = async (req: Request, res: Response): Promise<void> => {
    try {
      const queryParams = logQueryParamsSchema.parse(req.query);
      const result = await this.logsService.getAllInboundLogs(queryParams);

      res.status(200).json({
        success: true,
        data: result.logs,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          pages: Math.ceil(result.total / result.limit)
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getAllInboundLogs controller', { error: errorMessage });
      res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
  };

  getAllOutboundLogs = async (req: Request, res: Response): Promise<void> => {
    try {
      const queryParams = logQueryParamsSchema.parse(req.query);
      const result = await this.logsService.getAllOutboundLogs(queryParams);

      res.status(200).json({
        success: true,
        data: result.logs,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          pages: Math.ceil(result.total / result.limit)
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getAllOutboundLogs controller', { error: errorMessage });
      res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
  };
} 