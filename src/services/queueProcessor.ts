import { bulkDataQueue, phonecheckQueue, dataEnrichmentQueue } from './queueService';
import { logger } from '../utils/logger';
import prisma from '../prisma/client';
import axios from 'axios';

// PhoneCheck API configuration
const PHONECHECK_CONFIG = {
  baseURL: process.env.PHONECHECK_BASE_URL || 'https://api.phonecheck.com',
  username: process.env.PHONECHECK_USERNAME,
  password: process.env.PHONECHECK_PASSWORD
};

// SKU Generation function
function generateSKU(data: any): string {
  const model = data.model || data.name || '';
  const capacity = data.capacity || data.storage || '';
  const color = data.color || '';
  const carrier = data.carrier || '';
  
  // Extract capacity number
  const capacityNum = capacity.replace(/[^0-9]/g, '');
  
  // Color code mapping
  const colorCode = (() => {
    const colorLower = color.toLowerCase();
    if (colorLower.includes('black')) return 'BLK';
    if (colorLower.includes('blue')) return 'BLU';
    if (colorLower.includes('white')) return 'WHT';
    if (colorLower.includes('red')) return 'RED';
    if (colorLower.includes('green')) return 'GRN';
    if (colorLower.includes('purple')) return 'PUR';
    if (colorLower.includes('pink')) return 'PNK';
    if (colorLower.includes('gold')) return 'GLD';
    if (colorLower.includes('silver')) return 'SLV';
    if (colorLower.includes('gray') || colorLower.includes('grey')) return 'GRY';
    return color.substring(0, 3).toUpperCase();
  })();
  
  // Carrier code
  const carrierCode = carrier.replace(/\s+/g, '').substring(0, 3).toUpperCase();
  
  return `${model.replace(/\s+/g, '')}-${capacityNum}GB-${colorCode}-${carrierCode}`;
}

// Process data into database tables
async function processDataToDatabase(data: any): Promise<void> {
  const imei = data.imei;
  
  if (!imei) {
    throw new Error('IMEI is required');
  }
  
  // Generate SKU
  const sku = generateSKU(data);
  
  // Start transaction
  await prisma.$transaction(async (tx) => {
    // 1. Insert/Update Product table
    await tx.product.upsert({
      where: { imei },
      update: {
        sku,
        brand: data.brand,
        updated_at: new Date()
      },
      create: {
        imei,
        sku,
        brand: data.brand,
        date_in: new Date()
      }
    });
    
    // 2. Insert/Update Item table
    await tx.item.upsert({
      where: { imei },
      update: {
        model: data.model,
        model_number: data.model_number,
        carrier: data.carrier,
        capacity: data.capacity || data.storage,
        color: data.color,
        battery_health: data.battery_health,
        battery_count: data.battery_count || data.bcc,
        working: data.working || 'PENDING',
        location: data.location || 'Default Location',
        updated_at: new Date()
      },
      create: {
        imei,
        model: data.model,
        model_number: data.model_number,
        carrier: data.carrier,
        capacity: data.capacity || data.storage,
        color: data.color,
        battery_health: data.battery_health,
        battery_count: data.battery_count || data.bcc,
        working: data.working || 'PENDING',
        location: data.location || 'Default Location'
      }
    });
    
    // 3. Insert/Update Device Test table
    await tx.deviceTest.upsert({
      where: { imei },
      update: {
        working: data.working,
        defects: data.defects || data.screen_condition || data.body_condition,
        notes: data.notes,
        custom1: data.custom1 || data.repair_notes,
        test_date: new Date()
      },
      create: {
        imei,
        working: data.working,
        defects: data.defects || data.screen_condition || data.body_condition,
        notes: data.notes,
        custom1: data.custom1 || data.repair_notes,
        test_date: new Date()
      }
    });
    
    // 4. Update Inventory table
    const location = data.location || 'Default Location';
    
    // Get current inventory count for this SKU and location
    const existingInventory = await tx.inventory.findUnique({
      where: { sku_location: { sku, location } }
    });
    
    if (existingInventory) {
      // Update existing inventory
      const newQtyTotal = existingInventory.qty_total + 1;
      const newPassDevices = existingInventory.pass_devices + (data.working === 'YES' ? 1 : 0);
      const newFailedDevices = existingInventory.failed_devices + (data.working === 'NO' ? 1 : 0);
      
      await tx.inventory.update({
        where: { id: existingInventory.id },
        data: {
          qty_total: newQtyTotal,
          pass_devices: newPassDevices,
          failed_devices: newFailedDevices,
          available: newQtyTotal - existingInventory.reserved,
          updated_at: new Date()
        }
      });
    } else {
      // Create new inventory record
      await tx.inventory.create({
        data: {
          sku,
          location,
          qty_total: 1,
          pass_devices: data.working === 'YES' ? 1 : 0,
          failed_devices: data.working === 'NO' ? 1 : 0,
          reserved: 0,
          available: 1
        }
      });
    }
  });
}

// PhoneCheck API call
async function fetchPhoneCheckData(imei: string): Promise<any> {
  try {
    const response = await axios.get(`${PHONECHECK_CONFIG.baseURL}/device/${imei}`, {
      auth: {
        username: PHONECHECK_CONFIG.username!,
        password: PHONECHECK_CONFIG.password!
      },
      timeout: 30000
    });
    
    return response.data;
  } catch (error) {
    logger.error(`PhoneCheck API error for IMEI ${imei}:`, error);
    throw error;
  }
}

