const { logger } = require('../utils/logger');
const prisma = require('../prisma/client');
const queueService = require('./simpleQueueService');

// SKU generation function
function generateSKU(data) {
  const model = (data.model || data.device_model || '').replace(/\s+/g, '');
  const capacity = data.capacity || data.storage || '';
  const color = (data.color || '').substring(0, 3).toUpperCase();
  const carrier = (data.carrier || data.carrier_status || 'UNL').substring(0, 3).toUpperCase();
  
  return `${model}-${capacity}-${color}-${carrier}`;
}

// Process data into database tables
async function processDataToDatabase(data) {
  const imei = data.imei;
  if (!imei) {
    throw new Error('IMEI is required');
  }

  const sku = generateSKU(data);

  await prisma.$transaction(async (tx) => {
    // Upsert into Product table
    await tx.product.upsert({
      where: { imei },
      update: {
        sku,
        brand: data.brand || data.device_brand,
        updated_at: new Date()
      },
      create: {
        imei,
        sku,
        brand: data.brand || data.device_brand
      }
    });

    // Upsert into Item table
    await tx.item.upsert({
      where: { imei },
      update: {
        model: data.model || data.device_model,
        model_number: data.model_number || data.device_model_number,
        carrier: data.carrier || data.carrier_status,
        capacity: data.capacity || data.storage,
        color: data.color,
        battery_health: data.battery_health,
        battery_count: data.battery_count || data.bcc,
        working: data.working || data.test_result || 'PENDING',
        location: data.location || 'DNCL-Inspection',
        updated_at: new Date()
      },
      create: {
        imei,
        model: data.model || data.device_model,
        model_number: data.model_number || data.device_model_number,
        carrier: data.carrier || data.carrier_status,
        capacity: data.capacity || data.storage,
        color: data.color,
        battery_health: data.battery_health,
        battery_count: data.battery_count || data.bcc,
        working: data.working || data.test_result || 'PENDING',
        location: data.location || 'DNCL-Inspection'
      }
    });

    // Upsert into DeviceTest table
    await tx.deviceTest.upsert({
      where: { imei },
      update: {
        working: data.working || data.test_result,
        defects: data.defects || data.device_defects,
        notes: data.notes || data.test_notes,
        custom1: data.custom1 || data.repair_notes,
        test_date: new Date()
      },
      create: {
        imei,
        working: data.working || data.test_result,
        defects: data.defects || data.device_defects,
        notes: data.notes || data.test_notes,
        custom1: data.custom1 || data.repair_notes
      }
    });

    // Update or create Inventory record
    await tx.inventory.upsert({
      where: {
        sku_location: {
          sku,
          location: data.location || 'DNCL-Inspection'
        }
      },
      update: {
        qty_total: {
          increment: 1
        },
        pass_devices: {
          increment: (data.working === 'YES' || data.working === 'PASS') ? 1 : 0
        },
        failed_devices: {
          increment: (data.working === 'NO' || data.working === 'FAILED') ? 1 : 0
        },
        available: {
          increment: 1
        },
        updated_at: new Date()
      },
      create: {
        sku,
        location: data.location || 'DNCL-Inspection',
        qty_total: 1,
        pass_devices: (data.working === 'YES' || data.working === 'PASS') ? 1 : 0,
        failed_devices: (data.working === 'NO' || data.working === 'FAILED') ? 1 : 0,
        reserved: 0,
        available: 1
      }
    });
  });

  logger.info(`Successfully processed IMEI: ${imei}`);
}

// Mock PhoneCheck API call (replace with real API)
async function fetchPhoneCheckData(imei) {
  // This is a mock - replace with actual PhoneCheck API call
  logger.info(`Fetching PhoneCheck data for IMEI: ${imei}`);
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Return mock data
  return {
    imei,
    device_model: 'iPhone 14 Pro',
    device_brand: 'Apple',
    storage: '256GB',
    color: 'Space Black',
    carrier_status: 'Unlocked',
    battery_health: '95%',
    bcc: 150,
    test_result: 'PASS',
    device_defects: 'None',
    test_notes: 'Device passed all tests',
    repair_notes: 'No repairs needed'
  };
}

// Enrich data with PhoneCheck API
async function enrichDataWithPhoneCheck(imei, existingData) {
  try {
    const phonecheckData = await fetchPhoneCheckData(imei);
    return { ...existingData, ...phonecheckData };
  } catch (error) {
    logger.error(`Failed to enrich data for IMEI ${imei}: ${error.message}`);
    return existingData;
  }
}

// Set up queue processors
function setupQueueProcessors() {
  const bulkDataQueue = queueService.getBulkDataQueue();
  const phonecheckQueue = queueService.getPhoneCheckQueue();
  const dataEnrichmentQueue = queueService.getDataEnrichmentQueue();

  // Bulk Data Processor
  bulkDataQueue.on('job', async (job) => {
    try {
      const { data } = job;
      logger.info(`Processing bulk data job: ${job.id}`);

      // Process each item in the bulk data
      for (const item of data.items || []) {
        try {
          // Check if we have enough data
          if (!item.imei || !item.model) {
            // Add to enrichment queue
            await queueService.addDataEnrichmentToQueue({
              imei: item.imei,
              source: 'bulk-add',
              batchId: data.batchId
            });
            continue;
          }

          await processDataToDatabase(item);
        } catch (error) {
          logger.error(`Failed to process item in bulk data: ${error.message}`);
        }
      }

      // Mark as completed
      if (job.queueItemId) {
        await prisma.dataQueue.update({
          where: { id: job.queueItemId },
          data: { 
            status: 'completed',
            processed_at: new Date()
          }
        });
      }

      logger.info(`Completed bulk data job: ${job.id}`);
    } catch (error) {
      logger.error(`Bulk data job failed: ${error.message}`);
      throw error;
    }
  });

  // PhoneCheck Data Processor
  phonecheckQueue.on('job', async (job) => {
    try {
      const { data } = job;
      logger.info(`Processing PhoneCheck job: ${job.id}`);

      const phonecheckData = await fetchPhoneCheckData(data.imei);
      await processDataToDatabase(phonecheckData);

      // Mark as completed
      if (job.queueItemId) {
        await prisma.dataQueue.update({
          where: { id: job.queueItemId },
          data: { 
            status: 'completed',
            processed_at: new Date()
          }
        });
      }

      logger.info(`Completed PhoneCheck job: ${job.id}`);
    } catch (error) {
      logger.error(`PhoneCheck job failed: ${error.message}`);
      throw error;
    }
  });

  // Data Enrichment Processor
  dataEnrichmentQueue.on('job', async (job) => {
    try {
      const { data } = job;
      logger.info(`Processing enrichment job: ${job.id}`);

      const enrichedData = await enrichDataWithPhoneCheck(data.imei, data);
      await processDataToDatabase(enrichedData);

      // Mark as completed
      if (job.queueItemId) {
        await prisma.dataQueue.update({
          where: { id: job.queueItemId },
          data: { 
            status: 'completed',
            processed_at: new Date()
          }
        });
      }

      logger.info(`Completed enrichment job: ${job.id}`);
    } catch (error) {
      logger.error(`Enrichment job failed: ${error.message}`);
      throw error;
    }
  });

  logger.info('Queue processors set up successfully');
}

// Start the queue system
function startQueueSystem() {
  setupQueueProcessors();
  logger.info('Simple queue system started');
}

module.exports = {
  startQueueSystem,
  processDataToDatabase,
  fetchPhoneCheckData,
  enrichDataWithPhoneCheck,
  generateSKU
};
