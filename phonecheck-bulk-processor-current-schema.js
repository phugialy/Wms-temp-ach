const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseApiKey = process.env['SUPABASE_API_KEY'];

if (!supabaseUrl || !supabaseApiKey) {
  console.error('❌ Supabase URL or API Key not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseApiKey);

/**
 * Production-Ready Bulk PhoneCheck Processor for Current Schema
 * Handles real PhoneCheck data and processes it into Item, Inventory, and DeviceTest tables
 */
class PhoneCheckBulkProcessor {
  
  constructor() {
    this.batchSize = 50; // Optimal batch size for performance
  }

  /**
   * Process PhoneCheck data from your bulk API
   * @param {Array} phonecheckData - Array of PhoneCheck API responses
   * @returns {Object} Processing result with statistics
   */
  async processPhoneCheckBulkData(phonecheckData) {
    const startTime = Date.now();
    const result = {
      success: true,
      processed: 0,
      errors: [],
      details: {
        itemsCreated: 0,
        itemsUpdated: 0,
        inventoryCreated: 0,
        inventoryUpdated: 0,
        deviceTestsCreated: 0,
        deviceTestsUpdated: 0
      },
      performance: {
        totalTime: 0,
        averageTimePerItem: 0,
        itemsPerSecond: 0
      }
    };

    try {
      console.log(`🚀 Starting PhoneCheck bulk processing for ${phonecheckData.length} items`);
      console.log(`📊 Estimated processing time: ${Math.ceil(phonecheckData.length / this.batchSize)} batches × ~2s`);

      // Transform PhoneCheck data to our format
      const transformedData = this.transformPhoneCheckData(phonecheckData);
      
      // Step 1: Process Items
      console.log('\n📱 Step 1: Processing Items...');
      await this.processItemsBatch(transformedData, result);

      // Step 2: Process Inventory
      console.log('\n📦 Step 2: Processing Inventory...');
      await this.processInventoryBatch(transformedData, result);

      // Step 3: Process Device Tests
      console.log('\n🧪 Step 3: Processing Device Tests...');
      await this.processDeviceTestsBatch(transformedData, result);

      const processingTime = Date.now() - startTime;
      result.performance.totalTime = processingTime;
      result.performance.averageTimePerItem = processingTime / phonecheckData.length;
      result.performance.itemsPerSecond = Math.round((phonecheckData.length / processingTime) * 1000);

      console.log(`\n✅ Bulk processing completed in ${processingTime}ms`);
      console.log(`📈 Performance: ${result.performance.itemsPerSecond} items/second`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Bulk processing failed', { error: errorMessage });
      result.success = false;
      result.errors.push(errorMessage);
    }

    return result;
  }

  /**
   * Transform PhoneCheck API data to our database format
   * @param {Array} phonecheckData - Raw PhoneCheck API responses
   * @returns {Array} Transformed data ready for database insertion
   */
  transformPhoneCheckData(phonecheckData) {
    return phonecheckData.map(item => {
      // Extract data from PhoneCheck response
      const phonecheckResponse = item.data || item;
      
      return {
        imei: phonecheckResponse.imei || phonecheckResponse.IMEI,
        name: phonecheckResponse.device_name || phonecheckResponse.deviceName || phonecheckResponse.model,
        brand: phonecheckResponse.brand || phonecheckResponse.Brand,
        model: phonecheckResponse.model || phonecheckResponse.Model,
        carrier: phonecheckResponse.carrier || phonecheckResponse.Carrier,
        color: phonecheckResponse.color || phonecheckResponse.Color,
        storage: phonecheckResponse.storage || phonecheckResponse.Storage,
        condition: phonecheckResponse.condition || phonecheckResponse.Condition || 'UNKNOWN',
        batteryHealth: phonecheckResponse.battery_health || phonecheckResponse.batteryHealth,
        screenCondition: phonecheckResponse.screen_condition || phonecheckResponse.screenCondition,
        bodyCondition: phonecheckResponse.body_condition || phonecheckResponse.bodyCondition,
        working: phonecheckResponse.working || phonecheckResponse.Working || 'PENDING',
        testResults: phonecheckResponse.test_results || phonecheckResponse.testResults || phonecheckResponse,
        // Generate SKU
        sku: this.generateSku(phonecheckResponse)
      };
    });
  }

  /**
   * Generate SKU based on device attributes
   */
  generateSku(phonecheckData) {
    const brand = (phonecheckData.brand || phonecheckData.Brand || 'UNKNOWN').toUpperCase();
    const model = (phonecheckData.model || phonecheckData.Model || 'UNKNOWN').toUpperCase();
    const storage = (phonecheckData.storage || phonecheckData.Storage || 'UNKNOWN').toUpperCase();
    const color = (phonecheckData.color || phonecheckData.Color || 'UNKNOWN').toUpperCase();
    const carrier = (phonecheckData.carrier || phonecheckData.Carrier || 'UNLOCKED').toUpperCase();
    
    return `${brand}-${model}-${storage}-${color}-${carrier}`;
  }

  /**
   * Process Items in batches
   */
  async processItemsBatch(transformedData, result) {
    const batches = this.createBatches(transformedData, this.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`  📱 Processing Items batch ${i + 1}/${batches.length} (${batch.length} items)...`);
      
      try {
        const itemsToUpsert = batch.map(item => ({
          imei: item.imei,
          sku: item.sku,
          name: item.name,
          description: `${item.brand} ${item.model} ${item.storage} ${item.color}`,
          brand: item.brand,
          model: item.model,
          grade: 'used',
          working: item.working,
          type: 'PHONE',
          carrier: item.carrier,
          color: item.color,
          storage: item.storage,
          condition: item.condition,
          batteryHealth: item.batteryHealth,
          screenCondition: item.screenCondition,
          bodyCondition: item.bodyCondition,
          testResults: item.testResults,
          defects: item.defects,
          notes: item.notes,
          custom1: item.custom1,
          isActive: true
        }));

        const { data, error } = await supabase
          .from('Item')
          .upsert(itemsToUpsert, { 
            onConflict: 'imei',
            ignoreDuplicates: false 
          })
          .select();

        if (error) {
          throw new Error(`Items batch ${i + 1} error: ${error.message}`);
        }

        // Count created vs updated
        const created = data.filter(item => item.createdAt === item.updatedAt).length;
        const updated = data.length - created;
        
        result.details.itemsCreated += created;
        result.details.itemsUpdated += updated;
        result.processed += batch.length;

        console.log(`    ✅ Items batch ${i + 1} completed: ${created} created, ${updated} updated`);

      } catch (error) {
        const errorMessage = `Items batch ${i + 1}: ${error.message}`;
        console.error(`    ❌ ${errorMessage}`);
        result.errors.push(errorMessage);
      }
    }
  }

  /**
   * Process Inventory in batches
   */
  async processInventoryBatch(transformedData, result) {
    const batches = this.createBatches(transformedData, this.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`  📦 Processing Inventory batch ${i + 1}/${batches.length} (${batch.length} items)...`);
      
      try {
        // Get location ID (use first available location)
        const { data: locations } = await supabase
          .from('Location')
          .select('id')
          .limit(1);

        if (!locations || locations.length === 0) {
          throw new Error('No locations found. Please create a location first.');
        }

        const locationId = locations[0].id;

        // Get item IDs for this batch
        const imeis = batch.map(item => item.imei);
        const { data: items } = await supabase
          .from('Item')
          .select('id, imei')
          .in('imei', imeis);

        const itemMap = new Map(items.map(item => [item.imei, item.id]));

        const inventoryToUpsert = batch
          .filter(item => itemMap.has(item.imei))
          .map(item => ({
            itemId: itemMap.get(item.imei),
            locationId: locationId,
            sku: item.sku,
            quantity: 1,
            reserved: 0,
            available: 1
          }));

        if (inventoryToUpsert.length === 0) {
          console.log(`    ⚠️  No valid items found for inventory batch ${i + 1}`);
          continue;
        }

        const { data, error } = await supabase
          .from('Inventory')
          .upsert(inventoryToUpsert, { 
            onConflict: 'itemId,locationId',
            ignoreDuplicates: false 
          })
          .select();

        if (error) {
          throw new Error(`Inventory batch ${i + 1} error: ${error.message}`);
        }

        // Count created vs updated
        const created = data.filter(inv => inv.updatedAt === inv.createdAt).length;
        const updated = data.length - created;
        
        result.details.inventoryCreated += created;
        result.details.inventoryUpdated += updated;

        console.log(`    ✅ Inventory batch ${i + 1} completed: ${created} created, ${updated} updated`);

      } catch (error) {
        const errorMessage = `Inventory batch ${i + 1}: ${error.message}`;
        console.error(`    ❌ ${errorMessage}`);
        result.errors.push(errorMessage);
      }
    }
  }

  /**
   * Process Device Tests in batches
   */
  async processDeviceTestsBatch(transformedData, result) {
    const batches = this.createBatches(transformedData, this.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`  🧪 Processing Device Tests batch ${i + 1}/${batches.length} (${batch.length} items)...`);
      
      try {
        // Get item IDs for this batch
        const imeis = batch.map(item => item.imei);
        const { data: items } = await supabase
          .from('Item')
          .select('id, imei')
          .in('imei', imeis);

        const itemMap = new Map(items.map(item => [item.imei, item.id]));

        const deviceTestsToInsert = batch
          .filter(item => itemMap.has(item.imei))
          .map(item => ({
            itemId: itemMap.get(item.imei),
            testType: 'PHONECHECK',
            testResults: item.testResults,
            passed: item.working === 'YES',
            notes: `PhoneCheck test for ${item.brand} ${item.model}`,
            testedBy: 'SYSTEM'
          }));

        if (deviceTestsToInsert.length === 0) {
          console.log(`    ⚠️  No valid items found for device tests batch ${i + 1}`);
          continue;
        }

        const { data, error } = await supabase
          .from('DeviceTest')
          .insert(deviceTestsToInsert)
          .select();

        if (error) {
          throw new Error(`Device Tests batch ${i + 1} error: ${error.message}`);
        }

        result.details.deviceTestsCreated += data.length;

        console.log(`    ✅ Device Tests batch ${i + 1} completed: ${data.length} created`);

      } catch (error) {
        const errorMessage = `Device Tests batch ${i + 1}: ${error.message}`;
        console.error(`    ❌ ${errorMessage}`);
        result.errors.push(errorMessage);
      }
    }
  }

  /**
   * Create batches from array
   */
  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats() {
    try {
      const { data: items } = await supabase
        .from('Item')
        .select('id', { count: 'exact' });

      const { data: inventory } = await supabase
        .from('Inventory')
        .select('id', { count: 'exact' });

      const { data: deviceTests } = await supabase
        .from('DeviceTest')
        .select('id', { count: 'exact' });

      return {
        items: items?.length || 0,
        inventory: inventory?.length || 0,
        deviceTests: deviceTests?.length || 0
      };
    } catch (error) {
      console.error('Error getting processing stats:', error.message);
      return { items: 0, inventory: 0, deviceTests: 0 };
    }
  }

  /**
   * Get items with PhoneCheck data
   */
  async getItemsWithPhoneCheck() {
    try {
      const { data, error } = await supabase
        .from('Item')
        .select(`
          id,
          imei,
          sku,
          name,
          brand,
          model,
          condition,
          batteryHealth,
          working,
          testResults,
          Inventory (
            id,
            quantity,
            available,
            reserved
          ),
          DeviceTest (
            id,
            testType,
            passed,
            testDate
          )
        `)
        .eq('type', 'PHONE')
        .order('createdAt', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting items with PhoneCheck:', error.message);
      return [];
    }
  }
}

/**
 * Example usage with mock PhoneCheck data
 */
async function processPhoneCheckBulkExample() {
  console.log('📱 PhoneCheck Bulk Processor - Example Usage\n');

  const processor = new PhoneCheckBulkProcessor();

  // Get current stats
  const currentStats = await processor.getProcessingStats();
  console.log('📊 Current Database Stats:', currentStats);

  // Mock PhoneCheck data (replace with your real API data)
  const mockPhoneCheckData = [
    {
      imei: '123456789012345',
      device_name: 'iPhone 14',
      brand: 'Apple',
      model: 'iPhone 14',
      carrier: 'Unlocked',
      color: 'Black',
      storage: '128GB',
      condition: 'USED',
      battery_health: 85,
      screen_condition: 'GOOD',
      body_condition: 'GOOD',
      working: 'YES',
      test_results: { status: 'PASS', batteryHealth: 85, condition: 'GOOD' }
    },
    {
      imei: '987654321098765',
      device_name: 'Samsung Galaxy S23',
      brand: 'Samsung',
      model: 'Galaxy S23',
      carrier: 'Verizon',
      color: 'White',
      storage: '256GB',
      condition: 'NEW',
      battery_health: 100,
      screen_condition: 'EXCELLENT',
      body_condition: 'EXCELLENT',
      working: 'YES',
      test_results: { status: 'PASS', batteryHealth: 100, condition: 'NEW' }
    }
  ];

  console.log(`📝 Processing ${mockPhoneCheckData.length} PhoneCheck records...`);

  // Process the data
  const result = await processor.processPhoneCheckBulkData(mockPhoneCheckData);

  // Display results
  console.log('\n📈 Processing Results:');
  console.log(`  ✅ Success: ${result.success}`);
  console.log(`  📦 Processed: ${result.processed} items`);
  console.log(`  ❌ Errors: ${result.errors.length}`);
  console.log(`  ⏱️  Total Time: ${result.performance.totalTime}ms`);
  console.log(`  🚀 Items/Second: ${result.performance.itemsPerSecond}`);

  if (result.errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    result.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  }

  // Get final stats
  const finalStats = await processor.getProcessingStats();
  console.log('\n📊 Final Database Stats:', finalStats);

  // Show some processed items
  const itemsWithPhoneCheck = await processor.getItemsWithPhoneCheck();
  if (itemsWithPhoneCheck.length > 0) {
    console.log('\n📱 Sample Processed Items:');
    itemsWithPhoneCheck.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.brand} ${item.model} (${item.imei})`);
      console.log(`     Condition: ${item.condition}, Battery: ${item.batteryHealth}%`);
      console.log(`     Working: ${item.working}, Inventory: ${item.Inventory?.length || 0} records`);
      console.log(`     Tests: ${item.DeviceTest?.length || 0} records`);
    });
  }

  console.log('\n✅ PhoneCheck bulk processing example completed!');
}

// Export for use in other modules
module.exports = { PhoneCheckBulkProcessor, processPhoneCheckBulkExample };

// Run example if called directly
if (require.main === module) {
  processPhoneCheckBulkExample().catch(console.error);
}
