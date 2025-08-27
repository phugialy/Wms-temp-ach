const express = require('express');
const router = express.Router();

// Import the bulk data processor
const BulkDataProcessor = require('../queue/bulkDataProcessor');

// Create a singleton instance of the processor
let bulkProcessor = null;

// Initialize the bulk processor
async function initializeBulkProcessor() {
  if (!bulkProcessor) {
    bulkProcessor = new BulkDataProcessor();
    await bulkProcessor.connect();
    
    // Set up event listeners
    bulkProcessor.on('itemProcessed', (result) => {
      console.log(`✅ Item processed: ${result.imei} - ${result.message}`);
    });
    
    bulkProcessor.on('itemFailed', (result) => {
      console.error(`❌ Item failed: ${result.imei} - ${result.error} (${result.retries} retries)`);
    });
    
    bulkProcessor.on('queueCompleted', () => {
      console.log('🎉 Queue processing completed');
    });
  }
  return bulkProcessor;
}

// POST /api/bulk-data - Receive bulk data for processing
router.post('/bulk-data', async (req, res) => {
  try {
    const { data } = req.body;
    
    // Validate input
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bulk data. Expected non-empty array of items.'
      });
    }
    
    // Validate each item has at least an IMEI
    const invalidItems = data.filter(item => !item.imei);
    if (invalidItems.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Some items are missing IMEI numbers',
        invalidCount: invalidItems.length
      });
    }
    
    console.log(`📦 Received bulk data request: ${data.length} items`);
    
    // Initialize processor if needed
    const processor = await initializeBulkProcessor();
    
    // Add data to processing queue
    await processor.addBulkData(data);
    
    // Get queue status
    const queueStatus = processor.getQueueStatus();
    
    console.log(`✅ Bulk data added to queue. Queue status:`, queueStatus);
    
    res.json({
      success: true,
      message: `Bulk data received and queued for processing`,
      dataCount: data.length,
      queueStatus: {
        isProcessing: queueStatus.isProcessing,
        queueLength: queueStatus.queueLength,
        estimatedProcessingTime: `${Math.ceil(queueStatus.queueLength * 0.5)} seconds`
      }
    });
    
  } catch (error) {
    console.error('❌ Error processing bulk data request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process bulk data request',
      details: error.message
    });
  }
});

// GET /api/bulk-data/status - Get queue processing status
router.get('/bulk-data/status', async (req, res) => {
  try {
    const processor = await initializeBulkProcessor();
    const status = processor.getQueueStatus();
    
    res.json({
      success: true,
      status: {
        isProcessing: status.isProcessing,
        queueLength: status.queueLength,
        maxRetries: status.maxRetries,
        estimatedProcessingTime: status.isProcessing ? `${Math.ceil(status.queueLength * 0.5)} seconds` : '0 seconds'
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting queue status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get queue status',
      details: error.message
    });
  }
});

// GET /api/bulk-data/logs - Get processing logs
router.get('/bulk-data/logs', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    // This would query the queue_processing_log table
    // For now, return a placeholder response
    res.json({
      success: true,
      logs: [],
      message: 'Processing logs endpoint - implement database query here'
    });
    
  } catch (error) {
    console.error('❌ Error getting processing logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get processing logs',
      details: error.message
    });
  }
});

// GET /api/bulk-data/processed - Get processed data in inventory view format
router.get('/bulk-data/processed', async (req, res) => {
  try {
    console.log('📊 Getting processed bulk data in inventory format');
    
    // Initialize processor if needed
    const processor = await initializeBulkProcessor();
    
    // Get processed data in inventory view format
    const processedDataQuery = `
      SELECT 
        p.imei,
        i.working,
        -- Device name format: Model-Capacity-Color-Carrier
        CONCAT(
          COALESCE(i.model, 'Unknown'), '-',
          COALESCE(i.capacity, 'N/A'), '-',
          COALESCE(i.color, 'N/A'), '-',
          COALESCE(i.carrier, 'N/A')
        ) as device_name,
        -- Individual columns for frontend display
        i.model,
        i.capacity as storage,
        i.color,
        i.carrier,
        i.location,
        i.working as working_status,
        -- Condition based on battery health and working status
        CASE 
          WHEN i.working IN ('YES', 'PASS') THEN 'GOOD'
          WHEN i.working IN ('NO', 'FAILED') THEN 'POOR'
          WHEN i.working = 'PENDING' THEN 'UNKNOWN'
          ELSE 'UNKNOWN'
        END as condition,
        -- SKU display (original format)
        CONCAT(p.sku, ' (', i.model, '-', i.capacity, '-', i.color, '-', i.carrier, ')') as sku_display,
        -- Device test data
        dt.defects,
        dt.notes,
        dt.custom1 as repair_notes,
        -- Additional useful data
        i.battery_health,
        i.battery_count,
        i.model_number,
        p.brand,
        p.date_in,
        i.created_at,
        i.updated_at
      FROM product p
      LEFT JOIN item i ON p.imei = i.imei
      LEFT JOIN device_test dt ON p.imei = dt.imei
      ORDER BY p.created_at DESC
      LIMIT 50
    `;
    
    const processedDataResult = await processor.client.query(processedDataQuery);
    
    console.log(`✅ Retrieved ${processedDataResult.rows.length} processed items`);
    
    res.json({
      success: true,
      data: processedDataResult.rows,
      count: processedDataResult.rows.length,
      message: 'Processed bulk data retrieved successfully in inventory format'
    });
    
  } catch (error) {
    console.error('❌ Error getting processed bulk data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get processed bulk data',
      details: error.message
    });
  }
});

// POST /api/bulk-data/test - Test endpoint with sample data
router.post('/bulk-data/test', async (req, res) => {
  try {
    // Generate sample bulk data for testing
    const sampleData = [
      {
        imei: '111111111111111',
        model: 'iPhone 14 Pro',
        brand: 'Apple',
        capacity: '256GB',
        color: 'Space Black',
        carrier: 'Unlocked',
        working: 'YES',
        location: 'DNCL-Inspection',
        battery_health: '96%',
        battery_count: '210',
        date_in: new Date()
      },
      {
        imei: '222222222222222',
        model: 'Samsung Galaxy S23',
        brand: 'Samsung',
        capacity: '512GB',
        color: 'Phantom Black',
        carrier: 'AT&T',
        working: 'NO',
        location: 'DNCL-Inspection',
        battery_health: '87%',
        battery_count: '156',
        defects: 'Screen cracked',
        notes: 'Device needs repair',
        date_in: new Date()
      },
      {
        imei: '333333333333333',
        // Minimal data - will trigger Phonecheck API enrichment
        working: 'PENDING',
        location: 'DNCL-Inspection',
        date_in: new Date()
      }
    ];
    
    console.log(`🧪 Test bulk data request: ${sampleData.length} items`);
    
    // Initialize processor if needed
    const processor = await initializeBulkProcessor();
    
    // Add test data to processing queue
    await processor.addBulkData(sampleData);
    
    // Get queue status
    const queueStatus = processor.getQueueStatus();
    
    res.json({
      success: true,
      message: `Test bulk data added to queue for processing`,
      dataCount: sampleData.length,
      sampleData: sampleData,
      queueStatus: {
        isProcessing: queueStatus.isProcessing,
        queueLength: queueStatus.queueLength,
        estimatedProcessingTime: `${Math.ceil(queueStatus.queueLength * 0.5)} seconds`
      }
    });
    
  } catch (error) {
    console.error('❌ Error processing test bulk data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process test bulk data',
      details: error.message
    });
  }
});

module.exports = router;