// Enrich data with PhoneCheck API
async function enrichDataWithPhoneCheck(imei: string, existingData: any): Promise<any> {
  try {
    const phonecheckData = await fetchPhoneCheckData(imei);
    
    // Merge existing data with PhoneCheck data
    return {
      ...existingData,
      battery_health: phonecheckData.battery_health || existingData.battery_health,
      battery_count: phonecheckData.battery_cycle_count || existingData.battery_count,
      working: phonecheckData.working_status || existingData.working,
      defects: phonecheckData.defects || existingData.defects,
      notes: phonecheckData.notes || existingData.notes,
      // Add any other PhoneCheck specific fields
      phonecheck_data: phonecheckData
    };
  } catch (error) {
    logger.error(`Failed to enrich data for IMEI ${imei}:`, error);
    // Return existing data if enrichment fails
    return existingData;
  }
}

// Process bulk data job
bulkDataQueue.process('process-bulk-data', async (job) => {
  const { queueItemId, data, source, batchId } = job.data;
  
  try {
    // Update queue status to processing
    await prisma.dataQueue.update({
      where: { id: queueItemId },
      data: { status: 'processing' }
    });
    
    logger.info(`Processing bulk data batch: ${batchId} with ${data.length} items`);
    
    const results = {
      processed: 0,
      failed: 0,
      enriched: 0,
      errors: [] as string[]
    };
    
    // Process each item in the bulk data
    for (const item of data) {
      try {
        // Check if we have enough data
        const hasEnoughData = item.imei && item.model && item.capacity && item.color;
        
        if (!hasEnoughData && item.imei) {
          // Add to enrichment queue
          await dataEnrichmentQueue.add('enrich-data', {
            imei: item.imei,
            existingData: item,
            priority: 1
          });
          results.enriched++;
          continue;
        }
        
        // Process the data
        await processDataToDatabase(item);
        results.processed++;
        
      } catch (error) {
        logger.error(`Error processing item ${item.imei}:`, error);
        results.failed++;
        results.errors.push(`${item.imei}: ${error.message}`);
      }
    }
    
    // Update queue status to completed
    await prisma.dataQueue.update({
      where: { id: queueItemId },
      data: { 
        status: 'completed',
        processed_at: new Date()
      }
    });
    
    // Log processing results
    await prisma.queueProcessingLog.create({
      data: {
        queue_item_id: queueItemId,
        action: 'completed',
        message: `Processed ${results.processed} items, failed ${results.failed}, enriched ${results.enriched}`
      }
    });
    
    logger.info(`Completed processing batch ${batchId}: ${results.processed} processed, ${results.failed} failed, ${results.enriched} enriched`);
    
  } catch (error) {
    logger.error(`Error processing bulk data job ${queueItemId}:`, error);
    
    // Update queue status to failed
    await prisma.dataQueue.update({
      where: { id: queueItemId },
      data: { 
        status: 'failed',
        error_message: error.message
      }
    });
    
    // Log error
    await prisma.queueProcessingLog.create({
      data: {
        queue_item_id: queueItemId,
        action: 'failed',
        error: error.message
      }
    });
    
    throw error;
  }
});

// Process PhoneCheck job
phonecheckQueue.process('process-phonecheck', async (job) => {
  const { imei } = job.data;
  
  try {
    logger.info(`Processing PhoneCheck for IMEI: ${imei}`);
    
    const phonecheckData = await fetchPhoneCheckData(imei);
    
    // Transform PhoneCheck data to our format
    const transformedData = {
      imei,
      model: phonecheckData.model,
      brand: phonecheckData.brand,
      capacity: phonecheckData.storage,
      color: phonecheckData.color,
      carrier: phonecheckData.carrier,
      battery_health: phonecheckData.battery_health,
      battery_count: phonecheckData.battery_cycle_count,
      working: phonecheckData.working_status,
      defects: phonecheckData.defects,
      notes: phonecheckData.notes,
      location: 'Default Location'
    };
    
    // Process to database
    await processDataToDatabase(transformedData);
    
    logger.info(`Successfully processed PhoneCheck data for IMEI: ${imei}`);
    
  } catch (error) {
    logger.error(`Error processing PhoneCheck for IMEI ${imei}:`, error);
    throw error;
  }
});

// Process data enrichment job
dataEnrichmentQueue.process('enrich-data', async (job) => {
  const { imei, existingData } = job.data;
  
  try {
    logger.info(`Enriching data for IMEI: ${imei}`);
    
    const enrichedData = await enrichDataWithPhoneCheck(imei, existingData);
    
    // Process enriched data to database
    await processDataToDatabase(enrichedData);
    
    logger.info(`Successfully enriched and processed data for IMEI: ${imei}`);
    
  } catch (error) {
    logger.error(`Error enriching data for IMEI ${imei}:`, error);
    throw error;
  }
});

// Error handling for all queues
[bulkDataQueue, phonecheckQueue, dataEnrichmentQueue].forEach(queue => {
  queue.on('error', (error) => {
    logger.error(`Queue error:`, error);
  });
  
  queue.on('failed', (job, error) => {
    logger.error(`Job ${job.id} failed:`, error);
  });
  
  queue.on('completed', (job) => {
    logger.info(`Job ${job.id} completed successfully`);
  });
});

// Start the queue processor
logger.info('Queue processor started');

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down queue processor...');
  await Promise.all([
    bulkDataQueue.close(),
    phonecheckQueue.close(),
    dataEnrichmentQueue.close()
  ]);
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down queue processor...');
  await Promise.all([
    bulkDataQueue.close(),
    phonecheckQueue.close(),
    dataEnrichmentQueue.close()
  ]);
  await prisma.$disconnect();
  process.exit(0);
});
