const { Client } = require('pg');
const EventEmitter = require('events');
const SkuMatchingService = require('../services/skuMatchingService');
require('dotenv').config();

class BulkDataProcessor extends EventEmitter {
  constructor() {
    super();
    this.client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    this.isProcessing = false;
    this.queue = [];
    this.maxRetries = 3;
  }

  async connect() {
    try {
      await this.client.connect();
      console.log('✅ Bulk data processor connected to database');
    } catch (error) {
      console.error('❌ Failed to connect bulk data processor:', error);
      throw error;
    }
  }

  // Add bulk data to queue
  async addBulkData(bulkData) {
    console.log(`📦 Adding ${bulkData.length} items to processing queue...`);
    
    // Log the bulk data to queue_processing_log
    await this.logBulkDataReceived(bulkData);
    
    // Add each item to the processing queue
    for (const item of bulkData) {
      this.queue.push({
        data: item,
        retries: 0,
        timestamp: new Date()
      });
    }
    
    console.log(`✅ Added ${bulkData.length} items to queue. Total queue size: ${this.queue.length}`);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  // Process the queue
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`🔄 Starting queue processing. Items in queue: ${this.queue.length}`);

    while (this.queue.length > 0) {
      const queueItem = this.queue.shift();
      
      try {
        await this.processItem(queueItem.data);
        console.log(`✅ Processed item: ${queueItem.data.imei || 'Unknown IMEI'}`);
        
        // Emit success event
        this.emit('itemProcessed', {
          success: true,
          imei: queueItem.data.imei,
          message: 'Item processed successfully'
        });
        
      } catch (error) {
        console.error(`❌ Error processing item:`, error.message);
        
        // Retry logic
        if (queueItem.retries < this.maxRetries) {
          queueItem.retries++;
          console.log(`🔄 Retrying item (attempt ${queueItem.retries}/${this.maxRetries}): ${queueItem.data.imei || 'Unknown IMEI'}`);
          this.queue.unshift(queueItem); // Add back to front of queue
        } else {
          console.error(`❌ Max retries exceeded for item: ${queueItem.data.imei || 'Unknown IMEI'}`);
          
          // Log failed item
          await this.logFailedItem(queueItem.data, error.message);
          
          // Emit failure event
          this.emit('itemFailed', {
            success: false,
            imei: queueItem.data.imei,
            error: error.message,
            retries: queueItem.retries
          });
        }
      }
    }

