const { Pool } = require('pg');
const { SkuMatchingAgent } = require('./src/services/SkuMatchingAgent');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

class AutomatedWorkflowManager {
  constructor() {
    this.isRunning = false;
    this.processingInterval = 5000; // 5 seconds
    this.skuMatchingAgent = new SkuMatchingAgent();
  }

  async start() {
    console.log('🚀 Starting Automated Workflow Manager...');
    this.isRunning = true;
    
    // Start the queue processing loop
    this.startQueueProcessing();
    
    // Start the SKU matching agent
    await this.skuMatchingAgent.start();
    
    console.log('✅ Automated workflow is now running!');
    console.log('📋 Monitoring:');
    console.log('  - Queue processing every 5 seconds');
    console.log('  - SKU matching agent active');
    console.log('  - Press Ctrl+C to stop');
  }

  async startQueueProcessing() {
    while (this.isRunning) {
      try {
        await this.processQueueItems();
        await this.sleep(this.processingInterval);
      } catch (error) {
        console.error('❌ Error in queue processing:', error.message);
        await this.sleep(this.processingInterval);
      }
    }
  }

  async processQueueItems() {
    const client = await pool.connect();
    try {
      // Get pending items from data_queue
      const pendingItems = await client.query(`
        SELECT * FROM data_queue 
        WHERE status = 'pending' 
        ORDER BY created_at ASC 
        LIMIT 5
      `);

      if (pendingItems.rows.length > 0) {
        console.log(`📦 Processing ${pendingItems.rows.length} queue items...`);
        
        for (const item of pendingItems.rows) {
          await this.processSingleItem(client, item);
        }
      }
    } finally {
      client.release();
    }
  }

  async processSingleItem(client, item) {
    try {
      console.log(`  🔄 Processing IMEI: ${item.raw_data.imei}`);
      
      // Mark as processing
      await client.query(`
        UPDATE data_queue 
        SET status = 'processing', updated_at = NOW() 
        WHERE id = $1
      `, [item.id]);

      // Process the item (insert into product, item, device_test)
      await this.insertIntoDatabase(client, item);
      
      // Mark as completed
      await client.query(`
        UPDATE data_queue 
        SET status = 'completed', processed_at = NOW(), updated_at = NOW() 
        WHERE id = $1
      `, [item.id]);
      
      console.log(`    ✅ Completed: ${item.raw_data.imei}`);
      
    } catch (error) {
      console.error(`    ❌ Error processing ${item.raw_data.imei}:`, error.message);
      
      // Mark as failed
      await client.query(`
        UPDATE data_queue 
        SET status = 'failed', updated_at = NOW() 
        WHERE id = $1
      `, [item.id]);
    }
  }

  async insertIntoDatabase(client, item) {
    // Insert into product table
    const productResult = await client.query(`
      INSERT INTO product (imei, brand, sku, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (imei) DO UPDATE SET
        brand = EXCLUDED.brand,
        sku = EXCLUDED.sku,
        updated_at = NOW()
      RETURNING imei
    `, [
      item.raw_data.imei,
      item.raw_data.brand,
      `${item.raw_data.brand}-${item.raw_data.model}-${item.raw_data.imei.slice(-4)}`
    ]);

    // Insert into item table
    const modelNumber = item.raw_data["Model#"] || item.raw_data.serialNumber || item.raw_data.serialnumber || item.raw_data.model;
    const batteryHealth = item.raw_data.batteryHealth || item.raw_data.batteryhealth || item.raw_data.BatteryHealthPercentage || null;
    const batteryCount = item.raw_data.batteryCycleCount || item.raw_data.BatteryCycle || item.raw_data.bcc || null;
    
    await client.query(`
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
    `, [
      item.raw_data.imei,
      item.raw_data.model,
      modelNumber,
      item.raw_data.carrier || null,
      item.raw_data.storage || null,
      item.raw_data.color || null,
      batteryHealth,
      batteryCount,
      item.raw_data.working || null,
      item.raw_data.location || 'INCOMING'
    ]);

    // Insert into device_test table
    if (item.raw_data.working) {
      await client.query(`
        INSERT INTO device_test (imei, working, notes, tester, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (imei) DO UPDATE SET
          working = EXCLUDED.working,
          notes = EXCLUDED.notes,
          tester = EXCLUDED.tester,
          created_at = NOW()
      `, [
        item.raw_data.imei,
        item.raw_data.working,
        item.raw_data.notes || null,
        item.raw_data.TesterName || item.raw_data.testerName || null
      ]);
    }
  }

  async stop() {
    console.log('\n🛑 Stopping Automated Workflow Manager...');
    this.isRunning = false;
    await this.skuMatchingAgent.stop();
    await pool.end();
    console.log('✅ Workflow stopped');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  if (global.workflowManager) {
    await global.workflowManager.stop();
  }
  process.exit(0);
});

// Start the workflow
async function startWorkflow() {
  global.workflowManager = new AutomatedWorkflowManager();
  await global.workflowManager.start();
}

startWorkflow().catch(console.error);


