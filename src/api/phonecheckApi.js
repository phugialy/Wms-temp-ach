const express = require('express');
const router = express.Router();

// Real Phonecheck API integration
const PHONECHECK_CONFIG = {
  username: process.env['PHONECHECK_USERNAME'] || 'dncltechzoneinc',
  password: process.env['PHONECHECK_PASSWORD'] || '@Ustvmos817',
  baseUrl: process.env['PHONECHECK_BASE_URL'] || 'https://api.phonecheck.com',
  retryAttempts: parseInt(process.env['PHONECHECK_RETRY_ATTEMPTS'] || '3'),
  retryDelay: parseInt(process.env['PHONECHECK_RETRY_DELAY'] || '1000'),
  requestTimeout: parseInt(process.env['PHONECHECK_TIMEOUT'] || '30000'),
};

// Get authentication token from Phonecheck API
async function getAuthToken() {
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

    const data = await response.json();
    if (!data.token) {
      throw new Error('No authentication token received');
    }

    return data.token;
  } catch (error) {
    console.error('Phonecheck authentication error:', error);
    throw error;
  }
}

// POST /api/phonecheck/pull-devices - Pull devices from Phonecheck station
router.post('/pull-devices', async (req, res) => {
  try {
    const { station, startDate, endDate } = req.body;
    
    console.log(`📞 Phonecheck API: Pulling devices from station ${station} (${startDate} to ${endDate})`);
    
    // Get authentication token
    const token = await getAuthToken();
    
    // Pull devices from Phonecheck API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PHONECHECK_CONFIG.requestTimeout);

    const response = await fetch(`${PHONECHECK_CONFIG.baseUrl}/v2/master/all-devices`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'token_master': token 
      },
      body: JSON.stringify({
        date: startDate,
        station: station,
        limit: 500,
        offset: 0
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to pull devices (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    
    // Extract devices from response
    const devices = result.devices || result.data || [];
    
    console.log(`✅ Phonecheck API: Found ${devices.length} devices from station ${station}`);
    
    res.json({
      success: true,
      message: `Successfully pulled ${devices.length} devices from station ${station}`,
      data: {
        devices: devices,
        count: devices.length,
        station: station,
        startDate: startDate,
        endDate: endDate
      }
    });
    
  } catch (error) {
    console.error('❌ Error pulling devices from Phonecheck:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pull devices from Phonecheck station',
      details: error.message
    });
  }
});

// GET /api/phonecheck/stations - Get available Phonecheck stations
router.get('/stations', async (req, res) => {
  try {
    console.log('📞 Phonecheck API: Getting available stations');
    
    const mockStations = [
      { id: 'dncltz8', name: 'DNCL Station TZ8', location: 'Main Facility' },
      { id: 'dncltz9', name: 'DNCL Station TZ9', location: 'Main Facility' },
      { id: 'dncltz10', name: 'DNCL Station TZ10', location: 'Secondary Facility' },
      { id: 'dncltz11', name: 'DNCL Station TZ11', location: 'Secondary Facility' }
    ];
    
    console.log(`✅ Phonecheck API: Found ${mockStations.length} stations`);
    
    res.json({
      success: true,
      stations: mockStations,
      count: mockStations.length
    });
    
  } catch (error) {
    console.error('❌ Error getting Phonecheck stations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Phonecheck stations',
      details: error.message
    });
  }
});

// POST /api/phonecheck/process-bulk - Process bulk devices from Phonecheck station
router.post('/process-bulk', async (req, res) => {
  try {
    const { station, startDate, endDate, location, batchSize = 10, streamMode = false } = req.body;
    
    console.log(`📞 Phonecheck API: Processing bulk devices from station ${station} (${startDate} to ${endDate})`);
    
    // First, pull devices from the real Phonecheck API
    const token = await getAuthToken();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PHONECHECK_CONFIG.requestTimeout);

    const response = await fetch(`${PHONECHECK_CONFIG.baseUrl}/v2/master/all-devices`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'token_master': token 
      },
      body: JSON.stringify({
        date: startDate,
        station: station,
        limit: 500,
        offset: 0
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to pull devices (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const devices = result.devices || result.data || [];
    
    console.log(`📞 Phonecheck API: Found ${devices.length} devices to process`);
    
    // Process each device to create the expected format for the frontend
    const processedDevices = devices.map(deviceData => {
      // Handle array response from Phonecheck API
      const device = Array.isArray(deviceData) ? deviceData[0] : deviceData;
             // Extract working status
       const working = device.Working || device.working || 'PENDING';
       const workingStatus = working === 'Yes' || working === 'YES' || working === 'PASS' ? 'YES' : 
                            working === 'No' || working === 'NO' || working === 'FAILED' ? 'NO' : 
                            working === 'Pending' || working === 'PENDING' ? 'PENDING' : 'PENDING';
      
      // Extract device information
      const deviceName = device.Model || device.model || 'Unknown';
      const color = device.Color || device.color || 'N/A';
      const carrier = device.Carrier || device.carrier || 'Unlocked';
      
      // Extract Phonecheck data
      const phonecheckData = {
        original: workingStatus === 'YES' ? 'Yes' : workingStatus === 'NO' ? 'No' : 'N/A',
        status: device.Status || device.status || 'N/A',
        failed: device.Failed || device.failed || 'N/A',
        condition: device.Condition || device.condition || 'N/A',
        notes: device.Notes || device.notes || 'N/A'
      };
      
      // Extract inventory push data
      const inventoryPushData = {
        type: 'PHONE',
        location: location || 'DNCL-Inspection',
        quantity: 1,
        carrier: carrier,
        serial: device.SerialNumber || device.serialNumber || 'N/A'
      };
      
             // Determine status based on data quality
       let status = 'success';
       let statusMessage = 'Ready for inventory';
       
       // Check for IMEI in various possible field names
       const imei = device.imei || device.IMEI || device.imei2 || device.IMEI2;
       
       // Debug logging
       console.log(`🔍 Debug IMEI check for device:`, {
         deviceImei: device.imei,
         deviceIMEI: device.IMEI,
         deviceImei2: device.imei2,
         deviceIMEI2: device.IMEI2,
         finalImei: imei,
         workingStatus: workingStatus
       });
       
       if (!imei || imei === '') {
         status = 'error';
         statusMessage = 'Missing IMEI';
       } else if (workingStatus === 'PENDING') {
         status = 'warning';
         statusMessage = 'Working status pending';
       } else {
         status = 'success';
         statusMessage = 'Ready for inventory';
       }
      
             return {
         imei: imei,
        name: deviceName,
        device: `${deviceName}, ${color}`,
        working: workingStatus,
        workingStatus: workingStatus,
        batteryData: device.BatteryHealthPercentage || device.batteryHealth ? 'Available' : 'No battery data',
        phonecheckData: phonecheckData,
        inventoryPushData: inventoryPushData,
        status: status,
        statusMessage: statusMessage,
        // Additional fields for compatibility
        model: deviceName,
        color: color,
        carrier: carrier,
                 brand: device.Make || device.make || device.Brand || device.brand || 'Unknown',
         capacity: device.Capacity || device.capacity || device.Storage || device.storage || device.Memory || device.memory || 'N/A',
         model_number: device['Model#'] || device.modelNumber || device.ModelNumber || null,
        battery_health: device.BatteryHealthPercentage || device.batteryHealth || null,
        battery_count: device.BatteryCycle || device.batteryCycle || null,
                 defects: device.Failed || device.failed || null,
         notes: device.Notes || device.notes || null,
         custom1: device.Custom1 || device.custom1 || null,
        location: location || 'DNCL-Inspection'
      };
    });
    
    // Count success/error items
    const successCount = processedDevices.filter(item => item.status === 'success').length;
    const errorCount = processedDevices.filter(item => item.status === 'error').length;
    const warningCount = processedDevices.filter(item => item.status === 'warning').length;
    
    console.log(`✅ Phonecheck API: Processed ${devices.length} devices - ${successCount} success, ${errorCount} errors, ${warningCount} warnings`);
    
    res.json({
      success: true,
      message: `Processed ${devices.length} devices from Phonecheck API`,
      data: {
        count: devices.length,
        successCount: successCount,
        errorCount: errorCount,
        warningCount: warningCount,
        processed: processedDevices,
        summary: {
          totalDevices: devices.length,
          successCount: successCount,
          errorCount: errorCount,
          warningCount: warningCount,
          station: station,
          startDate: startDate,
          endDate: endDate,
          location: location
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error processing bulk Phonecheck devices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process bulk Phonecheck devices',
      details: error.message
    });
  }
});

// POST /api/phonecheck/process-devices - Process pulled devices through bulk data system
router.post('/process-devices', async (req, res) => {
  try {
    const { devices } = req.body;
    
    if (!devices || !Array.isArray(devices) || devices.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No devices provided for processing'
      });
    }
    
    console.log(`📞 Phonecheck API: Processing ${devices.length} devices through bulk system`);
    
    // Import the bulk data processor
    const BulkDataProcessor = require('../queue/bulkDataProcessor');
    
    // Create processor instance
    const processor = new BulkDataProcessor();
    await processor.connect();
    
    // Add devices to processing queue
    await processor.addBulkData(devices);
    
    // Get queue status
    const queueStatus = processor.getQueueStatus();
    
    console.log(`✅ Phonecheck API: ${devices.length} devices queued for processing`);
    
    res.json({
      success: true,
      message: `${devices.length} devices queued for processing`,
      dataCount: devices.length,
      queueStatus: {
        isProcessing: queueStatus.isProcessing,
        queueLength: queueStatus.queueLength,
        estimatedProcessingTime: `${Math.ceil(queueStatus.queueLength * 0.5)} seconds`
      }
    });
    
  } catch (error) {
    console.error('❌ Error processing Phonecheck devices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process Phonecheck devices',
      details: error.message
    });
  }
});

module.exports = router;
