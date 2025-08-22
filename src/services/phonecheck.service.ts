import { logger } from '../utils/logger';

// Phonecheck API configuration with environment variable support
const PHONECHECK_CONFIG = {
  username: process.env['PHONECHECK_USERNAME'] || 'dncltechzoneinc',
  password: process.env['PHONECHECK_PASSWORD'] || '@Ustvmos817',
  baseUrl: process.env['PHONECHECK_BASE_URL'] || 'https://api.phonecheck.com',
  clientApiUrl: process.env['PHONECHECK_CLIENT_API_URL'] || 'https://clientapiv2.phonecheck.com',
  retryAttempts: parseInt(process.env['PHONECHECK_RETRY_ATTEMPTS'] || '3'),
  retryDelay: parseInt(process.env['PHONECHECK_RETRY_DELAY'] || '1000'),
  requestTimeout: parseInt(process.env['PHONECHECK_TIMEOUT'] || '30000'),
  cacheTimeout: parseInt(process.env['PHONECHECK_CACHE_TIMEOUT'] || '300000'), // 5 minutes
};

// Simple in-memory cache for device details
const deviceCache = new Map<string, { data: any; timestamp: number }>();

interface PhonecheckAuthResponse {
  token: string;
}

interface PhonecheckDevice {
  IMEI: string;
  [key: string]: any;
}

