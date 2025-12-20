import { PhonecheckService } from './phonecheck.service';
import { logger } from '../utils/logger';
import prisma from '../prisma/client';

export interface BulkAddWorkflowParams {
  stations: string[];
  dateFrom: string; // ISO date string
  dateTo: string; // ISO date string
  location: string;
  triggerSource?: string; // 'vercel-cron', 'manual', 'api', 'scheduled-cron'
  scheduleId?: bigint; // ID of the schedule that triggered this execution
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
          scheduleId: params.scheduleId,
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
        scheduleId: params.scheduleId ? params.scheduleId.toString() : null, // Log schedule ID if present
        triggerSource: params.triggerSource || 'api',
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
      const processedDevices: any[] = []; // Track successfully added devices

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
              
              // Track device details for metadata
              processedDevices.push({
                imei: imei,
                station: station,
                model: enhancedData?.['Model'] || enhancedData?.['model'] || device?.['Model'] || device?.['model'] || 'N/A',
                brand: enhancedData?.['Brand'] || enhancedData?.['brand'] || device?.['Brand'] || device?.['brand'] || 'N/A',
                capacity: enhancedData?.['Capacity'] || enhancedData?.['capacity'] || device?.['Capacity'] || device?.['capacity'] || 'N/A',
                color: enhancedData?.['Color'] || enhancedData?.['color'] || device?.['Color'] || device?.['color'] || 'N/A',
                carrier: enhancedData?.['Carrier'] || enhancedData?.['carrier'] || device?.['Carrier'] || device?.['carrier'] || 'N/A',
                processedAt: new Date().toISOString()
              });

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
          errorDetails: errors.length > 0 ? ({ errors: errors.slice(0, 100) } as any) : null, // Limit to first 100 errors
          metadata: {
            devices: processedDevices.slice(0, 1000), // Store up to 1000 devices in metadata
            totalDevices: processedDevices.length
          } as any
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
   * Get execution history with optional date filtering
   */
  async getExecutionHistory(limit: number = 50, offset: number = 0, dateFrom?: Date, dateTo?: Date) {
    try {
      console.log(`[WorkflowEngine] Getting execution history: limit=${limit}, offset=${offset}`, {
        dateFrom: dateFrom?.toISOString(),
        dateTo: dateTo?.toISOString()
      });
      
      const whereClause: any = {};
      if (dateFrom || dateTo) {
        whereClause.createdAt = {};
        if (dateFrom) whereClause.createdAt.gte = dateFrom;
        if (dateTo) whereClause.createdAt.lte = dateTo;
      }
      
      const executions = await prisma.cronJobExecution.findMany({
        where: whereClause,
        include: {
          schedule: {
            select: {
              id: true,
              name: true,
              scheduleTime: true,
              frequency: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      });
      console.log(`[WorkflowEngine] Found ${executions.length} executions`);
      return executions;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('[WorkflowEngine] Error getting execution history:', {
        message: errorMessage,
        stack: errorStack,
        limit,
        offset
      });
      logger.error('Error getting execution history', { error: errorMessage, stack: errorStack });
      // Return empty array if database connection fails
      return [];
    }
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
   * Get execution statistics with totals by period (daily, weekly, monthly)
   */
  async getExecutionStats() {
    try {
      console.log('[WorkflowEngine] Getting execution stats...');
      const [total, completed, failed, running, pending] = await Promise.all([
        prisma.cronJobExecution.count(),
        prisma.cronJobExecution.count({ where: { status: 'completed' } }),
        prisma.cronJobExecution.count({ where: { status: 'failed' } }),
        prisma.cronJobExecution.count({ where: { status: 'running' } }),
        prisma.cronJobExecution.count({ where: { status: 'pending' } })
      ]);

      console.log('[WorkflowEngine] Counts:', { total, completed, failed, running, pending });

      // Calculate date ranges
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get executions for each period
      const [dailyExecutions, weeklyExecutions, monthlyExecutions] = await Promise.all([
        prisma.cronJobExecution.findMany({
          where: {
            createdAt: { gte: oneDayAgo },
            status: 'completed'
          },
          select: {
            devicesFound: true,
            devicesAdded: true,
            durationMs: true
          }
        }),
        prisma.cronJobExecution.findMany({
          where: {
            createdAt: { gte: oneWeekAgo },
            status: 'completed'
          },
          select: {
            devicesFound: true,
            devicesAdded: true,
            durationMs: true
          }
        }),
        prisma.cronJobExecution.findMany({
          where: {
            createdAt: { gte: oneMonthAgo },
            status: 'completed'
          },
          select: {
            devicesFound: true,
            devicesAdded: true,
            durationMs: true
          }
        })
      ]);

      // Calculate totals for each period
      const calculateTotals = (executions: Array<{ devicesFound: number; devicesAdded: number; durationMs: number | null }>) => {
        return {
          devicesFound: executions.reduce((sum, e) => sum + e.devicesFound, 0),
          devicesAdded: executions.reduce((sum, e) => sum + e.devicesAdded, 0),
          durationMs: executions.reduce((sum, e) => sum + (e.durationMs || 0), 0)
        };
      };

      const dailyTotals = calculateTotals(dailyExecutions);
      const weeklyTotals = calculateTotals(weeklyExecutions);
      const monthlyTotals = calculateTotals(monthlyExecutions);

      const stats = {
        total,
        completed,
        failed,
        running,
        pending,
        totals: {
          daily: dailyTotals,
          weekly: weeklyTotals,
          monthly: monthlyTotals
        },
        // Keep averages for backward compatibility (deprecated)
        averages: {
          devicesFound: Math.round(weeklyTotals.devicesFound / Math.max(weeklyExecutions.length, 1)),
          devicesAdded: Math.round(weeklyTotals.devicesAdded / Math.max(weeklyExecutions.length, 1)),
          durationMs: Math.round(weeklyTotals.durationMs / Math.max(weeklyExecutions.length, 1))
        }
      };

      console.log('[WorkflowEngine] Stats calculated:', stats);
      return stats;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('[WorkflowEngine] Error getting execution stats:', {
        message: errorMessage,
        stack: errorStack,
        error
      });
      logger.error('Error getting execution stats', { error: errorMessage, stack: errorStack });
      // Return empty stats if database connection fails
      return {
        total: 0,
        completed: 0,
        failed: 0,
        running: 0,
        pending: 0,
        averages: {
          devicesFound: 0,
          devicesAdded: 0,
          durationMs: 0
        }
      };
    }
  }

  /**
   * Get device statistics by station/worker
   * Aggregates device counts from all executions grouped by station
   */
  async getDeviceStatsByStation(dateFrom?: Date, dateTo?: Date) {
    console.log('[WorkflowEngine] Getting device stats by station...', { dateFrom, dateTo });
    try {
      // Build date filter
      const whereClause: any = {
        status: 'completed' // Only count completed executions
      };

      if (dateFrom || dateTo) {
        whereClause.createdAt = {};
        if (dateFrom) {
          whereClause.createdAt.gte = dateFrom;
        }
        if (dateTo) {
          whereClause.createdAt.lte = dateTo;
        }
      }

      // Get all completed executions with metadata
      const executions = await prisma.cronJobExecution.findMany({
        where: whereClause,
        select: {
          id: true,
          stations: true,
          devicesAdded: true,
          devicesFound: true,
          devicesProcessed: true,
          devicesFailed: true,
          metadata: true,
          createdAt: true,
          completedAt: true
        },
        orderBy: { createdAt: 'desc' }
      });

      console.log(`[WorkflowEngine] Found ${executions.length} completed executions`);

      // Aggregate by station
      const stationStats: Record<string, {
        station: string;
        totalDevicesAdded: number;
        totalDevicesFound: number;
        totalDevicesProcessed: number;
        totalDevicesFailed: number;
        executionCount: number;
        executions: Array<{
          executionId: string;
          devicesAdded: number;
          devicesFound: number;
          createdAt: string;
          completedAt: string | null;
        }>;
      }> = {};

      for (const execution of executions) {
        const devices = (execution.metadata as any)?.devices || [];
        
        // Group devices by station from metadata
        const devicesByStation: Record<string, any[]> = {};
        for (const device of devices) {
          const station = device.station || 'unknown';
          if (!devicesByStation[station]) {
            devicesByStation[station] = [];
          }
          devicesByStation[station].push(device);
        }

        // Update stats for each station in this execution
        for (const station of execution.stations) {
          if (!stationStats[station]) {
            stationStats[station] = {
              station,
              totalDevicesAdded: 0,
              totalDevicesFound: 0,
              totalDevicesProcessed: 0,
              totalDevicesFailed: 0,
              executionCount: 0,
              executions: []
            };
          }

          // Count devices for this specific station from metadata
          const stationDeviceCount = devicesByStation[station]?.length || 0;
          
          // If no devices in metadata, estimate based on execution stats and number of stations
          // This handles older executions that might not have metadata
          const estimatedDevicesPerStation = stationDeviceCount > 0 
            ? stationDeviceCount 
            : Math.floor(execution.devicesAdded / execution.stations.length);

          stationStats[station].totalDevicesAdded += stationDeviceCount > 0 ? stationDeviceCount : estimatedDevicesPerStation;
          stationStats[station].totalDevicesFound += Math.floor(execution.devicesFound / execution.stations.length);
          stationStats[station].totalDevicesProcessed += Math.floor(execution.devicesProcessed / execution.stations.length);
          stationStats[station].totalDevicesFailed += Math.floor(execution.devicesFailed / execution.stations.length);
          stationStats[station].executionCount += 1;
          stationStats[station].executions.push({
            executionId: execution.id.toString(),
            devicesAdded: stationDeviceCount > 0 ? stationDeviceCount : estimatedDevicesPerStation,
            devicesFound: Math.floor(execution.devicesFound / execution.stations.length),
            createdAt: execution.createdAt.toISOString(),
            completedAt: execution.completedAt?.toISOString() || null
          });
        }
      }

      // Convert to array and sort by total devices added
      const statsArray = Object.values(stationStats).sort((a, b) => 
        b.totalDevicesAdded - a.totalDevicesAdded
      );

      console.log(`[WorkflowEngine] Calculated stats for ${statsArray.length} stations`);
      return {
        stations: statsArray,
        total: statsArray.reduce((sum, s) => sum + s.totalDevicesAdded, 0),
        dateRange: {
          from: dateFrom?.toISOString() || null,
          to: dateTo?.toISOString() || null
        }
      };
    } catch (error: any) {
      logger.error('Error getting device stats by station', { 
        error: error.message, 
        stack: error.stack 
      });
      console.error('[WorkflowEngine] Error getting device stats by station:', {
        message: error.message,
        stack: error.stack
      });
      return {
        stations: [],
        total: 0,
        dateRange: {
          from: dateFrom?.toISOString() || null,
          to: dateTo?.toISOString() || null
        }
      };
    }
  }
}