    this.isProcessing = false;
    console.log('✅ Queue processing completed');
    this.emit('queueCompleted');
  }

  // Process individual item
  async processItem(itemData) {
    console.log(`🔄 Processing item: ${itemData.imei || 'Unknown IMEI'}`);
    
    // Start transaction
    await this.client.query('BEGIN');
    
    try {
      // Step 1: Enrich data with Phonecheck API if needed
      console.log(`📞 Step 1: Enriching data for IMEI ${itemData.imei}`);
      const enrichedData = await this.enrichWithPhonecheckAPI(itemData);
      
      // Step 2: Generate SKU
      console.log(`🏷️ Step 2: Generating SKU for IMEI ${itemData.imei}`);
      const sku = this.generateSKU(enrichedData);
      
      // Step 3: Insert into product table (PARENT TABLE)
      console.log(`📦 Step 3: Inserting into product table for IMEI ${itemData.imei}`);
      await this.insertProduct(enrichedData, sku);
      
      // Step 4: Insert into item table (CHILD TABLE - references product)
      console.log(`📱 Step 4: Inserting into item table for IMEI ${itemData.imei}`);
      await this.insertItem(enrichedData);
      
      // Step 5: Insert into device_test table (CHILD TABLE - references product)
      console.log(`🧪 Step 5: Inserting into device_test table for IMEI ${itemData.imei}`);
      await this.insertDeviceTest(enrichedData);
      
      // Step 6: Insert into movement_history table (CHILD TABLE - references product)
      console.log(`📍 Step 6: Inserting into movement_history table for IMEI ${itemData.imei}`);
      await this.insertMovementHistory(enrichedData);
      
      // Step 7: Update inventory table (AGGREGATE TABLE - based on SKU)
      console.log(`📊 Step 7: Updating inventory table for SKU ${sku}`);
      await this.updateInventory(enrichedData, sku);
      
      // Commit transaction
      await this.client.query('COMMIT');
      
      console.log(`✅ Successfully processed item: ${enrichedData.imei} -> SKU: ${sku}`);
      
    } catch (error) {
      await this.client.query('ROLLBACK');
      console.error(`❌ Transaction failed for IMEI ${itemData.imei}:`, error.message);
      throw error;
    }
  }

  // Enrich and correct data with Phonecheck API
  async enrichWithPhonecheckAPI(itemData) {
    console.log(`📞 Processing and enriching data for IMEI: ${itemData.imei}`);
    
    // CRITICAL FIX: The frontend already processed the data correctly (54 success, 0 errors)
    // DO NOT call Phonecheck API again as it returns null values and overwrites good data
    console.log(`✅ Using frontend processed data for IMEI ${itemData.imei} - frontend already processed this correctly`);
    console.log(`🔒 SKIPPING Phonecheck API call to preserve frontend's processed data`);
    
    // Apply data corrections and standardizations to the frontend's processed data
    // BUT preserve the working status that the frontend already determined correctly
    const correctedData = this.correctAndStandardizeData(itemData);
    
    // CRITICAL: Preserve the frontend's working status if it's already correct
    if (itemData.working && itemData.working !== 'PENDING' && itemData.working !== 'Unknown') {
      correctedData.working = itemData.working;
      console.log(`🔒 Preserving frontend's working status: ${itemData.working}`);
    }
    
    console.log(`✅ Final corrected data for IMEI ${itemData.imei}:`, {
      model: correctedData.model,
      brand: correctedData.brand,
      capacity: correctedData.capacity,
      color: correctedData.color,
      carrier: correctedData.carrier,
      working: correctedData.working,
      battery_health: correctedData.battery_health,
      battery_count: correctedData.battery_count
    });
    
    return correctedData;
  }

  // Correct and standardize data format
  correctAndStandardizeData(data) {
    const corrected = { ...data };
    
    // Standardize working status
    if (corrected.working) {
      const working = corrected.working.toString().toUpperCase();
      if (working.includes('YES') || working.includes('PASS') || working.includes('GOOD')) {
        corrected.working = 'YES';
      } else if (working.includes('NO') || working.includes('FAIL') || working.includes('BAD')) {
        corrected.working = 'NO';
      } else {
        corrected.working = 'PENDING';
      }
    } else {
      corrected.working = 'PENDING';
    }
    
    // Standardize carrier
    if (corrected.carrier) {
      const carrier = corrected.carrier.toString().toUpperCase();
      if (carrier.includes('UNLOCKED') || carrier.includes('UNL')) {
        corrected.carrier = 'Unlocked';
      } else if (carrier.includes('ATT') || carrier.includes('AT&T')) {
        corrected.carrier = 'AT&T';
      } else if (carrier.includes('TMOBILE') || carrier.includes('T-MOBILE')) {
        corrected.carrier = 'T-Mobile';
      } else if (carrier.includes('VERIZON') || carrier.includes('VZW')) {
        corrected.carrier = 'Verizon';
      } else {
        corrected.carrier = 'Unlocked';
      }
    } else {
      corrected.carrier = 'Unlocked';
    }
    
    // Clean battery health
    if (corrected.battery_health) {
      const health = corrected.battery_health.toString();
      if (health.includes('not supported') || health.includes('N/A') || health.includes('BCC')) {
        corrected.battery_health = null;
      } else {
        // Extract percentage if present
        const match = health.match(/(\d+)%/);
        corrected.battery_health = match ? `${match[1]}%` : health;
      }
    }
    
    // Clean battery count - handle "BCC" specifically
    if (corrected.battery_count) {
      const count = corrected.battery_count.toString();
      if (count === 'BCC' || count.includes('BCC') || count.includes('N/A') || count.includes('not supported')) {
        corrected.battery_count = null; // Set to null for "BCC" values
      } else {
        // Try to extract number if present
        const match = count.match(/(\d+)/);
        corrected.battery_count = match ? parseInt(match[1]) : null;
      }
    } else {
      corrected.battery_count = null;
    }
    
    // Ensure required fields have fallbacks
    corrected.model = corrected.model || 'Unknown Model';
    
    // Enhanced brand detection - try to infer brand from model if not provided
    if (!corrected.brand || corrected.brand === 'Unknown' || corrected.brand === 'Unknown Brand') {
      if (corrected.model && corrected.model.toLowerCase().includes('galaxy')) {
        corrected.brand = 'Samsung';
      } else if (corrected.model && (corrected.model.toLowerCase().includes('iphone') || corrected.model.toLowerCase().includes('ipad'))) {
        corrected.brand = 'Apple';
      } else if (corrected.model && corrected.model.toLowerCase().includes('pixel')) {
        corrected.brand = 'Google';
      } else {
        corrected.brand = 'Unknown';
      }
    }
    
    corrected.capacity = corrected.capacity || corrected.storage || 'N/A';
    corrected.color = corrected.color || corrected.colour || 'N/A';
    corrected.location = corrected.location || 'DNCL-Inspection';
    
    return corrected;
  }

  // Real Phonecheck API call
  async callPhonecheckAPI(imei) {
    try {
      // Get authentication token
      const authResponse = await fetch('https://api.phonecheck.com/v2/auth/master/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: process.env.PHONECHECK_USERNAME || 'dncltechzoneinc',
          password: process.env.PHONECHECK_PASSWORD || '@Ustvmos817'
        })
      });

      if (!authResponse.ok) {
        throw new Error(`Authentication failed: ${authResponse.status}`);
      }

      const authData = await authResponse.json();
      const token = authData.token;

      // Get device details
      const deviceResponse = await fetch(`https://api.phonecheck.com/v2/master/imei/device-info-legacy/${imei}?detailed=true`, {
        method: 'GET',
        headers: { 'token_master': token }
      });

      if (!deviceResponse.ok) {
        throw new Error(`Device lookup failed: ${deviceResponse.status}`);
      }

      const deviceData = await deviceResponse.json();
      
      // Handle array response from Phonecheck API
      const device = Array.isArray(deviceData) ? deviceData[0] : deviceData;
      
      // Map Phonecheck API response to our format
      const mappedData = {
        model: device.Model || device.model || null,
                 brand: device.Make || device.make || device.Brand || device.brand || null,
         capacity: device.Capacity || device.capacity || device.Storage || device.storage || device.Memory || device.memory || null,
         model_number: device['Model#'] || device.modelNumber || device.ModelNumber || null,
        color: device.Color || device.color || null,
        carrier: device.Carrier || device.carrier || 'Unlocked',
        battery_health: device.BatteryHealthPercentage || device.battery_health || null,
        battery_count: device.BatteryCycle || device.battery_count || null,
        working: device.Working || device.working || 'PENDING',
        defects: device.Failed || device.failed || null,
        notes: device.Notes || device.notes || null,
        custom1: device.Custom1 || device.custom1 || null
      };
      
      console.log(`📞 Phonecheck API response for ${imei}:`, mappedData);
      return mappedData;
      
    } catch (error) {
      console.warn(`⚠️ Phonecheck API failed for IMEI ${imei}:`, error.message);
      // Return fallback data if API fails
      return {
        model: null,
        brand: null,
        capacity: null,
        color: null,
        carrier: 'Unlocked',
        battery_health: null,
        battery_count: null,
        working: 'PENDING'
      };
    }
  }

  // Generate SKU from device data (matching inventory view format)
  generateSKU(data) {
    const model = data.model || 'Unknown';
    const capacity = data.capacity || data.storage || 'N/A';
    const color = data.color || data.colour || 'N/A';
    const carrier = data.carrier || null; // Allow null for carrier
    
    // Clean and format components
    const cleanModel = model.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
    const cleanCapacity = capacity.toString().replace(/\s+/g, '').toUpperCase();
    
         // Enhanced color processing - limit to 10 characters and handle abbreviations
     let cleanColor = color.replace(/\s+/g, '').toUpperCase();
     
     // Handle Phantom colors properly - don't truncate if it's a phantom color
     if (cleanColor.includes('PHANTOM')) {
       // For phantom colors, we need to preserve the full name to determine the actual color
       if (cleanColor.includes('PHANTOMBLACK')) cleanColor = 'BLK';
       else if (cleanColor.includes('PHANTOMGREEN')) cleanColor = 'GRN';
       else if (cleanColor.includes('PHANTOMBLUE')) cleanColor = 'BLU';
       else if (cleanColor.includes('PHANTOMWHITE')) cleanColor = 'WHT';
       else if (cleanColor.includes('PHANTOMRED')) cleanColor = 'RED';
       else if (cleanColor === 'PHA' || cleanColor === 'PHANTOM') cleanColor = 'UNKNOWN';
       else cleanColor = 'UNKNOWN'; // For any other phantom color we can't identify
     } else {
       // For non-phantom colors, apply the 10-character limit
       if (cleanColor.length > 10) {
         cleanColor = cleanColor.substring(0, 10);
       }
     }
    
    // Enhanced carrier processing - default to UNLOCKED when empty/null
    let cleanCarrier = 'UNLOCKED'; // Default for unlocked devices
    if (carrier && carrier.trim() !== '') {
      cleanCarrier = carrier.replace(/\s+/g, '').toUpperCase();
      // Limit carrier to reasonable length
      if (cleanCarrier.length > 10) {
        cleanCarrier = cleanCarrier.substring(0, 10);
      }
    }
    
    // Generate SKU in format: Model-Capacity-Color-Carrier
    const sku = `${cleanModel}-${cleanCapacity}-${cleanColor}-${cleanCarrier}`;
    
    console.log(`🏷️ Generated SKU for ${data.imei}: ${sku}`);
    console.log(`   Model: ${cleanModel}, Capacity: ${cleanCapacity}, Color: ${cleanColor}, Carrier: ${cleanCarrier}`);
    return sku;
  }

  // Insert into product table
  async insertProduct(data, sku) {
    const query = `
      INSERT INTO product (imei, date_in, sku, brand, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (imei) DO UPDATE SET
        sku = EXCLUDED.sku,
        brand = EXCLUDED.brand,
        updated_at = NOW()
    `;
    
    await this.client.query(query, [
      data.imei,
      data.date_in || new Date(),
      sku,
      data.brand || 'Unknown'
    ]);
  }

  // Insert into item table
  async insertItem(data) {
    // Handle battery_count - "BCC" should be null
    let batteryCount = null;
    if (data.battery_count && data.battery_count !== 'BCC') {
      // Try to extract number if it's a string with numbers
      const countStr = data.battery_count.toString();
      const match = countStr.match(/(\d+)/);
      batteryCount = match ? parseInt(match[1]) : null;
    }

    const query = `
      INSERT INTO item (imei, model, model_number, carrier, capacity, color, battery_health, battery_count, working, location, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (imei) DO UPDATE SET
        model = EXCLUDED.model,
        model_number = EXCLUDED.model_number,
        carrier = EXCLUDED.carrier,
        capacity = EXCLUDED.capacity,
        color = EXCLUDED.color,
        battery_health = EXCLUDED.battery_health,
        battery_count = EXCLUDED.battery_count,
        working = EXCLUDED.working,
        location = EXCLUDED.location,
        updated_at = NOW()
    `;
    
    await this.client.query(query, [
      data.imei,
      data.model || null,
      data.model_number || null,
      data.carrier || 'Unlocked',
      data.capacity || data.storage || null,
      data.color || data.colour || null,
      data.battery_health || null,
      batteryCount, // This will be null for "BCC" values
      data.working || 'PENDING',
      data.location || 'DNCL-Inspection'
    ]);
  }

  // Insert into device_test table
  async insertDeviceTest(data) {
    const query = `
      INSERT INTO device_test (imei, working, defects, notes, custom1, test_date, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (imei) DO UPDATE SET
        working = EXCLUDED.working,
        defects = EXCLUDED.defects,
        notes = EXCLUDED.notes,
        custom1 = EXCLUDED.custom1,
        test_date = EXCLUDED.test_date
    `;
    
    await this.client.query(query, [
      data.imei,
      data.working || 'PENDING',
      data.defects || null,
      data.notes || null,
      data.custom1 || null,
      data.test_date || new Date()
    ]);
  }

  // Insert into movement_history table
  async insertMovementHistory(data) {
    const query = `
      INSERT INTO movement_history (imei, location_original, location_updated, movement_date, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `;
    
    await this.client.query(query, [
      data.imei,
      'Initiated',
      data.location || 'DNCL-Inspection',
      new Date()
    ]);
  }

  // Update inventory table
  async updateInventory(data, sku) {
    // First, try to update existing inventory record
    const updateQuery = `
      UPDATE inventory 
      SET 
        qty_total = qty_total + 1,
        pass_devices = pass_devices + CASE WHEN $1 IN ('YES', 'PASS') THEN 1 ELSE 0 END,
        failed_devices = failed_devices + CASE WHEN $1 IN ('NO', 'FAILED') THEN 1 ELSE 0 END,
        available = available + 1,
        updated_at = NOW()
      WHERE sku = $2
    `;
    
    const updateResult = await this.client.query(updateQuery, [data.working || 'PENDING', sku]);
    
    // If no rows were updated, insert new inventory record
    if (updateResult.rowCount === 0) {
      const insertQuery = `
        INSERT INTO inventory (sku, location, qty_total, pass_devices, failed_devices, reserved, available, created_at, updated_at)
        VALUES ($1, $2, 1, $3, $4, 0, 1, NOW(), NOW())
      `;
      
      const passCount = (data.working || 'PENDING') === 'YES' || (data.working || 'PENDING') === 'PASS' ? 1 : 0;
      const failCount = (data.working || 'PENDING') === 'NO' || (data.working || 'PENDING') === 'FAILED' ? 1 : 0;
      
      await this.client.query(insertQuery, [
        sku,
        data.location || 'DNCL-Inspection',
        passCount,
        failCount
      ]);
    }
  }

  // Log bulk data received
  async logBulkDataReceived(bulkData) {
    const query = `
      INSERT INTO queue_processing_log (action, message, created_at)
      VALUES ($1, $2, NOW())
    `;
    
    await this.client.query(query, [
      'BULK_DATA_RECEIVED',
      `Received ${bulkData.length} items for processing`
    ]);
  }

  // Log failed item
  async logFailedItem(itemData, errorMessage) {
    const query = `
      INSERT INTO queue_processing_log (action, message, error, created_at)
      VALUES ($1, $2, $3, NOW())
    `;
    
    await this.client.query(query, [
      'ITEM_PROCESSING_FAILED',
      `Failed to process IMEI: ${itemData.imei}`,
      errorMessage
    ]);
  }

  // Get queue status
  getQueueStatus() {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.queue.length,
      totalProcessed: 0, // You could track this if needed
      maxRetries: this.maxRetries
    };
  }

  // Close database connection
  async close() {
    await this.client.end();
    console.log('✅ Bulk data processor disconnected from database');
  }
}

module.exports = BulkDataProcessor;
