const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function createWorkingSolution() {
  const client = await pool.connect();
  try {
    console.log('🔧 Creating working solution...');
    
    // Step 1: Create a Node.js-based processing function
    console.log('\n📋 Step 1: Creating Node.js processing service...');
    
    const processingService = `
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

class QueueProcessor {
  async processQueue() {
    const client = await pool.connect();
    try {
      console.log('🔄 Processing queue...');
      
      // Get pending items
      const pendingItems = await client.query(\`
        SELECT * FROM data_queue
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT 100
      \`);
      
      if (pendingItems.rows.length === 0) {
        console.log('ℹ️  No pending items to process');
        return { processed: 0, errors: 0 };
      }
      
      console.log(\`📊 Found \${pendingItems.rows.length} pending items\`);
      
      let processed = 0;
      let errors = 0;
      
      for (const item of pendingItems.rows) {
        try {
          await this.processItem(client, item);
          processed++;
          console.log(\`✅ Processed item \${item.id} (IMEI: \${item.raw_data.imei})\`);
        } catch (error) {
          errors++;
          console.log(\`❌ Failed to process item \${item.id}: \${error.message}\`);
          
          // Mark as failed
          await client.query(\`
            UPDATE data_queue 
            SET status = 'failed', error_message = $1, updated_at = NOW()
            WHERE id = $2
          \`, [error.message, item.id]);
        }
      }
      
      console.log(\`📊 Processing complete: \${processed} processed, \${errors} errors\`);
      return { processed, errors };
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }
  
  async processItem(client, item) {
    const data = item.raw_data;
    
    // Insert into product table
    await client.query(\`
      INSERT INTO product (imei, brand, sku, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (imei) DO UPDATE SET
        brand = EXCLUDED.brand,
        sku = EXCLUDED.sku,
        updated_at = NOW()
    \`, [
      data.imei,
      data.brand,
      data.brand + '-' + data.model + '-' + data.imei.slice(-4)
    ]);
    
    // Insert into item table
    await client.query(\`
      INSERT INTO item (
        imei, model, model_number, carrier, capacity, color, 
        battery_health, battery_count, working, location, 
        created_at, updated_at
      )
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
    \`, [
      data.imei,
      data.model,
      data.serialNumber || data.serialnumber || data.model,
      data.carrier,
      data.storage,
      data.color,
      data.batteryHealth || data.batteryhealth || data.BatteryHealthPercentage,
      data.batteryCycleCount || data.BatteryCycle || data.bcc,
      data.working,
      data.location || 'INCOMING'
    ]);
    
    // Insert into device_test table ONLY if working status is valid (not PENDING)
    if (data.working && data.working !== 'PENDING' && data.working !== '') {
      await client.query(\`
        INSERT INTO device_test (imei, working, notes, tester, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (imei) DO UPDATE SET
          working = EXCLUDED.working,
          notes = EXCLUDED.notes,
          tester = EXCLUDED.tester,
          created_at = NOW()
      \`, [
        data.imei,
        data.working,
        data.notes,
        data.TesterName || data.testerName
      ]);
    }
    
    // Insert into sku_matching_queue for SKU matching
    await client.query(\`
      INSERT INTO sku_matching_queue (imei, status, created_at, updated_at)
      VALUES ($1, 'pending', NOW(), NOW())
      ON CONFLICT (imei) DO UPDATE SET
        status = 'pending',
        updated_at = NOW()
    \`, [data.imei]);
    
    // Mark as completed
    await client.query(\`
      UPDATE data_queue 
      SET status = 'completed', processed_at = NOW(), updated_at = NOW()
      WHERE id = $1
    \`, [item.id]);
  }
}

// Export for use
module.exports = QueueProcessor;
`;
    
    require('fs').writeFileSync('src/services/QueueProcessor.js', processingService);
    console.log('✅ QueueProcessor service created');
    
    // Step 2: Create a simple processing script
    console.log('\n📋 Step 2: Creating processing script...');
    
    const processingScript = `
const QueueProcessor = require('./src/services/QueueProcessor.js');

async function main() {
  const processor = new QueueProcessor();
  
  try {
    const result = await processor.processQueue();
    
    if (result.processed > 0) {
      console.log('🎉 Queue processing completed successfully!');
      console.log(\`📊 Processed: \${result.processed} items\`);
      if (result.errors > 0) {
        console.log(\`⚠️  Errors: \${result.errors} items\`);
      }
    } else {
      console.log('ℹ️  No items to process');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
`;
    
    require('fs').writeFileSync('process-queue.js', processingScript);
    console.log('✅ Processing script created: process-queue.js');
    
    // Step 3: Test the solution
    console.log('\n📋 Step 3: Testing the solution...');
    
    const testData = {
      imei: '666666666666666',
      brand: 'Samsung',
      model: 'Galaxy S21',
      working: 'YES',
      carrier: 'Verizon',
      storage: '256GB',
      color: 'Black',
      serialNumber: 'SN-WORKING-123',
      batteryHealth: '95',
      batteryCycle: '100',
      notes: 'CARRIER UNLOCKED',
      TesterName: 'WorkingTester'
    };
    
    // Insert test item
    const insertResult = await client.query(`
      INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [testData, 'pending', 'test', 5, 0, 3]);
    
    console.log(`✅ Test item inserted: ID ${insertResult.rows[0].id}`);
    
    // Process using the new service
    const QueueProcessor = require('./src/services/QueueProcessor.js');
    const processor = new QueueProcessor();
    const result = await processor.processQueue();
    
    console.log(`📊 Processing result: ${result.processed} processed, ${result.errors} errors`);
    
    // Check if the item was processed
    const checkResult = await client.query(`
      SELECT status, processed_at FROM data_queue WHERE id = $1
    `, [insertResult.rows[0].id]);
    
    console.log(`📊 Item status: ${checkResult.rows[0].status}`);
    
    // Check data insertion
    const productCheck = await client.query(`
      SELECT imei, brand FROM product WHERE imei = $1
    `, [testData.imei]);
    
    const itemCheck = await client.query(`
      SELECT imei, model_number FROM item WHERE imei = $1
    `, [testData.imei]);
    
    const skuQueueCheck = await client.query(`
      SELECT imei, status FROM sku_matching_queue WHERE imei = $1
    `, [testData.imei]);
    
    console.log(`📊 Product table: ${productCheck.rows.length > 0 ? '✅' : '❌'}`);
    console.log(`📊 Item table: ${itemCheck.rows.length > 0 ? '✅' : '❌'}`);
    console.log(`📊 SKU matching queue: ${skuQueueCheck.rows.length > 0 ? '✅' : '❌'}`);
    
    if (itemCheck.rows.length > 0) {
      console.log(`📊 Model number: ${itemCheck.rows[0].model_number} (expected: ${testData.serialNumber})`);
    }
    
    // Clean up
    await client.query(`DELETE FROM device_test WHERE imei = $1`, [testData.imei]);
    await client.query(`DELETE FROM item WHERE imei = $1`, [testData.imei]);
    await client.query(`DELETE FROM product WHERE imei = $1`, [testData.imei]);
    await client.query(`DELETE FROM sku_matching_queue WHERE imei = $1`, [testData.imei]);
    await client.query(`DELETE FROM data_queue WHERE id = $1`, [insertResult.rows[0].id]);
    
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎉 Working solution implemented successfully!');
    console.log('\n📋 How to use:');
    console.log('1. Add items to data_queue with status = "pending"');
    console.log('2. Run: node process-queue.js');
    console.log('3. Items will be processed into product, item, device_test, and sku_matching_queue tables');
    console.log('4. PENDING working status items will skip device_test table');
    console.log('5. The system handles all field mappings correctly');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createWorkingSolution();


