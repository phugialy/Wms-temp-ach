const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function checkErrorDetails() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking error details...');
    
    // Check the failed item
    const failedItem = await client.query(`
      SELECT id, status, error_message, raw_data->>'imei' as imei
      FROM data_queue 
      WHERE status = 'failed'
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (failedItem.rows.length > 0) {
      console.log('📋 Failed item details:');
      console.log(`  ID: ${failedItem.rows[0].id}`);
      console.log(`  Status: ${failedItem.rows[0].status}`);
      console.log(`  Error: ${failedItem.rows[0].error_message}`);
      console.log(`  IMEI: ${failedItem.rows[0].imei}`);
    }
    
    // The issue might be that we need to use a different approach
    // Let's try to process the data without using the ->> operator
    console.log('\n🧪 Testing alternative approach...');
    
    const testData = {
      imei: '555555555555555',
      brand: 'Samsung',
      model: 'Galaxy S21',
      working: 'YES',
      carrier: 'Verizon',
      storage: '256GB',
      color: 'Black'
    };
    
    // Test direct insertion without triggers
    try {
      const result = await client.query(`
        INSERT INTO data_queue (raw_data, status, source)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [testData, 'pending', 'test']);
      
      console.log(`✅ Direct insert successful: ID ${result.rows[0].id}`);
      
      // Now try to process it manually with a different approach
      const queueItem = await client.query(`
        SELECT * FROM data_queue WHERE id = $1
      `, [result.rows[0].id]);
      
      if (queueItem.rows.length > 0) {
        const item = queueItem.rows[0];
        console.log('📋 Queue item retrieved successfully');
        
        // Try to access the JSONB data
        const rawData = item.raw_data;
        console.log('📋 Raw data type:', typeof rawData);
        console.log('📋 Raw data keys:', Object.keys(rawData));
        
        // Try to insert into product table using JavaScript object access
        try {
          const productResult = await client.query(`
            INSERT INTO product (imei, brand, sku, created_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
            ON CONFLICT (imei) DO UPDATE SET
              brand = EXCLUDED.brand,
              sku = EXCLUDED.sku,
              updated_at = NOW()
            RETURNING imei
          `, [
            rawData.imei,
            rawData.brand,
            rawData.brand + '-' + rawData.model + '-' + rawData.imei.slice(-4)
          ]);
          
          console.log(`✅ Product insert successful: ${productResult.rows[0].imei}`);
          
          // Try to insert into item table
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
            rawData.imei,
            rawData.model,
            rawData.serialNumber || rawData.serialnumber || rawData.model,
            rawData.carrier,
            rawData.storage,
            rawData.color,
            rawData.batteryHealth || rawData.batteryhealth || rawData.BatteryHealthPercentage,
            rawData.batteryCycleCount || rawData.BatteryCycle || rawData.bcc,
            rawData.working,
            rawData.location || 'INCOMING'
          ]);
          
          console.log(`✅ Item insert successful: ${itemResult.rows[0].imei}`);
          
          // Update queue status
          await client.query(`
            UPDATE data_queue 
            SET status = 'completed', processed_at = NOW(), updated_at = NOW()
            WHERE id = $1
          `, [result.rows[0].id]);
          
          console.log('✅ Queue item marked as completed');
          
          // Clean up
          await client.query(`DELETE FROM item WHERE imei = $1`, [rawData.imei]);
          await client.query(`DELETE FROM product WHERE imei = $1`, [rawData.imei]);
          await client.query(`DELETE FROM data_queue WHERE id = $1`, [result.rows[0].id]);
          
          console.log('✅ Test data cleaned up');
          console.log('\n🎉 Alternative approach works! The issue is with the ->> operator in PostgreSQL functions.');
          
        } catch (error) {
          console.log(`❌ Product/Item insert failed: ${error.message}`);
        }
      }
      
    } catch (error) {
      console.log(`❌ Direct insert failed: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkErrorDetails();


