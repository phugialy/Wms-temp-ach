import { PrismaClient } from '@prisma/client';
import { PhonecheckService } from './phonecheck.service';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface BulkAddWorkflowParams {
  stations: string[];
  dateFrom: string; // ISO date string
  dateTo: string; // ISO date string
  location: string;
  triggerSource?: string; // 'vercel-cron', 'manual', 'api'
}

export interface WorkflowExecutionResult {
  executionId: bigint;
  success: boolean;
  status: 'completed' | 'failed';
  devicesFound: number;
  devicesProcessed: number;
  devicesAdded: number;
  devicesFailed: number;
  durationMs: number;
  errorMessage?: string;
  errorDetails?: any;
}

export class WorkflowEngineService {
  constructor(
    private phonecheckService: PhonecheckService
  ) {}

  /**
   * Execute bulk-add workflow automation
   * Wraps: Get device data → Pull info → Push to DB
   */
  async executeBulkAddWorkflow(params: BulkAddWorkflowParams): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    let executionId: bigint | null = null;

    try {
      // Step 1: Create execution record
      const execution = await prisma.cronJobExecution.create({
        data: {
          workflowType: 'bulk-add',
          triggerSource: params.triggerSource || 'api',
          status: 'running',
          stations: params.stations,
          dateFrom: new Date(params.dateFrom),
          dateTo: new Date(params.dateTo),
          location: params.location,
          startedAt: new Date(),
          metadata: {
            workflowVersion: '1.0',
            stations: params.stations,
            dateRange: {
              from: params.dateFrom,
              to: params.dateTo
            }
          }
        }
      });

      executionId = execution.id;
      logger.info('🚀 Workflow execution started', {
        executionId: executionId.toString(),
        workflowType: 'bulk-add',
        stations: params.stations,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        location: params.location
      });

      let totalDevicesFound = 0;
      let totalDevicesProcessed = 0;
      let totalDevicesAdded = 0;
      let totalDevicesFailed = 0;
      const errors: any[] = [];

      // Step 2: Process each station
      for (const station of params.stations) {
        logger.info(`📡 Processing station: ${station}`, {
          executionId: executionId.toString(),
          station,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo
        });

        try {
          // Step 2.1: Get device data from Phonecheck
          const devices = await this.phonecheckService.getAllDevicesFromStation(
            station,
            params.dateFrom,
            params.dateTo
          );

          totalDevicesFound += devices.length;
          logger.info(`📦 Found ${devices.length} devices from station ${station}`, {
            executionId: executionId.toString(),
            station,
            deviceCount: devices.length
          });

          if (devices.length === 0) {
            continue;
          }

          // Step 2.2: Process each device (Pull info + Push to DB)
          for (const device of devices) {
            try {
              const imei = device['IMEI'] || device['imei'];
              if (!imei) {
                totalDevicesFailed++;
                errors.push({ imei: 'missing', station, error: 'IMEI not found' });
                continue;
              }

              // Step 2.2.1: Pull enhanced device info
              let enhancedData = null;
              try {
                enhancedData = await Promise.race([
                  this.phonecheckService.getDeviceDetailsEnhanced(imei, false),
                  new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Device details timeout')), 10000)
                  )
                ]);
              } catch (detailError) {
                logger.warn('Failed to get enhanced device details, using basic data', {
                  executionId: executionId.toString(),
                  imei,
                  station,
                  error: detailError instanceof Error ? detailError.message : String(detailError)
                });
                // Continue with basic device data
                enhancedData = device;
              }

              // Step 2.2.2: Push to DB using existing bulk-add logic
              // We'll use the existing inventory service to add the device
              await this.processAndAddDevice(enhancedData || device, params.location, station);

              totalDevicesProcessed++;
              totalDevicesAdded++;

            } catch (deviceError) {
              totalDevicesProcessed++;
              totalDevicesFailed++;
              const errorMsg = deviceError instanceof Error ? deviceError.message : String(deviceError);
              errors.push({
                imei: device['IMEI'] || device['imei'] || 'unknown',
                station,
                error: errorMsg
              });
              logger.error('Failed to process device', {
                executionId: executionId.toString(),
                station,
                error: errorMsg
              });
            }
          }

        } catch (stationError) {
          logger.error(`Failed to process station ${station}`, {
            executionId: executionId.toString(),
            station,
            error: stationError instanceof Error ? stationError.message : String(stationError)
          });
          errors.push({
            station,
            error: stationError instanceof Error ? stationError.message : String(stationError)
          });
        }
      }

      const durationMs = Date.now() - startTime;
      const success = totalDevicesFailed === 0;

      // Step 3: Update execution record
      await prisma.cronJobExecution.update({
        where: { id: executionId },
        data: {
          status: success ? 'completed' : 'failed',
          completedAt: new Date(),
          durationMs,
          devicesFound: totalDevicesFound,
          devicesProcessed: totalDevicesProcessed,
          devicesAdded: totalDevicesAdded,
          devicesFailed: totalDevicesFailed,
          errorMessage: errors.length > 0 ? `${errors.length} devices failed` : null,
          errorDetails: errors.length > 0 ? ({ errors: errors.slice(0, 100) } as any) : null // Limit to first 100 errors
        }
      });

      logger.info('✅ Workflow execution completed', {
        executionId: executionId.toString(),
        success,
        devicesFound: totalDevicesFound,
        devicesProcessed: totalDevicesProcessed,
        devicesAdded: totalDevicesAdded,
        devicesFailed: totalDevicesFailed,
        durationMs
      });

