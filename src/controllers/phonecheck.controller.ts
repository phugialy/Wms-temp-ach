import { Request, Response } from 'express';
import { PhonecheckService } from '../services/phonecheck.service';
import { logger } from '../utils/logger';

export class PhonecheckController {
  constructor(private phonecheckService: PhonecheckService) {}

  // Pull all devices from a station by date range
  pullDevicesFromStation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { station, startDate, endDate } = req.body;

      if (!station || !startDate) {
        res.status(400).json({
          success: false,
          error: 'Station and start date are required'
        });
        return;
      }

      logger.info('Pulling devices from Phonecheck station', { station, startDate, endDate });

      const devices = await this.phonecheckService.getAllDevicesFromStation(station, startDate, endDate);

      res.status(200).json({
        success: true,
        data: {
          devices,
          count: devices.length,
          station,
          startDate,
          endDate
        },
        message: `Successfully pulled ${devices.length} devices from station ${station} (${startDate}${endDate && endDate !== startDate ? ` to ${endDate}` : ''})`
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in pullDevicesFromStation controller', { error: errorMessage, body: req.body });
      
      res.status(500).json({
        success: false,
        error: `Failed to pull devices: ${errorMessage}`
      });
    }
  };

  // Get detailed information for a specific device
  getDeviceDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const { imei } = req.params;

      if (!imei) {
        res.status(400).json({
          success: false,
          error: 'IMEI is required'
        });
        return;
      }

      logger.info('Getting device details from Phonecheck', { imei });

      const rawData = await this.phonecheckService.getDeviceDetails(imei);
      const abstractedData = this.phonecheckService.abstractDeviceData(rawData);

