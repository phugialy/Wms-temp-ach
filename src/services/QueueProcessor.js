
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
      const pendingItems = await client.query(`
        SELECT * FROM data_queue
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT 100
      `);
      
      if (pendingItems.rows.length === 0) {
        console.log('ℹ️  No pending items to process');
        return { processed: 0, errors: 0 };
      }
      
      console.log(`📊 Found ${pendingItems.rows.length} pending items`);
      
      let processed = 0;
      let errors = 0;
      
      for (const item of pendingItems.rows) {
        try {
          await this.processItem(client, item);
          processed++;
          console.log(`✅ Processed item ${item.id} (IMEI: ${item.raw_data.imei})`);
        } catch (error) {
          errors++;
          console.log(`❌ Failed to process item ${item.id}: ${error.message}`);
          
          // Mark as failed
          await client.query(`
            UPDATE data_queue 
            SET status = 'failed', error_message = $1, updated_at = NOW()
            WHERE id = $2
          `, [error.message, item.id]);
        }
      }
      
      console.log(`📊 Processing complete: ${processed} processed, ${errors} errors`);
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
    await client.query(`
      INSERT INTO product (imei, brand, sku, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (imei) DO UPDATE SET
        brand = EXCLUDED.brand,
        sku = EXCLUDED.sku,
        updated_at = NOW()
    `, [
      data.imei,
      data.brand,
      data.brand + '-' + data.model + '-' + data.imei.slice(-4)
    ]);
    
    // Insert into item table
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
    
    // Insert into device_test table for all working statuses (including PENDING)
    if (data.working && data.working !== '') {
      await client.query(`
        INSERT INTO device_test (imei, working, notes, tester, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (imei) DO UPDATE SET
          working = EXCLUDED.working,
          notes = EXCLUDED.notes,
          tester = EXCLUDED.tester,
          created_at = NOW()
      `, [
        data.imei,
        data.working,
        data.notes,
        data.TesterName || data.testerName
      ]);
    }
    
    // Insert into sku_matching_queue for SKU matching
    await client.query(`
      INSERT INTO sku_matching_queue (imei, status, created_at, updated_at)
      VALUES ($1, 'pending', NOW(), NOW())
      ON CONFLICT (imei) DO UPDATE SET
        status = 'pending',
        updated_at = NOW()
    `, [data.imei]);
    
    // Mark as completed
    await client.query(`
      UPDATE data_queue 
      SET status = 'completed', processed_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [item.id]);
  }
}

// Export for use
module.exports = QueueProcessor;