      return {
        executionId,
        success,
        status: success ? 'completed' : 'failed',
        devicesFound: totalDevicesFound,
        devicesProcessed: totalDevicesProcessed,
        devicesAdded: totalDevicesAdded,
        devicesFailed: totalDevicesFailed,
        durationMs,
        errorMessage: errors.length > 0 ? `${errors.length} devices failed` : undefined,
        errorDetails: errors.length > 0 ? { errors: errors.slice(0, 100) } : undefined
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      logger.error('❌ Workflow execution failed', {
        executionId: executionId?.toString(),
        error: errorMessage,
        durationMs
      });

      // Update execution record if it was created
      if (executionId) {
        try {
          await prisma.cronJobExecution.update({
            where: { id: executionId },
            data: {
              status: 'failed',
              completedAt: new Date(),
              durationMs,
              errorMessage,
              errorDetails: { error: errorMessage, stack: error instanceof Error ? error.stack : undefined }
            }
          });
        } catch (updateError) {
          logger.error('Failed to update execution record', { error: updateError });
        }
      }

      throw error;
    }
  }

  /**
   * Process and add a single device to the database
   * This wraps the existing bulk-add logic
   */
  private async processAndAddDevice(deviceData: any, location: string, station: string): Promise<void> {
    try {
      const imei = deviceData['IMEI'] || deviceData['imei'];
      if (!imei) {
        throw new Error('IMEI not found in device data');
      }

      // Extract device information
      const brand = deviceData['Brand'] || deviceData['brand'] || null;
      const model = deviceData['Model'] || deviceData['model'] || null;
      const capacity = deviceData['Capacity'] || deviceData['capacity'] || null;
      const color = deviceData['Color'] || deviceData['color'] || null;
      const carrier = deviceData['Carrier'] || deviceData['carrier'] || null;
      const working = deviceData['Working'] || deviceData['working'] || deviceData['WorkingStatus'] || 'PENDING';
      const batteryHealth = deviceData['BatteryHealth'] || deviceData['batteryHealth'] || null;

      // Create or update Product
      await prisma.product.upsert({
        where: { imei },
        create: {
          imei,
          sku: deviceData['SKU'] || deviceData['sku'] || null,
          brand,
          dateIn: new Date()
        },
        update: {
          sku: deviceData['SKU'] || deviceData['sku'] || null,
          brand,
          updatedAt: new Date()
        }
      });

      // Create or update Item
      await prisma.item.upsert({
        where: { imei },
        create: {
          imei,
          model,
          capacity,
          color,
          carrier,
          working: working.toString().toUpperCase(),
          location,
          batteryHealth: batteryHealth ? batteryHealth.toString() : null
        },
        update: {
          model,
          capacity,
          color,
          carrier,
          working: working.toString().toUpperCase(),
          location,
          batteryHealth: batteryHealth ? batteryHealth.toString() : null,
          updatedAt: new Date()
        }
      });

      // Create or update DeviceTest if test data exists
      if (deviceData['Defects'] || deviceData['Notes'] || deviceData['Custom1']) {
        await prisma.deviceTest.upsert({
          where: { imei },
          create: {
            imei,
            working: working.toString().toUpperCase(),
            defects: deviceData['Defects'] || deviceData['defects'] || null,
            notes: deviceData['Notes'] || deviceData['notes'] || null,
            custom1: deviceData['Custom1'] || deviceData['custom1'] || null,
            test_date: new Date()
          },
          update: {
            working: working.toString().toUpperCase(),
            defects: deviceData['Defects'] || deviceData['defects'] || null,
            notes: deviceData['Notes'] || deviceData['notes'] || null,
            custom1: deviceData['Custom1'] || deviceData['custom1'] || null
          }
        });
      }

    } catch (error) {
      logger.error('Failed to process and add device', {
        imei: deviceData['IMEI'] || deviceData['imei'],
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get execution history
   */
  async getExecutionHistory(limit: number = 50, offset: number = 0) {
    return await prisma.cronJobExecution.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
  }

  /**
   * Get execution by ID
   */
  async getExecutionById(id: bigint) {
    return await prisma.cronJobExecution.findUnique({
      where: { id }
    });
  }

  /**
   * Get execution statistics
   */
  async getExecutionStats() {
    const [total, completed, failed, running, pending] = await Promise.all([
      prisma.cronJobExecution.count(),
      prisma.cronJobExecution.count({ where: { status: 'completed' } }),
      prisma.cronJobExecution.count({ where: { status: 'failed' } }),
      prisma.cronJobExecution.count({ where: { status: 'running' } }),
      prisma.cronJobExecution.count({ where: { status: 'pending' } })
    ]);

    const recentExecutions = await prisma.cronJobExecution.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        devicesFound: true,
        devicesAdded: true,
        devicesFailed: true,
        durationMs: true,
        status: true
      }
    });

    const avgDevicesFound = recentExecutions.length > 0
      ? recentExecutions.reduce((sum, e) => sum + e.devicesFound, 0) / recentExecutions.length
      : 0;

    const avgDevicesAdded = recentExecutions.length > 0
      ? recentExecutions.reduce((sum, e) => sum + e.devicesAdded, 0) / recentExecutions.length
      : 0;

    const avgDurationMs = recentExecutions.length > 0
      ? recentExecutions.reduce((sum, e) => sum + (e.durationMs || 0), 0) / recentExecutions.length
      : 0;

    return {
      total,
      completed,
      failed,
      running,
      pending,
      averages: {
        devicesFound: Math.round(avgDevicesFound),
        devicesAdded: Math.round(avgDevicesAdded),
        durationMs: Math.round(avgDurationMs)
      }
    };
  }
}