export class PhonecheckService {
  private async getAuthToken(): Promise<string> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PHONECHECK_CONFIG.requestTimeout);

      const response = await fetch(`${PHONECHECK_CONFIG.baseUrl}/v2/auth/master/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: PHONECHECK_CONFIG.username,
          password: PHONECHECK_CONFIG.password
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Authentication failed (${response.status}): ${errorText}`);
      }

      const data = await response.json() as PhonecheckAuthResponse;
      if (!data.token) {
        throw new Error('No authentication token received');
      }

      return data.token;
    } catch (error) {
      logger.error('Phonecheck authentication error', { error });
      throw error;
    }
  }

  // Cache management methods
  public getCachedDevice(imei: string): any | null {
    const cached = deviceCache.get(imei);
    if (cached && Date.now() - cached.timestamp < PHONECHECK_CONFIG.cacheTimeout) {
      logger.info('Device found in cache', { imei });
      return cached.data;
    }
    if (cached) {
      deviceCache.delete(imei); // Remove expired cache
    }
    return null;
  }

  private setCachedDevice(imei: string, data: any): void {
    deviceCache.set(imei, { data, timestamp: Date.now() });
    logger.info('Device cached', { imei });
  }

  // Clear cache method for manual cache management
  clearCache(): void {
    const cacheSize = deviceCache.size;
    deviceCache.clear();
    logger.info('Device cache cleared', { cacheSize });
  }

  // Get cache statistics
  getCacheStats(): { size: number; entries: Array<{ imei: string; age: number }> } {
    const now = Date.now();
    const entries = Array.from(deviceCache.entries()).map(([imei, cached]) => ({
      imei,
      age: now - cached.timestamp
    }));
    
    return {
      size: deviceCache.size,
      entries
    };
  }

  async getAllDevicesFromStation(station: string, startDate: string, endDate?: string): Promise<PhonecheckDevice[]> {
    try {
      const token = await this.getAuthToken();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PHONECHECK_CONFIG.requestTimeout);

      // Focus on the Master API v2 endpoint that's working
      const endpoint = `${PHONECHECK_CONFIG.baseUrl}/v2/master/all-devices`;
      
      logger.info('Using Phonecheck Master API v2 endpoint', { 
        url: endpoint,
        station, 
        startDate, 
        endDate 
      });

      // Determine the filtering strategy based on parameters
      const isSingleDate = !endDate || startDate === endDate;
      const isDateRange = endDate && startDate !== endDate;
      
      logger.info('Date filtering strategy', { 
        isSingleDate, 
        isDateRange, 
        startDate, 
        endDate 
      });

      // Try different filtering approaches
      const searchVariations: Array<{
        type: 'single_date' | 'date_range' | 'today';
        date?: string;
        startDate?: string;
        endDate?: string;
        station?: string;
        description: string;
      }> = [];
      
      if (isSingleDate) {
        // Single date filtering using 'date' parameter (works correctly)
        searchVariations.push(
          { 
            type: 'single_date', 
            date: startDate, 
            station, 
            description: 'Single date filter using date parameter' 
          },
          { 
            type: 'single_date', 
            date: startDate, 
            station: undefined, 
            description: 'Single date filter without station' 
          }
        );
      } else if (isDateRange) {
        // Date range filtering - try both approaches since startDate/endDate is broken
        searchVariations.push(
          { 
            type: 'date_range', 
            startDate, 
            endDate, 
            station, 
            description: 'Date range filter using startDate/endDate' 
          },
          { 
            type: 'single_date', 
            date: startDate, 
            station, 
            description: 'Fallback to single date filter' 
          }
        );
      } else {
        // No date specified - get today's data
        searchVariations.push(
          { 
            type: 'today', 
            date: '', 
            station, 
            description: 'Today\'s data (empty date parameter)' 
          }
        );
      }

      for (const searchVariation of searchVariations) {
        try {
          let payload: any = {
            limit: 500,
            offset: 0
          };

          // Build payload based on filtering type
          if (searchVariation.type === 'single_date') {
            payload.date = searchVariation.date;
          } else if (searchVariation.type === 'date_range' && searchVariation.startDate && searchVariation.endDate) {
            payload.startDate = searchVariation.startDate;
            payload.endDate = searchVariation.endDate;
          } else if (searchVariation.type === 'today') {
            payload.date = '';
          }

          // Only add station if it's defined
          if (searchVariation.station) {
            payload.station = searchVariation.station;
          }

          logger.info('Trying search variation', { 
            description: searchVariation.description,
            type: searchVariation.type,
            date: searchVariation.date,
            startDate: searchVariation.startDate,
            endDate: searchVariation.endDate,
            station: searchVariation.station || 'none'
          });

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              'token_master': token 
            },
            body: JSON.stringify(payload),
            signal: controller.signal
          });

          logger.info('Phonecheck API response details', {
            url: endpoint,
            status: response.status,
            statusText: response.statusText,
            description: searchVariation.description
          });

          if (response.ok) {
            const responseText = await response.text();
            
            // Try to parse as JSON
            let devicesData;
            try {
              devicesData = JSON.parse(responseText);
              logger.info('Raw API response', { 
                responseType: typeof devicesData,
                isArray: Array.isArray(devicesData),
                keys: devicesData && typeof devicesData === 'object' ? Object.keys(devicesData) : [],
                responseLength: responseText.length
              });
            } catch (parseError) {
              logger.warn('Response is not valid JSON', { 
                url: endpoint, 
                responseText: responseText.substring(0, 200),
                error: parseError instanceof Error ? parseError.message : String(parseError)
              });
              continue;
            }

            // Handle different response structures
            let actualDevices: any[] = [];
            if (devicesData && typeof devicesData === 'object') {
              if (Array.isArray(devicesData)) {
                actualDevices = devicesData;
                logger.info('Direct array response', { deviceCount: actualDevices.length });
              } else if ((devicesData as any).devices && Array.isArray((devicesData as any).devices)) {
                actualDevices = (devicesData as any).devices;
                logger.info('Devices property response', { deviceCount: actualDevices.length });
              } else if ((devicesData as any).data && Array.isArray((devicesData as any).data)) {
                actualDevices = (devicesData as any).data;
                logger.info('Data property response', { deviceCount: actualDevices.length });
              } else if ((devicesData as any).numberOfDevices !== undefined) {
                logger.info('Response with numberOfDevices', { 
                  numberOfDevices: (devicesData as any).numberOfDevices,
                  hasDevicesArray: !!(devicesData as any).devices,
                  devicesArrayLength: (devicesData as any).devices ? (devicesData as any).devices.length : 0,
                  station, 
                  startDate: searchVariation.startDate 
                });
                
                // If numberOfDevices > 0 but devices array is empty, try to get devices
                if ((devicesData as any).numberOfDevices > 0 && (!(devicesData as any).devices || (devicesData as any).devices.length === 0)) {
                  logger.info('Devices exist but array is empty, trying to fetch devices');
                  // Try with different parameters
                                     const devicePayload = {
                     ...payload,
                     limit: Math.min((devicesData as any).numberOfDevices, 500),
                     offset: 0
                   };
                  
                  const deviceResponse = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json', 
                      'token_master': token 
                    },
                    body: JSON.stringify(devicePayload),
                    signal: controller.signal
                  });
                  
                  if (deviceResponse.ok) {
                    const deviceResponseText = await deviceResponse.text();
                    try {
                      const deviceData = JSON.parse(deviceResponseText);
                      if (deviceData && typeof deviceData === 'object') {
                        if (Array.isArray(deviceData)) {
                          actualDevices = deviceData;
                        } else if (deviceData.devices && Array.isArray(deviceData.devices)) {
                          actualDevices = deviceData.devices;
                        }
                      }
                    } catch (e) {
                      logger.warn('Failed to parse device response', { error: e instanceof Error ? e.message : String(e) });
                    }
                  }
                }
              }
            }

            if (actualDevices.length > 0) {
              // Filter out devices without IMEI
              const devicesWithIMEI = actualDevices.filter((device: any) => {
                return device['IMEI'] || device['imei'] || device['DeviceIMEI'] || device['deviceImei'];
              });

              logger.info('Successfully pulled devices from Phonecheck', { 
                endpoint: endpoint,
                description: searchVariation.description,
                type: searchVariation.type,
                station, 
                startDate: searchVariation.startDate, 
                endDate: searchVariation.endDate,
                date: searchVariation.date,
                totalDevices: actualDevices.length,
                devicesWithIMEI: devicesWithIMEI.length
              });

              return devicesWithIMEI;
            } else {
              logger.info('No devices found in response for search variation', { 
                endpoint: endpoint,
                description: searchVariation.description,
                station, 
                startDate: searchVariation.startDate 
              });
            }
          } else {
            const errorText = await response.text();
            logger.warn('Endpoint failed for search variation', { 
              url: endpoint, 
              status: response.status, 
              error: errorText,
              description: searchVariation.description
            });
          }
        } catch (error) {
          logger.warn('Search variation request error', { 
            url: endpoint, 
            error: error instanceof Error ? error.message : String(error),
            description: searchVariation.description
          });
        }
      }

      // If no devices found in any date range, throw error
      throw new Error(`No devices found for station ${station} in any date range`);

    } catch (error) {
      logger.error('Error pulling devices from Phonecheck station', { 
        error: error instanceof Error ? error.message : String(error), 
        station, 
        startDate, 
        endDate,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Re-throw the error instead of returning mock data
      throw error;
    }
  }

  async getDeviceDetails(imei: string): Promise<any> {
    try {
      // Check cache first
      const cachedData = this.getCachedDevice(imei);
      if (cachedData) {
        return cachedData;
      }

      const token = await this.getAuthToken();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PHONECHECK_CONFIG.requestTimeout);

      const response = await fetch(`${PHONECHECK_CONFIG.baseUrl}/v2/master/imei/device-info-legacy/${imei}?detailed=true`, {
        method: 'GET',
        headers: { 'token_master': token },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 404) {
          throw new Error('Device not found in Phonecheck database');
        }
        throw new Error(`Device lookup failed (${response.status}): ${errorText}`);
      }

      const deviceData = await response.json();
      
      // Cache the successful response
      this.setCachedDevice(imei, deviceData);
      
      logger.info('Successfully retrieved device details from Phonecheck', { imei });
      
      return deviceData;
    } catch (error) {
      logger.error('Error getting device details from Phonecheck', { error, imei });
      throw error;
    }
  }

  // Smart data detection - determines if data is already processed or needs abstraction
  private isDataAlreadyProcessed(rawData: any): boolean {
    const raw = Array.isArray(rawData) ? rawData[0] : rawData;
    if (!raw) return false;

    // Check if data already has comprehensive information (likely from another Phonecheck channel)
    const hasComprehensiveData = (
      raw.deviceName || raw.title || 
      (raw.model && raw.make && raw.memory && raw.color && raw.carrier) ||
      (raw.Model && raw.Make && raw.Memory && raw.Color && raw.Carrier)
    );

    // Check if data has detailed specifications
    const hasDetailedSpecs = (
      raw.batteryHealth || raw.BatteryHealthPercentage ||
      raw.working || raw.Working ||
      raw.grade || raw.Grade ||
      raw.mdm || raw.MDM
    );

    // Check if data has history information
    const hasHistory = (
      raw.deviceCreatedDate || raw.DeviceCreatedDate ||
      raw.deviceUpdatedDate || raw.DeviceUpdatedDate ||
      raw.testerName || raw.TesterName
    );

    return hasComprehensiveData && (hasDetailedSpecs || hasHistory);
  }

  // Enhanced data abstraction with smart detection
  abstractDeviceData(rawData: any, preserveRawData: boolean = true): any {
    const raw = Array.isArray(rawData) ? rawData[0] : rawData;
    if (!raw) return null;

    function formatDate(dateStr: string): string {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toISOString().replace('T', ' ').substring(0, 16);
    }

    // Check if data is already processed
    const isAlreadyProcessed = this.isDataAlreadyProcessed(rawData);
    
    // If data is already comprehensive, use it as-is with minimal transformation
    if (isAlreadyProcessed) {
      logger.info('Using already processed data from Phonecheck', { 
        imei: raw.imei || raw.IMEI,
        hasComprehensiveData: true 
      });

      return {
        // Use existing data structure if available
        deviceName: raw.deviceName || raw.title || ((raw.model || raw.Model || '') + (raw.memory || raw.Memory ? ' ' + (raw.memory || raw.Memory) : '')).toUpperCase(),
        brand: raw.brand || raw.make || raw.Make || 'N/A',
        model: raw.model || raw.Model || 'N/A',
        modelNumber: raw.modelNumber || raw.modelNo || raw["Model#"] || 'N/A',
        storage: raw.storage || raw.memory || raw.Memory || 'N/A',
        color: raw.color || raw.Color || 'N/A',
        carrier: raw.carrier || raw.Carrier || 'N/A',
        imei: raw.imei || raw.IMEI || undefined,
        serialNumber: raw.serialNumber || raw.serial || raw.Serial || undefined,
        condition: raw.condition || raw.grade || raw.Grade || 'N/A',
        working: raw.working || raw.Working ? (raw.working || raw.Working).toUpperCase() === 'YES' ? 'YES' : (raw.working || raw.Working).toUpperCase() === 'NO' ? 'NO' : 'PENDING' : 'PENDING',
        batteryHealth: raw.batteryHealth || raw.BatteryHealthPercentage || 'N/A',
        batteryCycle: raw.batteryCycle || raw.BatteryCycle || 'N/A',
        mdm: raw.mdm || raw.MDM || 'N/A',
        notes: raw.notes || raw.Notes || 'N/A',
        failed: raw.failed || raw.Failed || 'N/A',
        testerName: raw.testerName || raw.TesterName || 'N/A',
        repairNotes: raw.repairNotes || raw.Custom1 || 'N/A',
        firstReceived: formatDate(raw.firstReceived || raw.deviceCreatedDate || raw.DeviceCreatedDate),
        lastUpdate: formatDate(raw.lastUpdate || raw.deviceUpdatedDate || raw.DeviceUpdatedDate),
        checkDate: formatDate(new Date().toISOString()),
        source: 'Phonecheck API (Pre-processed)',
        dataQuality: 'comprehensive',
        processingLevel: 'minimal'
      };
    }

    // If data needs processing, apply full abstraction
    logger.info('Processing raw data with full abstraction', { 
      imei: raw.imei || raw.IMEI,
      hasComprehensiveData: false 
    });

    return {
      deviceName: ((raw.model || raw.Model || '') + (raw.memory || raw.Memory ? ' ' + (raw.memory || raw.Memory) : '')).toUpperCase(),
      brand: raw.make || raw.Make || 'N/A',
      model: raw.model || raw.Model || 'N/A',
      modelNumber: raw.modelNo || raw["Model#"] || 'N/A',
      storage: raw.memory || raw.Memory || 'N/A',
      color: raw.color || raw.Color || 'N/A',
      carrier: raw.carrier || raw.Carrier || 'N/A',
      imei: raw.imei || raw.IMEI || undefined,
      serialNumber: raw.serial || raw.Serial || undefined,
      condition: raw.grade || raw.Grade || 'N/A',
      working: raw.working || raw.Working ? (raw.working || raw.Working).toUpperCase() === 'YES' ? 'YES' : (raw.working || raw.Working).toUpperCase() === 'NO' ? 'NO' : 'PENDING' : 'PENDING',
      batteryHealth: raw.batteryHealth || raw.BatteryHealthPercentage || 'N/A',
      batteryCycle: raw.batteryCycle || raw.BatteryCycle || 'N/A',
      mdm: raw.mdm || raw.MDM || 'N/A',
      notes: raw.notes || raw.Notes || 'N/A',
      failed: raw.failed || raw.Failed || 'N/A',
      testerName: raw.testerName || raw.TesterName || 'N/A',
      repairNotes: raw.repairNotes || raw.Custom1 || 'N/A',
      firstReceived: formatDate(raw.deviceCreatedDate || raw.DeviceCreatedDate),
      lastUpdate: formatDate(raw.deviceUpdatedDate || raw.DeviceUpdatedDate),
      checkDate: formatDate(new Date().toISOString()),
      source: 'Phonecheck API (Processed)',
      dataQuality: 'processed',
      processingLevel: 'full',
      ...(preserveRawData && { rawData: raw })
    };
  }

  // Enhanced device details with data quality assessment
  async getDeviceDetailsEnhanced(imei: string, includeRawData: boolean = true): Promise<any> {
    try {
      // Check cache first
      const cachedData = this.getCachedDevice(imei);
      if (cachedData) {
        logger.info('Device found in cache', { imei });
        return {
          ...cachedData,
          fromCache: true,
          cacheTimestamp: Date.now()
        };
      }

      const token = await this.getAuthToken();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PHONECHECK_CONFIG.requestTimeout);

      const response = await fetch(`${PHONECHECK_CONFIG.baseUrl}/v2/master/imei/device-info-legacy/${imei}?detailed=true`, {
        method: 'GET',
        headers: { 'token_master': token },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 404) {
          throw new Error('Device not found in Phonecheck database');
        }
        throw new Error(`Device lookup failed (${response.status}): ${errorText}`);
      }

      const rawDeviceData = await response.json();
      
      // Assess data quality
      const isAlreadyProcessed = this.isDataAlreadyProcessed(rawDeviceData);
      const abstractedData = this.abstractDeviceData(rawDeviceData, includeRawData);
      
      // Create enhanced response
      const enhancedData = {
        imei,
        abstracted: abstractedData,
        raw: includeRawData ? rawDeviceData : undefined,
        metadata: {
          dataQuality: isAlreadyProcessed ? 'comprehensive' : 'processed',
          processingLevel: isAlreadyProcessed ? 'minimal' : 'full',
          source: 'Phonecheck API',
          timestamp: new Date().toISOString(),
          fromCache: false
        }
      };
      
      // Cache the enhanced response
      this.setCachedDevice(imei, enhancedData);
      
      logger.info('Successfully retrieved enhanced device details', { 
        imei,
        dataQuality: enhancedData.metadata.dataQuality,
        processingLevel: enhancedData.metadata.processingLevel
      });
      
      return enhancedData;
    } catch (error) {
      logger.error('Error getting enhanced device details', { error, imei });
      throw error;
    }
  }
}
