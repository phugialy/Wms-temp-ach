const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseApiKey = process.env['SUPABASE_API_KEY'];

if (!supabaseUrl || !supabaseApiKey) {
  console.error('❌ Supabase URL or API Key not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseApiKey);

// Mock PhoneCheck data generator
function generateMockPhoneCheckData(count = 10) {
  const brands = ['Apple', 'Samsung', 'Google', 'OnePlus', 'Xiaomi'];
  const models = {
    'Apple': ['iPhone 14 Pro', 'iPhone 14', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 12'],
    'Samsung': ['Galaxy S23', 'Galaxy S22', 'Galaxy A54', 'Galaxy A34', 'Galaxy Z Fold'],
    'Google': ['Pixel 7 Pro', 'Pixel 7', 'Pixel 6 Pro', 'Pixel 6', 'Pixel 5'],
    'OnePlus': ['OnePlus 11', 'OnePlus 10 Pro', 'OnePlus 10T', 'OnePlus Nord'],
    'Xiaomi': ['Xiaomi 13 Pro', 'Xiaomi 13', 'Redmi Note 12', 'POCO F5']
  };
  const storages = ['64GB', '128GB', '256GB', '512GB', '1TB'];
  const colors = ['Black', 'White', 'Blue', 'Green', 'Red', 'Purple', 'Gold', 'Silver'];
  const carriers = ['Unlocked', 'T-Mobile', 'AT&T', 'Verizon', 'Sprint'];
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

    // Generate unique 15-digit IMEI starting from a different base
    const baseImei = 987654321000000; // Different base to avoid conflicts
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
        phonecheckId: `PC${Date.now()}${i}`
      }
    });
  }
  
  return data;
}

// Optimized PhoneCheck Service (simplified version for testing)
class OptimizedPhoneCheckService {
  
  async processBulkPhoneCheckData(data) {
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
      }
    };

    try {
      console.log(`🚀 Starting bulk PhoneCheck processing for ${data.length} items`);

      // Step 1: Process IMEI Details in batches
      await this.processImeiDetailsBatch(data, result);

      // Step 2: Process Inventory Items in batches
      await this.processInventoryItemsBatch(data, result);

      // Step 3: Process Inventory Units in batches
      await this.processInventoryUnitsBatch(data, result);

      const processingTime = Date.now() - startTime;
      console.log(`✅ Bulk processing completed in ${processingTime}ms`, {
        processed: result.processed,
        details: result.details
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Bulk processing failed', { error: errorMessage });
      result.success = false;
      result.errors.push(errorMessage);
    }

    return result;
  }

  async processImeiDetailsBatch(data, result) {
    const batchSize = 50;
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      try {
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
        result.errors.push(`IMEI Details batch ${Math.floor(i / batchSize) + 1}: ${errorMessage}`);
        console.error('IMEI Details batch processing error', { error: errorMessage, batchIndex: i });
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
    
    for (let i = 0; i < skuArray.length; i += batchSize) {
      const batch = skuArray.slice(i, i + batchSize);
      
      try {
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
        result.errors.push(`Inventory Items batch ${Math.floor(i / batchSize) + 1}: ${errorMessage}`);
        console.error('Inventory Items batch processing error', { error: errorMessage, batchIndex: i });
      }
    }
  }

  async processInventoryUnitsBatch(data, result) {
    const batchSize = 50;
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      try {
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
        result.errors.push(`Inventory Units batch ${Math.floor(i / batchSize) + 1}: ${errorMessage}`);
        console.error('Inventory Units batch processing error', { error: errorMessage, batchIndex: i });
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

async function testBulkProcessing() {
  console.log('🧪 Testing Bulk PhoneCheck Processing System\n');

  try {
    // Get initial stats
    const service = new OptimizedPhoneCheckService();
    const initialStats = await service.getProcessingStats();
    console.log('📊 Initial Database Stats:', initialStats);

    // Generate test data
    const testDataCount = 25; // Start with a smaller batch for testing
    console.log(`\n📝 Generating ${testDataCount} test PhoneCheck records...`);
    const testData = generateMockPhoneCheckData(testDataCount);

    // Show sample data
    console.log('\n📋 Sample Test Data:');
    testData.slice(0, 3).forEach((item, index) => {
      console.log(`  ${index + 1}. IMEI: ${item.imei} | ${item.brand} ${item.model} ${item.storage} ${item.color}`);
    });

    // Process the data
    console.log('\n🔄 Processing bulk data...');
    const result = await service.processBulkPhoneCheckData(testData);

    // Show results
    console.log('\n📈 Processing Results:');
    console.log(`  ✅ Success: ${result.success}`);
    console.log(`  📦 Processed: ${result.processed} items`);
    console.log(`  ❌ Errors: ${result.errors.length}`);
    
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

    // Show some sample results
    console.log('\n🔍 Sample Results from Database:');
    
    const { data: sampleImei } = await supabase
      .from('imei_details')
      .select('*')
      .limit(3);
    
    if (sampleImei && sampleImei.length > 0) {
      console.log('\n📱 Sample IMEI Details:');
      sampleImei.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.imei} | ${item.brand} ${item.model} | Battery: ${item.battery_health}% | Condition: ${item.condition}`);
      });
    }

    const { data: sampleItems } = await supabase
      .from('inventory_items')
      .select('*')
      .limit(3);
    
    if (sampleItems && sampleItems.length > 0) {
      console.log('\n📦 Sample Inventory Items:');
      sampleItems.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.sku} | Qty: ${item.total_quantity}/${item.available_quantity}`);
      });
    }

    const { data: sampleUnits } = await supabase
      .from('inventory_units')
      .select('*')
      .limit(3);
    
    if (sampleUnits && sampleUnits.length > 0) {
      console.log('\n🔢 Sample Inventory Units:');
      sampleUnits.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.imei} | SKU: ${item.sku} | Location: ${item.location} | Synced: ${item.phonecheck_synced}`);
      });
    }

    console.log('\n✅ Bulk processing test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Main execution
if (require.main === module) {
  testBulkProcessing().catch(console.error);
}

module.exports = { testBulkProcessing, OptimizedPhoneCheckService, generateMockPhoneCheckData };
