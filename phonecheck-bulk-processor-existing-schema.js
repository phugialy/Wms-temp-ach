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
 * Production-Ready Bulk PhoneCheck Processor
 * Works with your existing schema: Item, Inventory, DeviceTest tables
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
        deviceTestsCreated: 0
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
      
      // Step 1: Process Items (main item table)
      console.log('\n📱 Step 1: Processing Items...');
      await this.processItemsBatch(transformedData, result);

      // Step 2: Process Inventory
      console.log('\n📦 Step 2: Processing Inventory...');
      await this.processInventoryBatch(transformedData, result);

      // Step 3: Process Device Tests (PhoneCheck results)
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
        storage: phonecheckResponse.storage || phonecheckResponse.Storage || phonecheckResponse.capacity,
        color: phonecheckResponse.color || phonecheckResponse.Color,
        carrier: phonecheckResponse.carrier || phonecheckResponse.Carrier || phonecheckResponse.network,
        working: phonecheckResponse.working_status || phonecheckResponse.workingStatus || phonecheckResponse.status || 'YES',
        batteryHealth: parseInt(phonecheckResponse.battery_health || phonecheckResponse.batteryHealth || phonecheckResponse.battery || '85'),
        condition: phonecheckResponse.condition || phonecheckResponse.Condition || 'USED',
        screenCondition: phonecheckResponse.screen_condition || phonecheckResponse.screenCondition || 'GOOD',
        bodyCondition: phonecheckResponse.body_condition || phonecheckResponse.bodyCondition || 'GOOD',
        testResults: phonecheckResponse, // Store full PhoneCheck response
        sku: this.generateSku(phonecheckResponse),
        type: 'PHONE',
        grade: 'used',
        isActive: true
      };
    });
  }

  async processItemsBatch(data, result) {
    const totalBatches = Math.ceil(data.length / this.batchSize);
    
    for (let i = 0; i < data.length; i += this.batchSize) {
      const batch = data.slice(i, i + this.batchSize);
      const batchNumber = Math.floor(i / this.batchSize) + 1;
      
      try {
        console.log(`  📱 Processing Items batch ${batchNumber}/${totalBatches} (${batch.length} items)...`);
        
        const { error } = await supabase
          .from('Item')
          .upsert(
            batch.map(item => ({
              imei: item.imei,
              sku: item.sku,
              name: item.name,
              description: `${item.brand} ${item.model} ${item.storage} ${item.color}`,
              brand: item.brand,
              model: item.model,
              grade: item.grade,
              working: item.working,
              type: item.type,
              carrier: item.carrier,
              color: item.color,
              storage: item.storage,
              condition: item.condition,
              batteryHealth: item.batteryHealth,
              screenCondition: item.screenCondition,
              bodyCondition: item.bodyCondition,
              testResults: item.testResults,
              isActive: item.isActive,
              updatedAt: new Date().toISOString()
            })),
            { 
              onConflict: 'imei',
              ignoreDuplicates: false 
            }
          );

        if (error) {
          throw new Error(`Items batch error: ${error.message}`);
        }

        result.details.itemsCreated += batch.length;
        result.processed += batch.length;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Items batch ${batchNumber}: ${errorMessage}`);
        console.error(`  ❌ Items batch ${batchNumber} error:`, errorMessage);
      }
    }
  }

  async processInventoryBatch(data, result) {
    const totalBatches = Math.ceil(data.length / this.batchSize);
    
    for (let i = 0; i < data.length; i += this.batchSize) {
      const batch = data.slice(i, i + this.batchSize);
      const batchNumber = Math.floor(i / this.batchSize) + 1;
      
      try {
        console.log(`  📦 Processing Inventory batch ${batchNumber}/${totalBatches} (${batch.length} items)...`);
        
        // First, get the item IDs for the IMEIs
        const imeis = batch.map(item => item.imei);
        const { data: items, error: itemsError } = await supabase
          .from('Item')
          .select('id, imei')
          .in('imei', imeis);

        if (itemsError) {
          throw new Error(`Error fetching items: ${itemsError.message}`);
        }

        // Create a map of IMEI to item ID
        const imeiToItemId = {};
        items.forEach(item => {
          imeiToItemId[item.imei] = item.id;
        });

        // Get default location (you may need to adjust this)
        const { data: locations, error: locationError } = await supabase
          .from('Location')
          .select('id')
          .limit(1);

        if (locationError || !locations || locations.length === 0) {
          throw new Error('No location found for inventory');
        }

        const defaultLocationId = locations[0].id;

        const upsertData = batch.map(item => ({
          itemId: imeiToItemId[item.imei],
          locationId: defaultLocationId,
          sku: item.sku,
          quantity: 1,
          reserved: 0,
          available: 1,
          updatedAt: new Date().toISOString()
        })).filter(inv => inv.itemId); // Filter out items that weren't found

        if (upsertData.length > 0) {
          const { error } = await supabase
            .from('Inventory')
            .upsert(upsertData, { 
              onConflict: 'itemId,locationId',
              ignoreDuplicates: false 
            });

          if (error) {
            throw new Error(`Inventory batch error: ${error.message}`);
          }

          result.details.inventoryCreated += upsertData.length;
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Inventory batch ${batchNumber}: ${errorMessage}`);
        console.error(`  ❌ Inventory batch ${batchNumber} error:`, errorMessage);
      }
    }
  }

  async processDeviceTestsBatch(data, result) {
    const totalBatches = Math.ceil(data.length / this.batchSize);
    
    for (let i = 0; i < data.length; i += this.batchSize) {
      const batch = data.slice(i, i + this.batchSize);
      const batchNumber = Math.floor(i / this.batchSize) + 1;
      
      try {
        console.log(`  🧪 Processing Device Tests batch ${batchNumber}/${totalBatches} (${batch.length} items)...`);
        
        // Get the item IDs for the IMEIs
        const imeis = batch.map(item => item.imei);
        const { data: items, error: itemsError } = await supabase
          .from('Item')
          .select('id, imei')
          .in('imei', imeis);

        if (itemsError) {
          throw new Error(`Error fetching items: ${itemsError.message}`);
        }

        // Create a map of IMEI to item ID
        const imeiToItemId = {};
        items.forEach(item => {
          imeiToItemId[item.imei] = item.id;
        });

        const upsertData = batch.map(item => ({
          itemId: imeiToItemId[item.imei],
          testType: 'PHONECHECK',
          testDate: new Date().toISOString(),
          testResults: item.testResults,
          passed: item.working === 'YES',
          notes: `PhoneCheck test for ${item.brand} ${item.model}`,
          testedBy: 'SYSTEM'
        })).filter(test => test.itemId); // Filter out items that weren't found

        if (upsertData.length > 0) {
          const { error } = await supabase
            .from('DeviceTest')
            .insert(upsertData);

          if (error) {
            throw new Error(`Device Tests batch error: ${error.message}`);
          }

          result.details.deviceTestsCreated += upsertData.length;
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Device Tests batch ${batchNumber}: ${errorMessage}`);
        console.error(`  ❌ Device Tests batch ${batchNumber} error:`, errorMessage);
      }
    }
  }

  generateSku(data) {
    const parts = [
      data.brand?.toUpperCase().replace(/\s+/g, ''),
      data.model?.toUpperCase().replace(/\s+/g, ''),
      data.storage?.toUpperCase().replace(/\s+/g, ''),
      data.color?.toUpperCase().replace(/\s+/g, ''),
      data.carrier?.toUpperCase().replace(/\s+/g, '')
    ].filter(Boolean);
    
    return parts.join('-') || 'UNKNOWN-SKU';
  }

  /**
   * Get current processing statistics
   */
  async getProcessingStats() {
    try {
      const [itemCount, inventoryCount, deviceTestCount] = await Promise.all([
        supabase.from('Item').select('id', { count: 'exact' }),
        supabase.from('Inventory').select('id', { count: 'exact' }),
        supabase.from('DeviceTest').select('id', { count: 'exact' })
      ]);

      return {
        items: itemCount.count || 0,
        inventory: inventoryCount.count || 0,
        deviceTests: deviceTestCount.count || 0
      };
    } catch (error) {
      console.error('Error getting processing stats', { error });
      return { items: 0, inventory: 0, deviceTests: 0 };
    }
  }

  /**
   * Query items with PhoneCheck data
   */
  async getItemsWithPhoneCheck(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('Item')
        .select(`
          *,
          Inventory (
            quantity,
            reserved,
            available,
            Location (name)
          ),
          DeviceTest (
            testType,
            testDate,
            passed,
            notes
          )
        `)
        .eq('type', 'PHONE')
        .limit(limit);

      if (error) {
        throw new Error(`Items query error: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error getting items with PhoneCheck data', { error });
      return [];
    }
  }
}

// Example usage function
async function processPhoneCheckBulkExample() {
  console.log('📱 PhoneCheck Bulk Processor - Using Your Existing Schema\n');

  try {
    const processor = new PhoneCheckBulkProcessor();
    
    // Get current stats
    const initialStats = await processor.getProcessingStats();
    console.log('📊 Current Database Stats:', initialStats);

    // Example PhoneCheck data (replace with your actual data)
    const examplePhoneCheckData = [
      {
        imei: "123456789012345",
        device_name: "iPhone 14 Pro",
        brand: "Apple",
        model: "iPhone 14 Pro",
        storage: "128GB",
        color: "Space Black",
        carrier: "Unlocked",
        working_status: "YES",
        battery_health: 95,
        condition: "USED",
        screen_condition: "EXCELLENT",
        body_condition: "GOOD",
        network_status: "CLEAN",
        activation_status: "ACTIVATED"
      },
      {
        imei: "987654321098765",
        device_name: "Samsung Galaxy S23",
        brand: "Samsung",
        model: "Galaxy S23",
        storage: "256GB",
        color: "Phantom Black",
        carrier: "T-Mobile",
        working_status: "YES",
        battery_health: 88,
        condition: "USED",
        screen_condition: "GOOD",
        body_condition: "FAIR",
        network_status: "CLEAN",
        activation_status: "ACTIVATED"
      }
    ];

    console.log(`\n📝 Processing ${examplePhoneCheckData.length} PhoneCheck records...`);
    
    // Process the data
    const result = await processor.processPhoneCheckBulkData(examplePhoneCheckData);

    // Show results
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

    // Show items with PhoneCheck data
    const items = await processor.getItemsWithPhoneCheck(5);
    if (items.length > 0) {
      console.log('\n📱 Recent Items with PhoneCheck Data:');
      items.forEach((item, index) => {
        const inventory = item.Inventory?.[0];
        const deviceTest = item.DeviceTest?.[0];
        console.log(`  ${index + 1}. ${item.imei} | ${item.brand} ${item.model} | Condition: ${item.condition} | Battery: ${item.batteryHealth}% | Available: ${inventory?.available || 0} | Test Passed: ${deviceTest?.passed || 'N/A'}`);
      });
    }

    console.log('\n✅ PhoneCheck bulk processing example completed!');

  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// Export for use in other modules
module.exports = { PhoneCheckBulkProcessor, processPhoneCheckBulkExample };

// Run example if called directly
if (require.main === module) {
  processPhoneCheckBulkExample().catch(console.error);
}
