const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseApiKey = process.env['SUPABASE_API_KEY'];

if (!supabaseUrl || !supabaseApiKey) {
  console.error('❌ Supabase URL or API Key not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseApiKey);

// Mock PhoneCheck data generator for large batches
function generateLargeMockPhoneCheckData(count = 500) {
  const brands = ['Apple', 'Samsung', 'Google', 'OnePlus', 'Xiaomi', 'Huawei', 'OPPO', 'Vivo'];
  const models = {
    'Apple': ['iPhone 14 Pro', 'iPhone 14', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 12', 'iPhone 11', 'iPhone SE'],
    'Samsung': ['Galaxy S23', 'Galaxy S22', 'Galaxy A54', 'Galaxy A34', 'Galaxy Z Fold', 'Galaxy Z Flip', 'Galaxy Note'],
    'Google': ['Pixel 7 Pro', 'Pixel 7', 'Pixel 6 Pro', 'Pixel 6', 'Pixel 5', 'Pixel 4a'],
    'OnePlus': ['OnePlus 11', 'OnePlus 10 Pro', 'OnePlus 10T', 'OnePlus Nord', 'OnePlus 9'],
    'Xiaomi': ['Xiaomi 13 Pro', 'Xiaomi 13', 'Redmi Note 12', 'POCO F5', 'Redmi 11'],
    'Huawei': ['P50 Pro', 'P40 Pro', 'Mate 50', 'Nova 10', 'Y9'],
    'OPPO': ['Find X6', 'Reno 9', 'A98', 'A78', 'A58'],
    'Vivo': ['X90 Pro', 'V27', 'Y56', 'Y36', 'Y16']
  };
  const storages = ['64GB', '128GB', '256GB', '512GB', '1TB'];
  const colors = ['Black', 'White', 'Blue', 'Green', 'Red', 'Purple', 'Gold', 'Silver', 'Pink', 'Orange'];
  const carriers = ['Unlocked', 'T-Mobile', 'AT&T', 'Verizon', 'Sprint', 'Cricket', 'Metro'];
  const conditions = ['Excellent', 'Good', 'Fair', 'Poor'];
  const workingStatuses = ['YES', 'NO', 'PARTIAL'];

  const data = [];
  
  for (let i = 0; i < count; i++) {
    const brand = brands[Math.floor(Math.random() * brands.length)];
    const model = models[brand][Math.floor(Math.random() * models[brand].length)];
    const storage = storages[Math.floor(Math.random() * storages.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const carrier = carriers[Math.floor(Math.random() * carriers.length)];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    const workingStatus = workingStatuses[Math.floor(Math.random() * workingStatuses.length)];
    const batteryHealth = Math.floor(Math.random() * 40) + 60; // 60-100%

    // Generate unique 15-digit IMEI for large batches
    const baseImei = 111111111000000; // Different base for large batch
    const imei = (baseImei + i).toString();
    
    data.push({
      imei,
      deviceName: `${brand} ${model}`,
      brand,
      model,
      storage,
      color,
      carrier,
      workingStatus,
      batteryHealth,
      condition,
      rawData: {
        imei,
        deviceName: `${brand} ${model}`,
        brand,
        model,
        storage,
        color,
        carrier,
        workingStatus,
        batteryHealth,
        condition,
        timestamp: new Date().toISOString(),
        phonecheckId: `PC${Date.now()}${i}`,
        // Additional PhoneCheck fields that might be present
        networkStatus: Math.random() > 0.5 ? 'CLEAN' : 'BLACKLISTED',
        activationStatus: Math.random() > 0.3 ? 'ACTIVATED' : 'DEACTIVATED',
        simLockStatus: Math.random() > 0.7 ? 'UNLOCKED' : 'LOCKED',
        carrierCheck: Math.random() > 0.6 ? 'PASS' : 'FAIL',
        blacklistCheck: Math.random() > 0.8 ? 'PASS' : 'FAIL'
      }
    });
  }
  
  return data;
}

// Optimized PhoneCheck Service for large batches
class LargeBatchPhoneCheckService {
  
  async processLargeBulkPhoneCheckData(data) {
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
      console.log(`🚀 Starting LARGE bulk PhoneCheck processing for ${data.length} items`);
      console.log(`📊 Estimated processing time: ${Math.ceil(data.length / 50)} batches × ~2s = ~${Math.ceil(data.length / 50) * 2}s`);

      // Step 1: Process IMEI Details in batches
      console.log('\n📱 Step 1: Processing IMEI Details...');
      await this.processImeiDetailsBatch(data, result);

      // Step 2: Process Inventory Items in batches
      console.log('\n📦 Step 2: Processing Inventory Items...');
      await this.processInventoryItemsBatch(data, result);

      // Step 3: Process Inventory Units in batches
      console.log('\n🔢 Step 3: Processing Inventory Units...');
      await this.processInventoryUnitsBatch(data, result);

      const processingTime = Date.now() - startTime;
      result.performance.totalTime = processingTime;
      result.performance.averageTimePerItem = processingTime / data.length;
      result.performance.itemsPerSecond = Math.round((data.length / processingTime) * 1000);

      console.log(`\n✅ Large bulk processing completed in ${processingTime}ms`);
      console.log(`📈 Performance: ${result.performance.itemsPerSecond} items/second`);
      console.log(`⏱️  Average: ${result.performance.averageTimePerItem.toFixed(2)}ms per item`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Large bulk processing failed', { error: errorMessage });
      result.success = false;
      result.errors.push(errorMessage);
    }

    return result;
  }

  async processImeiDetailsBatch(data, result) {
    const batchSize = 50;
    const totalBatches = Math.ceil(data.length / batchSize);
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
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

    const batchSize = 50;
    const skuArray = Array.from(skuGroups.entries());
    const totalBatches = Math.ceil(skuArray.length / batchSize);
    
    for (let i = 0; i < skuArray.length; i += batchSize) {
      const batch = skuArray.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
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
    const batchSize = 50;
    const totalBatches = Math.ceil(data.length / batchSize);
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
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
}

async function testLargeBulkProcessing() {
  console.log('🧪 Testing LARGE Bulk PhoneCheck Processing System (500 units)\n');

  try {
    // Get initial stats
    const service = new LargeBatchPhoneCheckService();
    const initialStats = await service.getProcessingStats();
    console.log('📊 Initial Database Stats:', initialStats);

    // Generate large test data
    const testDataCount = 100; // Start with 100 for testing, can increase to 500
    console.log(`\n📝 Generating ${testDataCount} test PhoneCheck records...`);
    const testData = generateLargeMockPhoneCheckData(testDataCount);

    // Show sample data
    console.log('\n📋 Sample Test Data:');
    testData.slice(0, 5).forEach((item, index) => {
      console.log(`  ${index + 1}. IMEI: ${item.imei} | ${item.brand} ${item.model} ${item.storage} ${item.color}`);
    });

    // Process the data
    console.log('\n🔄 Processing large bulk data...');
    const result = await service.processLargeBulkPhoneCheckData(testData);

    // Show results
    console.log('\n📈 Processing Results:');
    console.log(`  ✅ Success: ${result.success}`);
    console.log(`  📦 Processed: ${result.processed} items`);
    console.log(`  ❌ Errors: ${result.errors.length}`);
    console.log(`  ⏱️  Total Time: ${result.performance.totalTime}ms`);
    console.log(`  🚀 Items/Second: ${result.performance.itemsPerSecond}`);
    console.log(`  📊 Avg Time/Item: ${result.performance.averageTimePerItem.toFixed(2)}ms`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    console.log('\n📊 Processing Details:');
    console.log(`  📱 IMEI Details Created: ${result.details.imeiDetailsCreated}`);
    console.log(`  📦 Inventory Items Created: ${result.details.inventoryItemsCreated}`);
    console.log(`  🔢 Inventory Units Created: ${result.details.inventoryUnitsCreated}`);

    // Get final stats
    const finalStats = await service.getProcessingStats();
    console.log('\n📊 Final Database Stats:', finalStats);

    // Performance analysis
    console.log('\n📈 Performance Analysis:');
    const estimated500Time = Math.ceil(500 / result.performance.itemsPerSecond);
    console.log(`  🎯 Estimated time for 500 units: ~${estimated500Time} seconds`);
    console.log(`  ⚡ Processing rate: ${result.performance.itemsPerSecond} items/second`);
    console.log(`  💾 Database efficiency: ${result.processed} items processed successfully`);

    console.log('\n✅ Large bulk processing test completed successfully!');

  } catch (error) {
    console.error('❌ Large test failed:', error);
  }
}

// Main execution
if (require.main === module) {
  testLargeBulkProcessing().catch(console.error);
}

module.exports = { testLargeBulkProcessing, LargeBatchPhoneCheckService, generateLargeMockPhoneCheckData };
