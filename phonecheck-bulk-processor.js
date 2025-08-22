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
 * Handles real PhoneCheck data and processes it into your optimized database
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
        imeiDetailsCreated: 0,
        imeiDetailsUpdated: 0,
        inventoryItemsCreated: 0,
        inventoryItemsUpdated: 0,
        inventoryUnitsCreated: 0,
        inventoryUnitsUpdated: 0
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
      
      // Step 1: Process IMEI Details
      console.log('\n📱 Step 1: Processing IMEI Details...');
      await this.processImeiDetailsBatch(transformedData, result);

      // Step 2: Process Inventory Items
      console.log('\n📦 Step 2: Processing Inventory Items...');
      await this.processInventoryItemsBatch(transformedData, result);

      // Step 3: Process Inventory Units
      console.log('\n🔢 Step 3: Processing Inventory Units...');
      await this.processInventoryUnitsBatch(transformedData, result);

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
        deviceName: phonecheckResponse.device_name || phonecheckResponse.deviceName || phonecheckResponse.model,
        brand: phonecheckResponse.brand || phonecheckResponse.Brand,
        model: phonecheckResponse.model || phonecheckResponse.Model,
        storage: phonecheckResponse.storage || phonecheckResponse.Storage || phonecheckResponse.capacity,
        color: phonecheckResponse.color || phonecheckResponse.Color,
        carrier: phonecheckResponse.carrier || phonecheckResponse.Carrier || phonecheckResponse.network,
        workingStatus: phonecheckResponse.working_status || phonecheckResponse.workingStatus || phonecheckResponse.status || 'YES',
        batteryHealth: parseInt(phonecheckResponse.battery_health || phonecheckResponse.batteryHealth || phonecheckResponse.battery || '85'),
        condition: phonecheckResponse.condition || phonecheckResponse.Condition || 'Good',
        rawData: phonecheckResponse // Store full PhoneCheck response
      };
    });
  }

  async processImeiDetailsBatch(data, result) {
    const totalBatches = Math.ceil(data.length / this.batchSize);
    
    for (let i = 0; i < data.length; i += this.batchSize) {
      const batch = data.slice(i, i + this.batchSize);
      const batchNumber = Math.floor(i / this.batchSize) + 1;
      
      try {
        console.log(`  📱 Processing IMEI batch ${batchNumber}/${totalBatches} (${batch.length} items)...`);
        
        const { error } = await supabase
          .from('imei_details')
          .upsert(
            batch.map(item => ({
              imei: item.imei,
              device_name: item.deviceName,
              brand: item.brand,
              model: item.model,
              storage: item.storage,
              color: item.color,
              carrier: item.carrier,
              working_status: item.workingStatus,
              battery_health: item.batteryHealth,
              condition: item.condition,
              phonecheck_data: item.rawData,
              last_updated: new Date().toISOString()
            })),
            { 
              onConflict: 'imei',
              ignoreDuplicates: false 
            }
          );

        if (error) {
          throw new Error(`IMEI Details batch error: ${error.message}`);
        }

        result.details.imeiDetailsCreated += batch.length;
        result.processed += batch.length;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`IMEI Details batch ${batchNumber}: ${errorMessage}`);
        console.error(`  ❌ IMEI Details batch ${batchNumber} error:`, errorMessage);
      }
    }
  }

  async processInventoryItemsBatch(data, result) {
    // Group by SKU to aggregate quantities
    const skuGroups = new Map();
    
    data.forEach(item => {
      const sku = this.generateSku(item);
      if (!skuGroups.has(sku)) {
        skuGroups.set(sku, []);
      }
      skuGroups.get(sku).push(item);
    });

    const skuArray = Array.from(skuGroups.entries());
    const totalBatches = Math.ceil(skuArray.length / this.batchSize);
    
    for (let i = 0; i < skuArray.length; i += this.batchSize) {
      const batch = skuArray.slice(i, i + this.batchSize);
      const batchNumber = Math.floor(i / this.batchSize) + 1;
      
      try {
        console.log(`  📦 Processing Items batch ${batchNumber}/${totalBatches} (${batch.length} SKUs)...`);
        
        const upsertData = batch.map(([sku, items]) => {
          const firstItem = items[0];
          return {
            sku,
            brand: firstItem.brand,
            model: firstItem.model,
            storage: firstItem.storage,
            color: firstItem.color,
            carrier: firstItem.carrier,
            total_quantity: items.length,
            available_quantity: items.length,
            last_updated: new Date().toISOString()
          };
        });

        const { error } = await supabase
          .from('inventory_items')
          .upsert(upsertData, { 
            onConflict: 'sku',
            ignoreDuplicates: false 
          });

        if (error) {
          throw new Error(`Inventory Items batch error: ${error.message}`);
        }

        result.details.inventoryItemsCreated += batch.length;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Inventory Items batch ${batchNumber}: ${errorMessage}`);
        console.error(`  ❌ Inventory Items batch ${batchNumber} error:`, errorMessage);
      }
    }
  }

  async processInventoryUnitsBatch(data, result) {
    const totalBatches = Math.ceil(data.length / this.batchSize);
    
    for (let i = 0; i < data.length; i += this.batchSize) {
      const batch = data.slice(i, i + this.batchSize);
      const batchNumber = Math.floor(i / this.batchSize) + 1;
      
      try {
        console.log(`  🔢 Processing Units batch ${batchNumber}/${totalBatches} (${batch.length} items)...`);
        
        const upsertData = batch.map(item => ({
          imei: item.imei,
          sku: this.generateSku(item),
          location: 'DNCL-Inspection',
          status: 'active',
          phonecheck_synced: true,
          last_phonecheck: new Date().toISOString()
        }));

        const { error } = await supabase
          .from('inventory_units')
          .upsert(upsertData, { 
            onConflict: 'imei',
            ignoreDuplicates: false 
          });

        if (error) {
          throw new Error(`Inventory Units batch error: ${error.message}`);
        }

        result.details.inventoryUnitsCreated += batch.length;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Inventory Units batch ${batchNumber}: ${errorMessage}`);
        console.error(`  ❌ Inventory Units batch ${batchNumber} error:`, errorMessage);
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
      const [imeiCount, itemCount, unitCount] = await Promise.all([
        supabase.from('imei_details').select('imei', { count: 'exact' }),
        supabase.from('inventory_items').select('sku', { count: 'exact' }),
        supabase.from('inventory_units').select('imei', { count: 'exact' })
      ]);

      return {
        imeiDetails: imeiCount.count || 0,
        inventoryItems: itemCount.count || 0,
        inventoryUnits: unitCount.count || 0
      };
    } catch (error) {
      console.error('Error getting processing stats', { error });
      return { imeiDetails: 0, inventoryItems: 0, inventoryUnits: 0 };
    }
  }

  /**
   * Query inventory summary
   */
  async getInventorySummary(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('inventory_summary')
        .select('*')
        .limit(limit);

      if (error) {
        throw new Error(`Inventory summary error: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error getting inventory summary', { error });
      return [];
    }
  }
}

// Example usage function
async function processPhoneCheckBulkExample() {
  console.log('📱 PhoneCheck Bulk Processor - Example Usage\n');

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
        condition: "Excellent",
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
        condition: "Good",
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

    // Show inventory summary
    const summary = await processor.getInventorySummary(5);
    if (summary.length > 0) {
      console.log('\n📋 Recent Inventory Summary:');
      summary.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.imei} | ${item.brand} ${item.model} | ${item.condition} | Battery: ${item.battery_health}%`);
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
