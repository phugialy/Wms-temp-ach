const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function processQueueDirectly() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Fetching pending queue items...');
    
    // Get pending items from data_queue
    const result = await client.query(`
      SELECT id, raw_data, source, created_at 
      FROM data_queue 
      WHERE status = 'pending' 
      ORDER BY created_at ASC 
      LIMIT 5
    `);
    
    console.log(`📦 Found ${result.rows.length} pending items`);
    
    for (const item of result.rows) {
      console.log(`\n🔄 Processing item ${item.id}:`);
      console.log(`   IMEI: ${item.raw_data.imei}`);
      console.log(`   Name: ${item.raw_data.name}`);
      console.log(`   Brand: ${item.raw_data.brand}`);
      console.log(`   Model: ${item.raw_data.model}`);
      
      try {
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
        
        console.log(`   ✅ Product created/updated: IMEI ${productResult.rows[0].imei}`);
        
        // Insert into item table (using your original structure with ALL fields)
        const itemResult = await client.query(`
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
          RETURNING imei
        `, [
          item.raw_data.imei,
          item.raw_data.model,
               item.raw_data["Model#"] || item.raw_data.serialNumber || item.raw_data.serialnumber || item.raw_data.model, // Use Model# as model_number
     item.raw_data.carrier || null,
     item.raw_data.storage || null,
     item.raw_data.color || null,
     item.raw_data.batteryHealth || item.raw_data.batteryhealth || item.raw_data.BatteryHealthPercentage || null, // battery_health
     item.raw_data.batteryCycleCount || item.raw_data.BatteryCycle || item.raw_data.bcc || null, // battery_count (cycle count)
          item.raw_data.working || null,
          item.raw_data.location || 'INCOMING'
        ]);
        
        console.log(`   ✅ Item created/updated: IMEI ${itemResult.rows[0].imei}`);
        
        // Insert into device_test table if working status exists
        if (item.raw_data.working) {
          const deviceTestResult = await client.query(`
            INSERT INTO device_test (imei, working, notes, tester, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (imei) DO UPDATE SET
              working = EXCLUDED.working,
              notes = EXCLUDED.notes,
              tester = EXCLUDED.tester,
              created_at = NOW()
            RETURNING imei
          `, [
            item.raw_data.imei,
            item.raw_data.working,
            item.raw_data.notes || null,
            item.raw_data.TesterName || item.raw_data.testerName || null
          ]);
          
          console.log(`   ✅ Device test created/updated: IMEI ${deviceTestResult.rows[0].imei}`);
        }
        
        // Mark queue item as completed
        await client.query(`
          UPDATE data_queue 
          SET status = 'completed', processed_at = NOW() 
          WHERE id = $1
        `, [item.id]);
        
        console.log(`   ✅ Queue item marked as completed`);
        
      } catch (error) {
        console.log(`   ❌ Error processing item: ${error.message}`);
        
        // Mark queue item as failed
        await client.query(`
          UPDATE data_queue 
          SET status = 'failed', error_message = $2, processed_at = NOW() 
          WHERE id = $1
        `, [item.id, error.message]);
      }
    }
    
    // Get updated stats
    const statsResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
      FROM data_queue
    `);
    
    const stats = statsResult.rows[0];
    console.log(`\n📊 Queue Stats:`);
    console.log(`   Total: ${stats.total}`);
    console.log(`   Pending: ${stats.pending}`);
    console.log(`   Completed: ${stats.completed}`);
    console.log(`   Failed: ${stats.failed}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

processQueueDirectly();
