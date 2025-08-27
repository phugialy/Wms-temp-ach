const express = require('express');
const router = express.Router();

// Import the bulk data processor for queue processing
const BulkDataProcessor = require('../queue/bulkDataProcessor');

let bulkProcessor = null;

// Initialize bulk processor
async function initializeBulkProcessor() {
  if (!bulkProcessor) {
    bulkProcessor = new BulkDataProcessor();
    await bulkProcessor.connect();
  }
  return bulkProcessor;
}

// POST /api/imei-queue/add - Add items to processing queue
router.post('/add', async (req, res) => {
  try {
    const { items, source = 'bulk-add' } = req.body;
    
    console.log(`📦 IMEI Queue: Adding ${items?.length || 0} items from ${source}`);
    
    // Validate input
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid items. Expected non-empty array of items.'
      });
    }
    
    // Validate each item has at least an IMEI
    const invalidItems = items.filter(item => !item.imei);
    if (invalidItems.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Some items are missing IMEI numbers',
        invalidCount: invalidItems.length
      });
    }
    
    // Initialize processor if needed
    const processor = await initializeBulkProcessor();
    
    // Add data to processing queue
    await processor.addBulkData(items);
    
    // Get queue status
    const queueStatus = processor.getQueueStatus();
    
    console.log(`✅ IMEI Queue: ${items.length} items added to queue. Queue status:`, queueStatus);
    
    res.json({
      success: true,
      message: `${items.length} items added to processing queue`,
      added: items.length,
      errors: [],
      chunks: 1,
      queueStatus: {
        isProcessing: queueStatus.isProcessing,
        queueLength: queueStatus.queueLength,
        estimatedProcessingTime: `${Math.ceil(queueStatus.queueLength * 0.5)} seconds`
      }
    });
    
  } catch (error) {
    console.error('❌ Error adding items to IMEI queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add items to queue',
      details: error.message,
      added: 0,
      errors: [error.message]
    });
  }
});

// GET /api/imei-queue/stats - Get queue statistics
router.get('/stats', async (req, res) => {
  try {
    const processor = await initializeBulkProcessor();
    const queueStatus = processor.getQueueStatus();
    
    res.json({
      success: true,
      stats: {
        isProcessing: queueStatus.isProcessing,
        queueLength: queueStatus.queueLength,
        totalProcessed: queueStatus.totalProcessed || 0,
        maxRetries: queueStatus.maxRetries,
        estimatedProcessingTime: `${Math.ceil(queueStatus.queueLength * 0.5)} seconds`
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting IMEI queue stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get queue statistics',
      details: error.message
    });
  }
});

// GET /api/imei-queue/items - Get queue items by status
router.get('/items', async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    const processor = await initializeBulkProcessor();
    
    // For now, return queue status since we don't store individual items
    const queueStatus = processor.getQueueStatus();
    
    res.json({
      success: true,
      items: [],
      queueStatus: queueStatus,
      message: 'Queue items are processed immediately and not stored individually'
    });
    
  } catch (error) {
    console.error('❌ Error getting IMEI queue items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get queue items',
      details: error.message
    });
  }
});

// POST /api/imei-queue/process-pending - Process pending items
router.post('/process-pending', async (req, res) => {
  try {
    const processor = await initializeBulkProcessor();
    const queueStatus = processor.getQueueStatus();
    
    if (queueStatus.queueLength === 0) {
      return res.json({
        success: true,
        message: 'No items in queue to process',
        processed: 0
      });
    }
    
    // The queue processes automatically, so we just return the status
    res.json({
      success: true,
      message: `Queue is processing ${queueStatus.queueLength} items`,
      processed: queueStatus.queueLength,
      isProcessing: queueStatus.isProcessing
    });
    
  } catch (error) {
    console.error('❌ Error processing IMEI queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process queue',
      details: error.message
    });
  }
});

// GET /api/imei-queue/imei/:imei - Get specific IMEI data from database
router.get('/imei/:imei', async (req, res) => {
  try {
    const { imei } = req.params;
    
    if (!imei) {
      return res.status(400).json({
        success: false,
        error: 'IMEI parameter is required'
      });
    }
    
    const processor = await initializeBulkProcessor();
    
    // Query the database for the specific IMEI
    const query = `
      SELECT 
        p.imei,
        p.sku,
        p.brand,
        p.date_in,
        i.model,
        i.capacity,
        i.color,
        i.carrier,
        i.working,
        i.location,
        dt.defects,
        dt.notes,
        dt.custom1
      FROM product p
      LEFT JOIN item i ON p.imei = i.imei
      LEFT JOIN device_test dt ON p.imei = dt.imei
      WHERE p.imei = $1
    `;
    
    const result = await processor.client.query(query, [imei]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'IMEI not found in database'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Error getting IMEI data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get IMEI data',
      details: error.message
    });
  }
});

module.exports = router;