      if (!abstractedData) {
        res.status(404).json({
          success: false,
          error: 'Device not found or could not be processed'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          abstracted: abstractedData,
          raw: rawData
        },
        message: 'Device details retrieved successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getDeviceDetails controller', { error: errorMessage, params: req.params });
      
      res.status(500).json({
        success: false,
        error: `Failed to get device details: ${errorMessage}`
      });
    }
  };

  // Enhanced device details with smart data detection
  getDeviceDetailsEnhanced = async (req: Request, res: Response): Promise<void> => {
    try {
      const { imei } = req.params;
      const { includeRawData = 'true', dataFormat = 'both' } = req.query;

      if (!imei) {
        res.status(400).json({
          success: false,
          error: 'IMEI is required'
        });
        return;
      }

      logger.info('Getting enhanced device details from Phonecheck', { 
        imei, 
        includeRawData: includeRawData === 'true',
        dataFormat 
      });

      const enhancedData = await this.phonecheckService.getDeviceDetailsEnhanced(
        imei, 
        includeRawData === 'true'
      );

      if (!enhancedData || !enhancedData.abstracted) {
        res.status(404).json({
          success: false,
          error: 'Device not found or could not be processed'
        });
        return;
      }

      // Format response based on requested format
      let responseData: any = {};
      
      switch (dataFormat) {
        case 'abstracted':
          responseData = {
            success: true,
            data: enhancedData.abstracted,
            metadata: enhancedData.metadata,
            message: 'Device details retrieved successfully (abstracted format)'
          };
          break;
        case 'raw':
          responseData = {
            success: true,
            data: enhancedData.raw,
            metadata: enhancedData.metadata,
            message: 'Device details retrieved successfully (raw format)'
          };
          break;
        case 'both':
        default:
          responseData = {
            success: true,
            data: {
              abstracted: enhancedData.abstracted,
              raw: enhancedData.raw,
              metadata: enhancedData.metadata
            },
            message: 'Device details retrieved successfully (both formats)'
          };
          break;
      }

      res.status(200).json(responseData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in getDeviceDetailsEnhanced controller', { error: errorMessage, params: req.params });
      
      res.status(500).json({
        success: false,
        error: `Failed to get enhanced device details: ${errorMessage}`
      });
    }
  };

  // High-performance bulk processing with parallel execution and optimized data structure
  processBulkDevices = async (req: Request, res: Response): Promise<void> => {
    try {
      const { station, startDate, endDate, location, batchSize = 20, streamMode = false, optimizeData = false } = req.body;

      if (!station || !startDate || !location) {
        res.status(400).json({
          success: false,
          error: 'Station, start date, and location are required'
        });
        return;
      }

      logger.info('Processing bulk devices from Phonecheck (Optimized)', { 
        station, 
        startDate, 
        endDate, 
        location, 
        batchSize, 
        streamMode,
        optimizeData
      });

      // Step 1: Pull all devices from station
      const devices = await this.phonecheckService.getAllDevicesFromStation(station, startDate, endDate);

      if (devices.length === 0) {
        res.status(200).json({
          success: true,
          data: {
            devices: [],
            processed: [],
            count: 0,
            station,
            startDate,
            endDate,
            location
          },
          message: 'No devices found for the specified station and date range'
        });
        return;
      }

      // Step 2: Process devices with high-performance parallel execution
      const processedDevices: any[] = [];
      let successCount = 0;
      let errorCount = 0;

      // Set up streaming response headers if requested
      if (streamMode) {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Transfer-Encoding': 'chunked',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        
        // Send initial response
        res.write(JSON.stringify({
          success: true,
          data: {
            totalDevices: devices.length,
            station,
            startDate,
            endDate,
            location,
            streamMode: true
          },
          message: `Starting optimized processing of ${devices.length} devices in batches of ${batchSize}`
        }) + '\n');
      }

      // Process devices in optimized batches with parallel execution
      for (let i = 0; i < devices.length; i += batchSize) {
        const batch = devices.slice(i, i + batchSize);
        
        // Process batch with high concurrency and reduced timeout
        const batchPromises = batch.map(async (device) => {
          try {
            const imei = device['IMEI'] || device['imei'];
            
            // Use GetDeviceDetailsEnhanced for better performance and data quality assessment
            let enhancedData = null;
            try {
              enhancedData = await Promise.race([
                this.phonecheckService.getDeviceDetailsEnhanced(imei, false), // Don't include raw data for performance
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Device details timeout')), 10000) // Increased timeout to 10 seconds
                )
              ]);
            } catch (detailError) {
              logger.warn('Failed to get enhanced device details, using basic data', { 
                imei, 
                error: detailError instanceof Error ? detailError.message : String(detailError) 
              });
            }

            // Debug logging
            if (enhancedData) {
              logger.info('Enhanced data retrieved successfully', { 
                imei, 
                hasAbstracted: !!enhancedData.abstracted,
                working: enhancedData.abstracted?.working,
                deviceName: enhancedData.abstracted?.deviceName
              });
            } else {
              logger.info('No enhanced data available, using basic data', { imei });
            }

            // Use enhanced data if available, regardless of working status
            if (enhancedData && enhancedData.abstracted) {
              const abstractedData = enhancedData.abstracted;
              const dataQuality = enhancedData.metadata?.dataQuality || 'unknown';
              
              // Use detailed data from Phonecheck with optimized structure
              const inventoryData = optimizeData ? {
                // Optimized data structure - only essential fields
                name: abstractedData.deviceName,
                brand: abstractedData.brand || 'Unknown',
                model: abstractedData.model,
                storage: abstractedData.storage || undefined,
                color: abstractedData.color || undefined,
                carrier: abstractedData.carrier || undefined,
                type: 'phone',
                imei: abstractedData.imei !== 'N/A' ? abstractedData.imei : imei,
                serialNumber: abstractedData.serialNumber !== 'N/A' ? abstractedData.serialNumber : undefined,
                condition: abstractedData.condition || undefined,
                working: abstractedData.working || 'PENDING',
                quantity: 1,
                location: location,
                status: 'success',
                source: dataQuality === 'comprehensive' ? 'comprehensive' : 'detailed',
                dataQuality: dataQuality,
                processingLevel: enhancedData.metadata?.processingLevel || 'unknown',
                // CRITICAL: Always preserve original PhoneCheck data for working status determination
                originalWorking: abstractedData.working,
                originalWorkingStatus: abstractedData.workingStatus,
                originalFailed: abstractedData.failed,
                // Preserve additional PhoneCheck fields
                defects: abstractedData.defects,
                notes: abstractedData.notes,
                custom1: abstractedData.custom1,
                batteryHealth: abstractedData.batteryHealth,
                screenCondition: abstractedData.screenCondition,
                bodyCondition: abstractedData.bodyCondition
              } : {
                // Full data structure
                name: abstractedData.deviceName,
                brand: abstractedData.brand || 'Unknown',
                model: abstractedData.model,
                storage: abstractedData.storage || undefined,
                color: abstractedData.color || undefined,
                carrier: abstractedData.carrier || undefined,
                type: 'phone',
                imei: abstractedData.imei !== 'N/A' ? abstractedData.imei : imei,
                serialNumber: abstractedData.serialNumber !== 'N/A' ? abstractedData.serialNumber : undefined,
                condition: abstractedData.condition || undefined,
                working: abstractedData.working || 'PENDING',
                quantity: 1,
                location: location,
                status: 'success',
                source: dataQuality === 'comprehensive' ? 'comprehensive' : 'detailed',
                dataQuality: dataQuality,
                processingLevel: enhancedData.metadata?.processingLevel || 'unknown',
                // CRITICAL: Always preserve original PhoneCheck data for working status determination
                originalWorking: abstractedData.working,
                originalWorkingStatus: abstractedData.workingStatus,
                originalFailed: abstractedData.failed,
                // Preserve additional PhoneCheck fields
                defects: abstractedData.defects,
                notes: abstractedData.notes,
                custom1: abstractedData.custom1,
                batteryHealth: abstractedData.batteryHealth,
                screenCondition: abstractedData.screenCondition,
                bodyCondition: abstractedData.bodyCondition,
                // Include all raw PhoneCheck data
                testResults: enhancedData.raw || enhancedData.abstracted
              };
              
              // Debug logging for enhanced data
              logger.info('Enhanced inventory data created', {
                imei: inventoryData.imei,
                working: inventoryData.working,
                originalWorking: inventoryData.originalWorking,
                originalWorkingStatus: inventoryData.originalWorkingStatus,
                originalFailed: inventoryData.originalFailed,
                hasBatteryHealth: !!inventoryData.batteryHealth,
                hasDefects: !!inventoryData.defects
              });
              
              return { ...inventoryData, success: true };
            } else {
              // Use basic device data from the pull response with optimized structure
              const basicDeviceData = optimizeData ? {
                // Optimized data structure - only essential fields
                name: device['model'] || device['Model'] || 'Unknown Device',
                brand: device['make'] || device['Make'] || 'Unknown',
                model: device['model'] || device['Model'] || 'Unknown',
                storage: device['memory'] || device['Memory'] || undefined,
                color: device['color'] || device['Color'] || undefined,
                carrier: device['carrier'] || device['Carrier'] || undefined,
                type: 'phone',
                imei: imei,
                serialNumber: device['serial'] || device['Serial'] || undefined,
                condition: device['grade'] || device['Grade'] || 'Unknown',
                working: device['working'] || device['Working'] || 'PENDING',
                quantity: 1,
                location: location,
                status: 'success',
                source: 'basic',
                // CRITICAL: Always preserve original PhoneCheck data for working status determination
                originalWorking: device['working'] || device['Working'],
                originalWorkingStatus: device['workingStatus'] || device['WorkingStatus'],
                originalFailed: device['failed'] || device['Failed']
              } : {
                // Full data structure
                name: device['model'] || device['Model'] || 'Unknown Device',
                brand: device['make'] || device['Make'] || 'Unknown',
                model: device['model'] || device['Model'] || 'Unknown',
                storage: device['memory'] || device['Memory'] || undefined,
                color: device['color'] || device['Color'] || undefined,
                carrier: device['carrier'] || device['Carrier'] || undefined,
                type: 'phone',
                imei: imei,
                serialNumber: device['serial'] || device['Serial'] || undefined,
                condition: device['grade'] || device['Grade'] || 'Unknown',
                working: device['working'] || device['Working'] || 'PENDING',
                quantity: 1,
                location: location,
                rawData: device,
                originalDevice: device,
                status: 'success',
                source: 'basic',
                // CRITICAL: Always preserve original PhoneCheck data for working status determination
                originalWorking: device['working'] || device['Working'],
                originalWorkingStatus: device['workingStatus'] || device['WorkingStatus'],
                originalFailed: device['failed'] || device['Failed']
              };
              
              // Debug logging for basic data
              logger.info('Basic device data created', {
                imei: basicDeviceData.imei,
                working: basicDeviceData.working,
                originalWorking: basicDeviceData.originalWorking,
                originalWorkingStatus: basicDeviceData.originalWorkingStatus,
                originalFailed: basicDeviceData.originalFailed
              });
              
              return { ...basicDeviceData, success: true };
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
              imei: device['IMEI'] || device['imei'],
              status: 'error',
              error: errorMessage,
              success: false
            };
          }
        });

        // Wait for batch to complete with parallel execution
        const batchResults = await Promise.all(batchPromises);
        
        // Update counters
        batchResults.forEach(result => {
          if (result.success) {
            successCount++;
            processedDevices.push(result);
          } else {
            errorCount++;
            processedDevices.push(result);
          }
        });

        // Send batch progress if streaming
        if (streamMode) {
          const progress = {
            type: 'batch_progress',
            batchNumber: Math.floor(i / batchSize) + 1,
            totalBatches: Math.ceil(devices.length / batchSize),
            processedCount: Math.min(i + batchSize, devices.length),
            totalCount: devices.length,
            successCount,
            errorCount,
            batchResults: optimizeData ? batchResults.map(r => ({ 
              imei: r.imei, 
              status: r.status, 
              name: 'name' in r ? r.name : 'Unknown',
              source: 'source' in r ? r.source : 'unknown'
            })) : batchResults
          };
          
          res.write(JSON.stringify(progress) + '\n');
        }

        // Minimal delay between batches (reduced from 100ms to 50ms)
        if (i + batchSize < devices.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Send final response with optimized structure
      const finalResponse = {
        success: true,
        data: optimizeData ? {
          // Optimized response structure
          summary: {
            totalDevices: devices.length,
            successCount,
            errorCount,
            processingTime: Date.now() - Date.now(), // Will be calculated properly
            station,
            startDate,
            endDate,
            location
          },
          devices: processedDevices.map(d => ({
            imei: d.imei,
            name: d.name,
            brand: d.brand,
            model: d.model,
            storage: d.storage,
            color: d.color,
            carrier: d.carrier,
            condition: d.condition,
            status: d.status,
            source: d.source,
            // CRITICAL: Include original PhoneCheck data for working status determination
            working: d.working,
            originalWorking: d.originalWorking,
            originalWorkingStatus: d.originalWorkingStatus,
            originalFailed: d.originalFailed,
            batteryHealth: d.batteryHealth,
            defects: d.defects,
            notes: d.notes,
            custom1: d.custom1
          }))
        } : {
          // Full response structure
          devices,
          processed: processedDevices,
          count: devices.length,
          successCount,
          errorCount,
          station,
          startDate,
          endDate,
          location
        },
        message: `Optimized processing completed: ${devices.length} devices (${successCount} success, ${errorCount} errors)`
      };

      if (streamMode) {
        res.write(JSON.stringify({ type: 'complete', ...finalResponse }) + '\n');
        res.end();
      } else {
        res.status(200).json(finalResponse);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in processBulkDevices controller', { error: errorMessage, body: req.body });
      
      res.status(500).json({
        success: false,
        error: `Failed to process bulk devices: ${errorMessage}`
      });
    }
  };

  // Ultra-fast chunked processing with minimal overhead
  processBulkDevicesChunked = async (req: Request, res: Response): Promise<void> => {
    try {
      const { station, startDate, endDate, location, chunkSize = 10, offset = 0, optimizeData = false } = req.body;

      if (!station || !startDate || !location) {
        res.status(400).json({
          success: false,
          error: 'Station, start date, and location are required'
        });
        return;
      }

      logger.info('Processing chunked devices from Phonecheck (Ultra-fast)', { 
        station, 
        startDate, 
        endDate, 
        location, 
        chunkSize, 
        offset,
        optimizeData
      });

      // Step 1: Pull all devices from station
      const allDevices = await this.phonecheckService.getAllDevicesFromStation(station, startDate, endDate);

      if (allDevices.length === 0) {
        res.status(200).json({
          success: true,
          data: {
            devices: [],
            processed: [],
            count: 0,
            totalCount: 0,
            offset: 0,
            hasMore: false,
            station,
            startDate,
            endDate,
            location
          },
          message: 'No devices found for the specified station and date range'
        });
        return;
      }

      // Step 2: Get chunk of devices
      const chunk = allDevices.slice(offset, offset + chunkSize);
      const processedDevices: any[] = [];
      let successCount = 0;
      let errorCount = 0;

      // Process chunk with ultra-fast parallel execution
      const chunkPromises = chunk.map(async (device) => {
        try {
          const imei = device['IMEI'] || device['imei'];
          
          // Use GetDeviceDetailsEnhanced for better performance and data quality assessment
          let enhancedData = null;
          try {
            enhancedData = await Promise.race([
              this.phonecheckService.getDeviceDetailsEnhanced(imei, false), // Don't include raw data for performance
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Device details timeout')), 1500) // Ultra-fast timeout
              )
            ]);
          } catch (detailError) {
            logger.warn('Failed to get enhanced device details, using basic data', { 
              imei, 
              error: detailError instanceof Error ? detailError.message : String(detailError) 
            });
          }

          // Use enhanced data if available, otherwise use basic device data
          if (enhancedData && enhancedData.abstracted && enhancedData.abstracted.deviceName && enhancedData.abstracted.deviceName !== 'N/A') {
            const abstractedData = enhancedData.abstracted;
            const dataQuality = enhancedData.metadata?.dataQuality || 'unknown';
            
            const inventoryData = optimizeData ? {
              // Ultra-optimized data structure
              name: abstractedData.deviceName,
              brand: abstractedData.brand || 'Unknown',
              model: abstractedData.model,
              storage: abstractedData.storage || undefined,
              color: abstractedData.color || undefined,
              carrier: abstractedData.carrier || undefined,
              type: 'phone',
              imei: abstractedData.imei !== 'N/A' ? abstractedData.imei : imei,
              serialNumber: abstractedData.serialNumber !== 'N/A' ? abstractedData.serialNumber : undefined,
              condition: abstractedData.condition || undefined,
              quantity: 1,
              location: location,
              status: 'success',
              source: dataQuality === 'comprehensive' ? 'comprehensive' : 'detailed',
              dataQuality: dataQuality,
              processingLevel: enhancedData.metadata?.processingLevel || 'unknown'
            } : {
              // Full data structure
              name: abstractedData.deviceName,
              brand: abstractedData.brand || 'Unknown',
              model: abstractedData.model,
              storage: abstractedData.storage || undefined,
              color: abstractedData.color || undefined,
              carrier: abstractedData.carrier || undefined,
              type: 'phone',
              imei: abstractedData.imei !== 'N/A' ? abstractedData.imei : imei,
              serialNumber: abstractedData.serialNumber !== 'N/A' ? abstractedData.serialNumber : undefined,
              condition: abstractedData.condition || undefined,
              quantity: 1,
              location: location,
              status: 'success',
              source: dataQuality === 'comprehensive' ? 'comprehensive' : 'detailed',
              dataQuality: dataQuality,
              processingLevel: enhancedData.metadata?.processingLevel || 'unknown'
            };
            processedDevices.push(inventoryData);
            successCount++;
          } else {
            // Fallback to basic device data
            const basicDeviceData = optimizeData ? {
              // Ultra-optimized data structure
              name: device['model'] || device['Model'] || 'Unknown Device',
              brand: device['make'] || device['Make'] || 'Unknown',
              model: device['model'] || device['Model'] || 'Unknown',
              storage: device['memory'] || device['Memory'] || undefined,
              color: device['color'] || device['Color'] || undefined,
              carrier: device['carrier'] || device['Carrier'] || undefined,
              type: 'phone',
              imei: imei,
              serialNumber: device['serial'] || device['Serial'] || undefined,
              condition: device['grade'] || device['Grade'] || 'Unknown',
              quantity: 1,
              location: location,
              status: 'success',
              source: 'basic'
            } : {
              // Full data structure
              name: device['model'] || device['Model'] || 'Unknown Device',
              brand: device['make'] || device['Make'] || 'Unknown',
              model: device['model'] || device['Model'] || 'Unknown',
              storage: device['memory'] || device['Memory'] || undefined,
              color: device['color'] || device['Color'] || undefined,
              carrier: device['carrier'] || device['Carrier'] || undefined,
              type: 'phone',
              imei: imei,
              serialNumber: device['serial'] || device['Serial'] || undefined,
              condition: device['grade'] || device['Grade'] || 'Unknown',
              quantity: 1,
              location: location,
              rawData: device,
              originalDevice: device,
              status: 'success',
              source: 'basic'
            };
            processedDevices.push(basicDeviceData);
            successCount++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          processedDevices.push({
            imei: device['IMEI'] || device['imei'],
            status: 'error',
            error: errorMessage
          });
          errorCount++;
        }
      });

      await Promise.all(chunkPromises);

      const hasMore = offset + chunkSize < allDevices.length;
      const nextOffset = hasMore ? offset + chunkSize : null;

      res.status(200).json({
        success: true,
        data: optimizeData ? {
          // Optimized response structure
          summary: {
            chunkDevices: chunk.length,
            totalDevices: allDevices.length,
            successCount,
            errorCount,
            offset,
            nextOffset,
            hasMore
          },
          devices: processedDevices.map(d => ({
            imei: d.imei,
            name: d.name,
            brand: d.brand,
            model: d.model,
            storage: d.storage,
            color: d.color,
            carrier: d.carrier,
            condition: d.condition,
            status: d.status,
            source: d.source
          }))
        } : {
          // Full response structure
          devices: chunk,
          processed: processedDevices,
          count: chunk.length,
          totalCount: allDevices.length,
          offset,
          nextOffset,
          hasMore,
          successCount,
          errorCount,
          station,
          startDate,
          endDate,
          location
        },
        message: `Ultra-fast chunk processing completed: ${chunk.length} devices (${successCount} success, ${errorCount} errors)`
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in processBulkDevicesChunked controller', { error: errorMessage, body: req.body });
      
      res.status(500).json({
        success: false,
        error: `Failed to process chunked devices: ${errorMessage}`
      });
    }
  };

  // Smart bulk processing with data quality preservation
  processBulkDevicesSmart = async (req: Request, res: Response): Promise<void> => {
    try {
      const { 
        station, 
        startDate, 
        endDate, 
        location, 
        batchSize = 20, 
        preserveDataQuality = true,
        dataFormat = 'both',
        includeRawData = true 
      } = req.body;

      if (!station || !startDate || !location) {
        res.status(400).json({
          success: false,
          error: 'Station, start date, and location are required'
        });
        return;
      }

      logger.info('Processing bulk devices with smart data detection', { 
        station, 
        startDate, 
        endDate, 
        location, 
        batchSize,
        preserveDataQuality,
        dataFormat,
        includeRawData
      });

      // Step 1: Pull all devices from station
      const devices = await this.phonecheckService.getAllDevicesFromStation(station, startDate, endDate);

      if (devices.length === 0) {
        res.status(200).json({
          success: true,
          data: {
            devices: [],
            processed: [],
            count: 0,
            dataQualityStats: {
              comprehensive: 0,
              processed: 0,
              total: 0
            },
            station,
            startDate,
            endDate,
            location
          },
          message: 'No devices found for the specified station and date range'
        });
        return;
      }

      // Step 2: Process devices with smart data detection
      const processedDevices: any[] = [];
      let successCount = 0;
      let errorCount = 0;
      let comprehensiveDataCount = 0;
      let processedDataCount = 0;

      // Process devices in batches
      for (let i = 0; i < devices.length; i += batchSize) {
        const batch = devices.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (device) => {
          try {
            const imei = device['IMEI'] || device['imei'];
            
            // Get enhanced device details with smart detection
            let enhancedData = null;
            try {
              enhancedData = await this.phonecheckService.getDeviceDetailsEnhanced(imei, includeRawData);
            } catch (detailError) {
              logger.warn('Failed to get enhanced device details, using basic data', { 
                imei, 
                error: detailError instanceof Error ? detailError.message : String(detailError) 
              });
            }

            // Create inventory data based on data quality and format preferences
            let inventoryData: any = {};

            if (enhancedData && enhancedData.abstracted) {
              const abstracted = enhancedData.abstracted;
              const isComprehensive = enhancedData.metadata.dataQuality === 'comprehensive';
              
              if (isComprehensive) {
                comprehensiveDataCount++;
              } else {
                processedDataCount++;
              }

              // Build inventory data based on format preference
              switch (dataFormat) {
                case 'minimal':
                  inventoryData = {
                    name: abstracted.deviceName,
                    brand: abstracted.brand,
                    model: abstracted.model,
                    imei: abstracted.imei,
                    storage: abstracted.storage,
                    color: abstracted.color,
                    carrier: abstracted.carrier,
                    condition: abstracted.condition,
                    type: 'phone',
                    quantity: 1,
                    location: location,
                    status: 'success',
                    source: isComprehensive ? 'comprehensive' : 'processed',
                    dataQuality: abstracted.dataQuality
                  };
                  break;
                case 'standard':
                  inventoryData = {
                    name: abstracted.deviceName,
                    brand: abstracted.brand,
                    model: abstracted.model,
                    modelNumber: abstracted.modelNumber,
                    storage: abstracted.storage,
                    color: abstracted.color,
                    carrier: abstracted.carrier,
                    imei: abstracted.imei,
                    serialNumber: abstracted.serialNumber,
                    condition: abstracted.condition,
                    working: abstracted.working,
                    batteryHealth: abstracted.batteryHealth,
                    batteryCycle: abstracted.batteryCycle,
                    mdm: abstracted.mdm,
                    type: 'phone',
                    quantity: 1,
                    location: location,
                    status: 'success',
                    source: isComprehensive ? 'comprehensive' : 'processed',
                    dataQuality: abstracted.dataQuality,
                    processingLevel: abstracted.processingLevel
                  };
                  break;
                case 'full':
                default:
                  inventoryData = {
                    ...abstracted,
                    type: 'phone',
                    quantity: 1,
                    location: location,
                    status: 'success',
                    source: isComprehensive ? 'comprehensive' : 'processed'
                  };
                  break;
              }

              // Add raw data if requested
              if (includeRawData && enhancedData.raw) {
                inventoryData.rawData = enhancedData.raw;
              }

              // Add metadata if preserving data quality
              if (preserveDataQuality) {
                inventoryData.metadata = enhancedData.metadata;
              }
            } else {
              // Fallback to basic device data
              processedDataCount++;
              inventoryData = {
                name: device['model'] || device['Model'] || 'Unknown Device',
                brand: device['make'] || device['Make'] || 'Unknown',
                model: device['model'] || device['Model'] || 'Unknown',
                storage: device['memory'] || device['Memory'] || undefined,
                color: device['color'] || device['Color'] || undefined,
                carrier: device['carrier'] || device['Carrier'] || undefined,
                imei: imei,
                serialNumber: device['serial'] || device['Serial'] || undefined,
                condition: device['grade'] || device['Grade'] || 'Unknown',
                type: 'phone',
                quantity: 1,
                location: location,
                status: 'success',
                source: 'basic',
                dataQuality: 'basic',
                processingLevel: 'none'
              };
            }

            return { ...inventoryData, success: true };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
              imei: device['IMEI'] || device['imei'],
              status: 'error',
              error: errorMessage,
              success: false
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(result => {
          if (result.success) {
            successCount++;
            processedDevices.push(result);
          } else {
            errorCount++;
            processedDevices.push(result);
          }
        });

        // Minimal delay between batches
        if (i + batchSize < devices.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Calculate data quality statistics
      const dataQualityStats = {
        comprehensive: comprehensiveDataCount,
        processed: processedDataCount,
        basic: devices.length - comprehensiveDataCount - processedDataCount,
        total: devices.length,
        comprehensiveRate: devices.length > 0 ? ((comprehensiveDataCount / devices.length) * 100).toFixed(2) + '%' : '0%',
        processedRate: devices.length > 0 ? ((processedDataCount / devices.length) * 100).toFixed(2) + '%' : '0%'
      };

      res.status(200).json({
        success: true,
        data: {
          devices: processedDevices,
          count: devices.length,
          successCount,
          errorCount,
          dataQualityStats,
          station,
          startDate,
          endDate,
          location,
          processingConfig: {
            preserveDataQuality,
            dataFormat,
            includeRawData,
            batchSize
          }
        },
        message: `Smart processing completed: ${devices.length} devices (${successCount} success, ${errorCount} errors, ${comprehensiveDataCount} comprehensive data)`
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in processBulkDevicesSmart controller', { error: errorMessage, body: req.body });
      
      res.status(500).json({
        success: false,
        error: `Failed to process bulk devices: ${errorMessage}`
      });
    }
  };

  // Cache management endpoints
  clearCache = async (_req: Request, res: Response): Promise<void> => {
    try {
      this.phonecheckService.clearCache();
      
      res.status(200).json({
        success: true,
        message: 'Phonecheck device cache cleared successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error clearing Phonecheck cache', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: `Failed to clear cache: ${errorMessage}`
      });
    }
  };

  getCacheStats = async (_req: Request, res: Response): Promise<void> => {
    try {
      const stats = this.phonecheckService.getCacheStats();
      
      res.status(200).json({
        success: true,
        data: stats,
        message: `Cache contains ${stats.size} entries`
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error getting cache stats', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: `Failed to get cache stats: ${errorMessage}`
      });
    }
  };

  // Enhanced bulk processing with cache optimization
  processBulkDevicesOptimized = async (req: Request, res: Response): Promise<void> => {
    try {
      const { station, startDate, endDate, location, batchSize = 20, useCache = true, optimizeData = true } = req.body;

      if (!station || !startDate || !location) {
        res.status(400).json({
          success: false,
          error: 'Station, start date, and location are required'
        });
        return;
      }

      logger.info('Processing bulk devices with cache optimization', { 
        station, 
        startDate, 
        endDate, 
        location, 
        batchSize, 
        useCache,
        optimizeData
      });

      // Step 1: Pull all devices from station
      const devices = await this.phonecheckService.getAllDevicesFromStation(station, startDate, endDate);

      if (devices.length === 0) {
        res.status(200).json({
          success: true,
          data: {
            devices: [],
            processed: [],
            count: 0,
            cacheHits: 0,
            cacheMisses: 0,
            station,
            startDate,
            endDate,
            location
          },
          message: 'No devices found for the specified station and date range'
        });
        return;
      }

      // Step 2: Process devices with cache optimization
      const processedDevices: any[] = [];
      let successCount = 0;
      let errorCount = 0;
      let cacheHits = 0;
      let cacheMisses = 0;

      // Process devices in optimized batches
      for (let i = 0; i < devices.length; i += batchSize) {
        const batch = devices.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (device) => {
          try {
            const imei = device['IMEI'] || device['imei'];
            
            let abstractedData = null;
            let isCacheHit = false;

            if (useCache) {
              // Check cache first
              const cachedData = this.phonecheckService.getCachedDevice(imei);
              if (cachedData) {
                abstractedData = this.phonecheckService.abstractDeviceData(cachedData);
                isCacheHit = true;
                cacheHits++;
              } else {
                cacheMisses++;
              }
            }

            // If not in cache or cache disabled, fetch from API
            if (!abstractedData) {
              try {
                const rawData = await Promise.race([
                  this.phonecheckService.getDeviceDetails(imei),
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Device details timeout')), 2000)
                  )
                ]);
                abstractedData = this.phonecheckService.abstractDeviceData(rawData);
              } catch (detailError) {
                logger.warn('Failed to get device details, using basic data', { 
                  imei, 
                  error: detailError instanceof Error ? detailError.message : String(detailError) 
                });
              }
            }

            // Use detailed data if available, otherwise use basic device data
            if (abstractedData && abstractedData.deviceName && abstractedData.deviceName !== 'N/A') {
              const inventoryData = optimizeData ? {
                name: abstractedData.deviceName,
                brand: abstractedData.brand || 'Unknown',
                model: abstractedData.model,
                storage: abstractedData.storage || undefined,
                color: abstractedData.color || undefined,
                carrier: abstractedData.carrier || undefined,
                type: 'phone',
                imei: abstractedData.imei !== 'N/A' ? abstractedData.imei : imei,
                serialNumber: abstractedData.serialNumber !== 'N/A' ? abstractedData.serialNumber : undefined,
                condition: abstractedData.condition || undefined,
                quantity: 1,
                location: location,
                status: 'success',
                source: 'detailed',
                cacheHit: isCacheHit
              } : {
                name: abstractedData.deviceName,
                brand: abstractedData.brand || 'Unknown',
                model: abstractedData.model,
                storage: abstractedData.storage || undefined,
                color: abstractedData.color || undefined,
                carrier: abstractedData.carrier || undefined,
                type: 'phone',
                imei: abstractedData.imei !== 'N/A' ? abstractedData.imei : imei,
                serialNumber: abstractedData.serialNumber !== 'N/A' ? abstractedData.serialNumber : undefined,
                condition: abstractedData.condition || undefined,
                quantity: 1,
                location: location,
                rawData: abstractedData,
                originalDevice: device,
                status: 'success',
                source: 'detailed',
                cacheHit: isCacheHit
              };
              return { ...inventoryData, success: true };
            } else {
              const basicDeviceData = optimizeData ? {
                name: device['model'] || device['Model'] || 'Unknown Device',
                brand: device['make'] || device['Make'] || 'Unknown',
                model: device['model'] || device['Model'] || 'Unknown',
                storage: device['memory'] || device['Memory'] || undefined,
                color: device['color'] || device['Color'] || undefined,
                carrier: device['carrier'] || device['Carrier'] || undefined,
                type: 'phone',
                imei: imei,
                serialNumber: device['serial'] || device['Serial'] || undefined,
                condition: device['grade'] || device['Grade'] || 'Unknown',
                quantity: 1,
                location: location,
                status: 'success',
                source: 'basic',
                cacheHit: false
              } : {
                name: device['model'] || device['Model'] || 'Unknown Device',
                brand: device['make'] || device['Make'] || 'Unknown',
                model: device['model'] || device['Model'] || 'Unknown',
                storage: device['memory'] || device['Memory'] || undefined,
                color: device['color'] || device['Color'] || undefined,
                carrier: device['carrier'] || device['Carrier'] || undefined,
                type: 'phone',
                imei: imei,
                serialNumber: device['serial'] || device['Serial'] || undefined,
                condition: device['grade'] || device['Grade'] || 'Unknown',
                quantity: 1,
                location: location,
                rawData: device,
                originalDevice: device,
                status: 'success',
                source: 'basic',
                cacheHit: false
              };
              return { ...basicDeviceData, success: true };
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
              imei: device['IMEI'] || device['imei'],
              status: 'error',
              error: errorMessage,
              success: false,
              cacheHit: false
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(result => {
          if (result.success) {
            successCount++;
            processedDevices.push(result);
          } else {
            errorCount++;
            processedDevices.push(result);
          }
        });

        // Minimal delay between batches
        if (i + batchSize < devices.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      const finalResponse = {
        success: true,
        data: optimizeData ? {
          summary: {
            totalDevices: devices.length,
            successCount,
            errorCount,
            cacheHits,
            cacheMisses,
            cacheHitRate: devices.length > 0 ? ((cacheHits / devices.length) * 100).toFixed(2) + '%' : '0%',
            station,
            startDate,
            endDate,
            location
          },
          devices: processedDevices.map(d => ({
            imei: d.imei,
            name: d.name,
            brand: d.brand,
            model: d.model,
            storage: d.storage,
            color: d.color,
            carrier: d.carrier,
            condition: d.condition,
            status: d.status,
            source: d.source,
            cacheHit: d.cacheHit
          }))
        } : {
          devices,
          processed: processedDevices,
          count: devices.length,
          successCount,
          errorCount,
          cacheHits,
          cacheMisses,
          cacheHitRate: devices.length > 0 ? ((cacheHits / devices.length) * 100).toFixed(2) + '%' : '0%',
          station,
          startDate,
          endDate,
          location
        },
        message: `Cache-optimized processing completed: ${devices.length} devices (${successCount} success, ${errorCount} errors, ${cacheHits} cache hits)`
      };

      res.status(200).json(finalResponse);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in processBulkDevicesOptimized controller', { error: errorMessage, body: req.body });
      
      res.status(500).json({
        success: false,
        error: `Failed to process bulk devices: ${errorMessage}`
      });
    }
  };
}
