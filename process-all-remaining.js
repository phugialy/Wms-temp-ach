const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function processAllRemaining() {
  const client = await pool.connect();
  try {
    // Process all remaining items
    const result = await client.query(`
      SELECT id, raw_data, created_at 
      FROM data_queue 
      WHERE status = 'pending' 
      ORDER BY created_at ASC
    `);
    
    console.log(`📦 Processing ${result.rows.length} remaining items...`);
    
    let processed = 0;
    let failed = 0;
    
    for (const item of result.rows) {
      try {
        // Insert into product table
        await client.query(`
          INSERT INTO product (imei, brand, sku, created_at, updated_at)
          VALUES ($1, $2, $3, NOW(), NOW())
          ON CONFLICT (imei) DO UPDATE SET
            brand = EXCLUDED.brand,
            sku = EXCLUDED.sku,
            updated_at = NOW()
        `, [
          item.raw_data.imei,
          item.raw_data.brand,
          `${item.raw_data.brand}-${item.raw_data.model}-${item.raw_data.imei.slice(-4)}`
        ]);
        
        // Insert into item table (using your original structure with ALL fields)
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
               item.raw_data["Model#"] || item.raw_data.serialNumber || item.raw_data.serialnumber || item.raw_data.model, // Use Model# as model_number
     item.raw_data.carrier || null,
     item.raw_data.storage || null,
     item.raw_data.color || null,
     item.raw_data.batteryHealth || item.raw_data.batteryhealth || item.raw_data.BatteryHealthPercentage || null, // battery_health
     item.raw_data.batteryCycleCount || item.raw_data.BatteryCycle || item.raw_data.bcc || null, // battery_count (cycle count)
          item.raw_data.working || null,
          item.raw_data.location || 'INCOMING'
        ]);
        
        // Insert into device_test table if working status exists
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
        
        // Mark queue item as completed
        await client.query(`
          UPDATE data_queue 
          SET status = 'completed', processed_at = NOW() 
          WHERE id = $1
        `, [item.id]);
        
        processed++;
        if (processed % 10 === 0) {
          console.log(`✅ Processed ${processed} items...`);
        }
        
      } catch (error) {
        console.log(`❌ Error processing ${item.raw_data.imei}: ${error.message}`);
        
        // Mark queue item as failed
        await client.query(`
          UPDATE data_queue 
          SET status = 'failed', error_message = $2, processed_at = NOW() 
          WHERE id = $1
        `, [item.id, error.message]);
        
        failed++;
      }
    }
    
    console.log(`\n🎉 Processing complete!`);
    console.log(`✅ Successfully processed: ${processed}`);
    console.log(`❌ Failed: ${failed}`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

processAllRemaining();
