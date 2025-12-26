import { PhonecheckService } from './phonecheck.service';
import { logger } from '../utils/logger';
import prisma from '../prisma/client';

/**
 * Retry wrapper for operations that might fail due to transient errors
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000,
  operationName = 'Operation'
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isRetryable = 
        error instanceof Error && (
          error.message.includes('timeout') ||
          error.message.includes('connection') ||
          error.message.includes('ECONNRESET') ||
          error.message.includes('ETIMEDOUT') ||
          error.message.includes('deadlock') ||
          error.message.includes('Connection pool')
        );
      
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      
      const backoffDelay = delay * Math.pow(2, attempt - 1);
      logger.warn(`${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${backoffDelay}ms`, {
        error: lastError.message,
        attempt
      });
      
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}

export interface BulkAddWorkflowParams {
  stations: string[];
  dateFrom: string; // ISO date string
  dateTo: string; // ISO date string
  location: string;
  triggerSource?: string; // 'vercel-cron', 'manual', 'api', 'scheduled-cron'
  scheduleId?: bigint; // ID of the schedule that triggered this execution
  batchSize?: number; // Number of devices to process per batch (default: 50)
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
      
      // Track execution start time for timeout detection
      const MAX_EXECUTION_TIME = 4 * 60 * 60 * 1000; // 4 hours max
      const PROGRESS_UPDATE_INTERVAL = 10; // Update progress every 10 batches
      
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
      let totalDevicesAdded = 0; // Only count NEW IMEIs (not existing ones that are updated)
      let totalDevicesUpdated = 0; // Track existing devices that were updated
      let totalDevicesFailed = 0;
      const errors: any[] = [];
      const processedDevices: any[] = []; // Track successfully added devices
      const batchStats: any[] = []; // Track batch-level statistics

      // Batch size configuration (default: 50, can be overridden via params)
      const BATCH_SIZE = params.batchSize || parseInt(process.env['WORKFLOW_BATCH_SIZE'] || '50', 10);
      logger.info(`📦 Batch processing enabled: ${BATCH_SIZE} devices per batch`, {
        executionId: executionId.toString(),
        batchSize: BATCH_SIZE
      });

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

          // Step 2.2: Split devices into batches for isolated error handling
          const batches: any[][] = [];
          for (let i = 0; i < devices.length; i += BATCH_SIZE) {
            batches.push(devices.slice(i, i + BATCH_SIZE));
          }

          logger.info(`🔄 Processing ${devices.length} devices in ${batches.length} batches (${BATCH_SIZE} per batch)`, {
            executionId: executionId.toString(),
            station,
            totalDevices: devices.length,
            batchCount: batches.length,
            batchSize: BATCH_SIZE
          });

          // Step 2.3: Process each batch independently
          for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            if (!batch || batch.length === 0) {
              continue; // Skip empty batches
            }
            
            const batchStartTime = Date.now();
            let batchProcessed = 0;
            let batchAdded = 0;
            let batchUpdated = 0;
            let batchFailed = 0;
            const batchErrors: any[] = [];
            const batchProcessedDevices: any[] = [];

            logger.info(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} devices)`, {
              executionId: executionId.toString(),
              station,
              batchIndex: batchIndex + 1,
              batchSize: batch.length
            });

            try {
              // Process each device in the batch
              for (const device of batch) {
                try {
                  const imei = device['IMEI'] || device['imei'];
                  if (!imei) {
                    batchProcessed++;
                    batchFailed++;
                    totalDevicesProcessed++;
                    totalDevicesFailed++;
                    batchErrors.push({ imei: 'missing', station, error: 'IMEI not found' });
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

                  // Step 2.2.2: Prepare device data for database insertion
                  // getDeviceDetailsEnhanced returns nested structure { abstracted, raw, metadata }
                  // We need to flatten it and map fields correctly
                  let deviceDataForDb = device; // Default to basic device data
                  
                  if (enhancedData) {
                    // If enhancedData has abstracted property, use that (it's the processed data)
                    if (enhancedData.abstracted) {
                      const abstracted = enhancedData.abstracted;
                      // Map abstracted fields to database expected fields
                      // abstractDeviceData returns lowercase fields, but also needs capacity mapping
                      deviceDataForDb = {
                        IMEI: abstracted.imei || enhancedData.imei || device['IMEI'] || device['imei'],
                        Brand: abstracted.brand || abstracted.Brand || device['Brand'] || device['brand'],
                        Model: abstracted.model || abstracted.Model || device['Model'] || device['model'],
                        Capacity: abstracted.capacity || abstracted.Capacity || abstracted.storage || abstracted.Storage || device['Capacity'] || device['capacity'],
                        Color: abstracted.color || abstracted.Color || device['Color'] || device['color'],
                        Carrier: abstracted.carrier || abstracted.Carrier || device['Carrier'] || device['carrier'],
                        Working: abstracted.working || abstracted.Working || device['Working'] || device['working'],
                        WorkingStatus: abstracted.working || abstracted.Working || device['WorkingStatus'] || device['Working'] || device['working'],
                        BatteryHealth: abstracted.batteryHealth || abstracted.BatteryHealth || device['BatteryHealth'] || device['batteryHealth'],
                        Serial: abstracted.serialNumber || abstracted.Serial || abstracted.serial || device['Serial'] || device['serial'],
                        SKU: device['SKU'] || device['sku'],
                        ModelNumber: abstracted.modelNumber || abstracted.ModelNumber || abstracted.modelNo || device['Model#'] || device['modelNo'],
                        TesterName: abstracted.testerName || abstracted.TesterName || device['TesterName'] || device['testerName'] || device['Tester'] || device['tester'],
                        Defects: abstracted.failed || abstracted.defects || device['Defects'] || device['defects'],
                        Notes: abstracted.notes || abstracted.Notes || device['Notes'] || device['notes'],
                        Custom1: abstracted.repairNotes || abstracted.Custom1 || device['Custom1'] || device['custom1'],
                        // Preserve raw data if available for debugging
                        ...(enhancedData.raw && { _raw: enhancedData.raw })
                      };
                    } else if (enhancedData.imei) {
                      // If enhancedData is already flat (shouldn't happen but handle it)
                      deviceDataForDb = enhancedData;
                    }
                  }

                  // Step 2.2.3: Check if IMEI already exists in database (with retry)
                  const existingItem = await withRetry(
                    () => prisma.item.findUnique({
                      where: { imei },
                      select: { imei: true }
                    }),
                    2,
                    500,
                    'IMEI existence check'
                  );
                  
                  const isNewDevice = !existingItem;

                  // Step 2.2.4: Push to DB using existing bulk-add logic
                  // Log data mapping for debugging data integrity issues
                  logger.debug('Processing device data for database', {
                    executionId: executionId.toString(),
                    imei,
                    station,
                    isNewDevice,
                    hasAbstractedData: !!(enhancedData?.abstracted),
                    hasRawData: !!(enhancedData?.raw),
                    fieldsMapped: {
                      imei: !!deviceDataForDb['IMEI'],
                      brand: !!deviceDataForDb['Brand'],
                      model: !!deviceDataForDb['Model'],
                      capacity: !!deviceDataForDb['Capacity'],
                      color: !!deviceDataForDb['Color'],
                      carrier: !!deviceDataForDb['Carrier'],
                      working: !!deviceDataForDb['Working'],
                      modelNumber: !!deviceDataForDb['ModelNumber']
                    }
                  });
                  
                  await this.processAndAddDevice(deviceDataForDb, params.location, station);

                  batchProcessed++;
                  totalDevicesProcessed++;
                  
                  // Only count as "added" if it's a NEW IMEI, otherwise count as updated
                  if (isNewDevice) {
                    batchAdded++;
                    totalDevicesAdded++;
                  } else {
                    batchUpdated++;
                    totalDevicesUpdated++;
                  }
                  
                  // Track device details for metadata (use deviceDataForDb which has the mapped fields)
                  const deviceRecord = {
                    imei: imei,
                    station: station,
                    isNew: isNewDevice, // Track whether this was a new device or update
                    model: deviceDataForDb['Model'] || deviceDataForDb['model'] || 'N/A',
                    brand: deviceDataForDb['Brand'] || deviceDataForDb['brand'] || 'N/A',
                    capacity: deviceDataForDb['Capacity'] || deviceDataForDb['capacity'] || 'N/A',
                    color: deviceDataForDb['Color'] || deviceDataForDb['color'] || 'N/A',
                    carrier: deviceDataForDb['Carrier'] || deviceDataForDb['carrier'] || 'N/A',
                    processedAt: new Date().toISOString()
                  };
                  batchProcessedDevices.push(deviceRecord);
                  processedDevices.push(deviceRecord);

                } catch (deviceError) {
                  batchProcessed++;
                  batchFailed++;
                  totalDevicesProcessed++;
                  totalDevicesFailed++;
                  const errorMsg = deviceError instanceof Error ? deviceError.message : String(deviceError);
                  const errorRecord = {
                    imei: device['IMEI'] || device['imei'] || 'unknown',
                    station,
                    error: errorMsg
                  };
                  batchErrors.push(errorRecord);
                  errors.push(errorRecord);
                  logger.error('Failed to process device in batch', {
                    executionId: executionId.toString(),
                    station,
                    batchIndex: batchIndex + 1,
                    error: errorMsg
                  });
                }
              } // End of device loop within batch
            } catch (batchError) {
              // If entire batch fails (e.g., database connection issue), log and continue
              const batchErrorMsg = batchError instanceof Error ? batchError.message : String(batchError);
              logger.error(`❌ Entire batch ${batchIndex + 1}/${batches.length} failed`, {
                executionId: executionId.toString(),
                station,
                batchIndex: batchIndex + 1,
                error: batchErrorMsg
              });
              
              // Mark all devices in this batch as failed
              for (const device of batch) {
                if (batchProcessed < batch.length) {
                  batchProcessed++;
                  batchFailed++;
                  totalDevicesProcessed++;
                  totalDevicesFailed++;
                  const errorRecord = {
                    imei: device['IMEI'] || device['imei'] || 'unknown',
                    station,
                    error: `Batch processing error: ${batchErrorMsg}`
                  };
                  batchErrors.push(errorRecord);
                  errors.push(errorRecord);
                }
              }
            }

            // Batch completed - log batch statistics (always record, even if batch failed)
            const batchDuration = Date.now() - batchStartTime;
            const batchSuccess = batchFailed === 0;
            
            batchStats.push({
              batchIndex: batchIndex + 1,
              station,
              batchSize: batch.length,
              processed: batchProcessed,
              added: batchAdded,
              updated: batchUpdated,
              failed: batchFailed,
              durationMs: batchDuration,
              success: batchSuccess,
              errorCount: batchErrors.length
            });

            logger.info(`✅ Batch ${batchIndex + 1}/${batches.length} completed`, {
              executionId: executionId.toString(),
              station,
              batchIndex: batchIndex + 1,
              processed: batchProcessed,
              added: batchAdded,
              updated: batchUpdated,
              failed: batchFailed,
              durationMs: batchDuration,
              success: batchSuccess
            });

            // If batch failed, log but continue to next batch
            if (!batchSuccess) {
              logger.warn(`⚠️ Batch ${batchIndex + 1}/${batches.length} had ${batchFailed} failures, continuing with next batch`, {
                executionId: executionId.toString(),
                station,
                batchIndex: batchIndex + 1,
                failedCount: batchFailed,
                errors: batchErrors.slice(0, 5) // Log first 5 errors
              });
            }

            // Periodic progress update (every N batches) to prevent data loss
            if (executionId !== null && (batchIndex + 1) % PROGRESS_UPDATE_INTERVAL === 0) {
              try {
                await withRetry(
                  () => prisma.cronJobExecution.update({
                    where: { id: executionId! },
                    data: {
                      devicesProcessed: totalDevicesProcessed,
                      devicesAdded: totalDevicesAdded,
                      devicesFailed: totalDevicesFailed,
                      metadata: {
                        devices: processedDevices.slice(0, 1000),
                        totalDevices: processedDevices.length,
                        devicesUpdated: totalDevicesUpdated,
                        batchStats: batchStats,
                        batchSize: BATCH_SIZE,
                        totalBatches: batchStats.length,
                        lastProgressUpdate: new Date().toISOString(),
                        progressPercent: Math.round((totalDevicesProcessed / totalDevicesFound) * 100)
                      } as any
                    }
                  }),
                  3,
                  1000,
                  'Progress update'
                );
                logger.debug(`📊 Progress updated: ${totalDevicesProcessed}/${totalDevicesFound} devices processed`, {
                  executionId: executionId.toString(),
                  batchIndex: batchIndex + 1
                });
              } catch (updateError) {
                logger.error('Failed to update progress (non-critical)', {
                  executionId: executionId.toString(),
                  error: updateError instanceof Error ? updateError.message : String(updateError)
                });
                // Don't throw - continue processing even if progress update fails
              }
            }

            // Check for execution timeout
            const elapsedTime = Date.now() - startTime;
            if (elapsedTime > MAX_EXECUTION_TIME) {
              logger.warn('⚠️ Execution approaching maximum time limit, saving checkpoint', {
                executionId: executionId.toString(),
                elapsedTime,
                maxTime: MAX_EXECUTION_TIME
              });
              // Save checkpoint and continue (don't stop, just warn)
            }

            // Small delay between batches to prevent overwhelming the system
            if (batchIndex < batches.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between batches
            }
          } // End of batch processing loop

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

      // Step 3: Update execution record with retry logic
      if (executionId === null) {
        throw new Error('Execution ID is null, cannot update execution record');
      }
      
      const finalExecutionId = executionId; // TypeScript narrowing
      await withRetry(
        () => prisma.cronJobExecution.update({
          where: { id: finalExecutionId },
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
              totalDevices: processedDevices.length,
              devicesUpdated: totalDevicesUpdated, // Track updated devices separately in metadata
              batchStats: batchStats, // Track batch-level statistics
              batchSize: BATCH_SIZE, // Store batch size used
              totalBatches: batchStats.length // Total number of batches processed
            } as any
          }
        }),
        3,
        2000,
        'Final execution update'
      );

      logger.info('✅ Workflow execution completed', {
        executionId: executionId.toString(),
        success,
        devicesFound: totalDevicesFound,
        devicesProcessed: totalDevicesProcessed,
        devicesAdded: totalDevicesAdded, // NEW IMEIs only
        devicesUpdated: totalDevicesUpdated, // Existing IMEIs that were updated
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

      // Update execution record if it was created (with retry)
      if (executionId !== null) {
        const errorExecutionId = executionId; // TypeScript narrowing
        try {
          await withRetry(
            () => prisma.cronJobExecution.update({
              where: { id: errorExecutionId },
              data: {
                status: 'failed',
                completedAt: new Date(),
                durationMs,
                errorMessage,
                errorDetails: { error: errorMessage, stack: error instanceof Error ? error.stack : undefined }
              }
            }),
            3,
            1000,
            'Error execution update'
          );
        } catch (updateError) {
          logger.error('Failed to update execution record after retries', { 
            executionId: executionId.toString(),
            error: updateError instanceof Error ? updateError.message : String(updateError)
          });
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

      // Extract device information with length validation
      // Truncate values to match database column constraints to prevent "value too long" errors
      const brand = deviceData['Brand'] || deviceData['brand'] || null;
      const model = (deviceData['Model'] || deviceData['model'] || null)?.toString().substring(0, 100) || null; // max 100 chars
      const modelNumber = (deviceData['ModelNumber'] || deviceData['modelNumber'] || deviceData['Model#'] || deviceData['modelNo'] || null)?.toString().substring(0, 100) || null; // max 100 chars
      const capacity = (deviceData['Capacity'] || deviceData['capacity'] || null)?.toString().substring(0, 50) || null; // max 50 chars
      const color = (deviceData['Color'] || deviceData['color'] || null)?.toString().substring(0, 50) || null; // max 50 chars
      const carrier = (deviceData['Carrier'] || deviceData['carrier'] || null)?.toString().substring(0, 50) || null; // max 50 chars
      const working = (deviceData['Working'] || deviceData['working'] || deviceData['WorkingStatus'] || 'PENDING').toString().substring(0, 20).toUpperCase(); // max 20 chars
      const batteryHealth = (deviceData['BatteryHealth'] || deviceData['batteryHealth'] || null)?.toString().substring(0, 50) || null; // max 50 chars

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

      // Truncate location to match database constraint (max 100 chars)
      const truncatedLocation = location?.toString().substring(0, 100) || null;

      // Create or update Item
      await prisma.item.upsert({
        where: { imei },
        create: {
          imei,
          model,
          modelNumber,
          capacity,
          color,
          carrier,
          working,
          location: truncatedLocation,
          batteryHealth
        },
        update: {
          model,
          modelNumber,
          capacity,
          color,
          carrier,
          working,
          location: truncatedLocation,
          batteryHealth,
          updatedAt: new Date()
        }
      });

      // Create or update DeviceTest if test data exists
      // Include tester name from abstracted data if available
      const testerName = deviceData['TesterName'] || deviceData['testerName'] || deviceData['Tester'] || deviceData['tester'] || null;
      if (deviceData['Defects'] || deviceData['Notes'] || deviceData['Custom1'] || testerName || working !== 'PENDING') {
        await prisma.deviceTest.upsert({
          where: { imei },
          create: {
            imei,
            working: working.toString().toUpperCase(),
            defects: deviceData['Defects'] || deviceData['defects'] || null,
            notes: deviceData['Notes'] || deviceData['notes'] || null,
            custom1: deviceData['Custom1'] || deviceData['custom1'] || null,
            tester: testerName,
            test_date: new Date()
          },
          update: {
            working: working.toString().toUpperCase(),
            defects: deviceData['Defects'] || deviceData['defects'] || null,
            notes: deviceData['Notes'] || deviceData['notes'] || null,
            custom1: deviceData['Custom1'] || deviceData['custom1'] || null,
            tester: testerName
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

