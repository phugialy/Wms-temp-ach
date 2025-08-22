import { logger } from '../utils/logger';

// Mock device data structure
interface MockDevice {
  IMEI: string;
  Serial?: string;
  Make?: string;
  Model?: string;
  ModelNumber?: string;
  Memory?: string;
  Color?: string;
  Carrier?: string;
  Grade?: string;
  Working?: string;
  BatteryHealthPercentage?: string;
  BatteryCycle?: string;
  MDM?: string;
  Notes?: string;
  Failed?: string;
  TesterName?: string;
  Custom1?: string;
  DeviceCreatedDate?: string;
  DeviceUpdatedDate?: string;
}

// Mock station data - you can replace this with real data
const MOCK_STATION_DATA: Record<string, MockDevice[]> = {
  'dncltechzoneinc': [
    {
      IMEI: '123456789012345',
      Serial: 'ABC123456789',
      Make: 'Apple',
      Model: 'iPhone',
      ModelNumber: 'A2403',
      Memory: '128GB',
      Color: 'Black',
      Carrier: 'Unlocked',
      Grade: 'A',
      Working: 'Yes',
      BatteryHealthPercentage: '95%',
      BatteryCycle: '150',
      MDM: 'No',
      Notes: 'Excellent condition',
      Failed: 'No',
      TesterName: 'John Doe',
      Custom1: 'No repairs needed',
      DeviceCreatedDate: '2024-01-15T10:00:00Z',
      DeviceUpdatedDate: '2024-01-15T10:30:00Z'
    },
    {
      IMEI: '987654321098765',
      Serial: 'XYZ987654321',
      Make: 'Samsung',
      Model: 'Galaxy',
      ModelNumber: 'SM-G991U',
      Memory: '256GB',
      Color: 'Blue',
      Carrier: 'AT&T',
      Grade: 'B',
      Working: 'Yes',
      BatteryHealthPercentage: '87%',
      BatteryCycle: '320',
      MDM: 'No',
      Notes: 'Minor scratches',
      Failed: 'No',
      TesterName: 'Jane Smith',
      Custom1: 'Screen protector recommended',
      DeviceCreatedDate: '2024-01-15T11:00:00Z',
      DeviceUpdatedDate: '2024-01-15T11:15:00Z'
    }
  ],
  'test': [
    {
      IMEI: '111111111111111',
      Serial: 'TEST123456',
      Make: 'Apple',
      Model: 'iPhone',
      ModelNumber: 'A2403',
      Memory: '64GB',
      Color: 'White',
      Carrier: 'Verizon',
      Grade: 'A',
      Working: 'Yes',
      BatteryHealthPercentage: '98%',
      BatteryCycle: '50',
      MDM: 'No',
      Notes: 'Test device',
      Failed: 'No',
      TesterName: 'Test User',
      Custom1: 'Test notes',
      DeviceCreatedDate: '2024-01-15T09:00:00Z',
      DeviceUpdatedDate: '2024-01-15T09:30:00Z'
    }
  ]
};

export class MockPhonecheckService {
  private deviceCache: Map<string, MockDevice[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  constructor() {
    // Clean up expired cache entries every hour
    setInterval(() => this.cleanupCache(), 60 * 60 * 1000);
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (now > expiry) {
        this.deviceCache.delete(key);
        this.cacheExpiry.delete(key);
        logger.info('Cleaned up expired cache entry', { key });
      }
    }
  }

  async getAllDevicesFromStation(station: string, date: string): Promise<MockDevice[]> {
    try {
      const cacheKey = `${station}-${date}`;
      const now = Date.now();

      // Check cache first
      if (this.deviceCache.has(cacheKey)) {
        const expiry = this.cacheExpiry.get(cacheKey);
        if (expiry && now < expiry) {
          const cachedData = this.deviceCache.get(cacheKey);
          logger.info('Returning cached device data', { station, date, count: cachedData?.length });
          return cachedData || [];
        }
      }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get mock data for the station
      const devices = MOCK_STATION_DATA[station] || [];
      
      // Filter by date if needed (in a real scenario, you'd filter by actual date)
      const filteredDevices = devices.filter(device => {
        if (!device.DeviceCreatedDate) return true;
        const deviceDate = new Date(device.DeviceCreatedDate).toISOString().split('T')[0];
        return deviceDate === date;
      });

      // Cache the result
      this.deviceCache.set(cacheKey, filteredDevices);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);

      logger.info('Retrieved devices from mock service', { 
        station, 
        date, 
        totalDevices: devices.length,
        filteredDevices: filteredDevices.length 
      });

      return filteredDevices;
    } catch (error) {
      logger.error('Error getting devices from mock service', { error, station, date });
      throw error;
    }
  }

  async getDeviceDetails(imei: string): Promise<MockDevice> {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));

      // Search through all stations for the device
      for (const stationDevices of Object.values(MOCK_STATION_DATA)) {
        const device = stationDevices.find(d => d.IMEI === imei);
        if (device) {
          logger.info('Found device in mock service', { imei });
          return device;
        }
      }

      throw new Error('Device not found in mock database');
    } catch (error) {
      logger.error('Error getting device details from mock service', { error, imei });
      throw error;
    }
  }

  abstractDeviceData(rawData: MockDevice): any {
    if (!rawData) return null;

    function formatDate(dateStr: string): string {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toISOString().replace('T', ' ').substring(0, 16);
    }

    return {
      deviceName: ((rawData.Model || '') + (rawData.Memory ? ' ' + rawData.Memory : '')).toUpperCase(),
      brand: rawData.Make || 'N/A',
      model: rawData.ModelNumber || 'N/A',
      modelNumber: rawData.ModelNumber || 'N/A',
      storage: rawData.Memory || 'N/A',
      color: rawData.Color || 'N/A',
      carrier: rawData.Carrier || 'N/A',
      imei: rawData.IMEI || undefined,
      serialNumber: rawData.Serial || undefined,
      condition: rawData.Grade || 'N/A',
      working: rawData.Working || 'N/A',
      batteryHealth: rawData.BatteryHealthPercentage || 'N/A',
      batteryCycle: rawData.BatteryCycle || 'N/A',
      mdm: rawData.MDM || 'N/A',
      notes: rawData.Notes || 'N/A',
      failed: rawData.Failed || 'N/A',
      testerName: rawData.TesterName || 'N/A',
      repairNotes: rawData.Custom1 || 'N/A',
      firstReceived: formatDate(rawData.DeviceCreatedDate || ''),
      lastUpdate: formatDate(rawData.DeviceUpdatedDate || ''),
      checkDate: formatDate(new Date().toISOString()),
      source: 'Mock Phonecheck Service'
    };
  }

  // Method to add custom device data
  addCustomDevice(station: string, device: MockDevice): void {
    if (!MOCK_STATION_DATA[station]) {
      MOCK_STATION_DATA[station] = [];
    }
    MOCK_STATION_DATA[station].push(device);
    logger.info('Added custom device to mock service', { station, imei: device.IMEI });
  }

  // Method to get all available stations
  getAvailableStations(): string[] {
    return Object.keys(MOCK_STATION_DATA);
  }

  // Method to clear cache
  clearCache(): void {
    this.deviceCache.clear();
    this.cacheExpiry.clear();
    logger.info('Cleared mock service cache');
  }
}
