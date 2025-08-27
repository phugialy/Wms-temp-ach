const { Client } = require('pg');
require('dotenv').config();

// Simple queue system that actually connects to database
class DatabaseQueue {
  constructor() {
    this.client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  async connect() {
    await this.client.connect();
    console.log('✅ Connected to database');
  }

  async disconnect() {
    await this.client.end();
  }

  // Generate SKU from device data
  generateSKU(data) {
    const model = (data.model || data.device_model || '').replace(/\s+/g, '');
    const capacity = data.capacity || data.storage || '';
    const color = (data.color || '').substring(0, 3).toUpperCase();
    const carrier = (data.carrier || data.carrier_status || 'UNL').substring(0, 3).toUpperCase();
    
    return `${model}-${capacity}-${color}-${carrier}`;
  }

  // Process data into database tables
  async processDataToDatabase(data) {
    const imei = data.imei;
    if (!imei) {
      throw new Error('IMEI is required');
    }

    const sku = this.generateSKU(data);
    console.log(`📝 Processing IMEI: ${imei}, SKU: ${sku}`);

    try {
      // Insert into Product table
      await this.client.query(`
        INSERT INTO product (imei, sku, brand) 
        VALUES ($1, $2, $3)
        ON CONFLICT (imei) DO UPDATE SET 
          sku = EXCLUDED.sku,
          brand = EXCLUDED.brand,
          updated_at = NOW()
      `, [imei, sku, data.brand || data.device_brand]);

      // Insert into Item table
      await this.client.query(`
        INSERT INTO item (imei, model, carrier, capacity, color, battery_health, battery_count, working, location)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (imei) DO UPDATE SET
          model = EXCLUDED.model,
          carrier = EXCLUDED.carrier,
          capacity = EXCLUDED.capacity,
          color = EXCLUDED.color,
          battery_health = EXCLUDED.battery_health,
          battery_count = EXCLUDED.battery_count,
          working = EXCLUDED.working,
          location = EXCLUDED.location,
          updated_at = NOW()
      `, [
        imei, 
        data.model || data.device_model,
        data.carrier || data.carrier_status,
        data.capacity || data.storage,
        data.color,
        data.battery_health,
        data.battery_count || data.bcc,
        data.working || data.test_result || 'PENDING',
        data.location || 'DNCL-Inspection'
      ]);

      // Insert into DeviceTest table
      await this.client.query(`
        INSERT INTO device_test (imei, working, defects, notes, custom1)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (imei) DO UPDATE SET
          working = EXCLUDED.working,
          defects = EXCLUDED.defects,
          notes = EXCLUDED.notes,
          custom1 = EXCLUDED.custom1,
          test_date = NOW()
      `, [
        imei,
        data.working || data.test_result || 'PENDING',
        data.defects || data.device_defects || null,
        data.notes || data.test_notes || null,
        data.custom1 || data.repair_notes || null
      ]);

      // Update or create Inventory record
      await this.client.query(`
        INSERT INTO inventory (sku, location, qty_total, pass_devices, failed_devices, reserved, available)
        VALUES ($1, $2, 1, $3, $4, 0, 1)
        ON CONFLICT (sku, location) DO UPDATE SET
          qty_total = inventory.qty_total + 1,
          pass_devices = inventory.pass_devices + $3,
          failed_devices = inventory.failed_devices + $4,
          available = inventory.available + 1,
          updated_at = NOW()
      `, [
        sku,
        data.location || 'DNCL-Inspection',
        (data.working === 'YES' || data.working === 'PASS') ? 1 : 0,
        (data.working === 'NO' || data.working === 'FAILED') ? 1 : 0
      ]);

      console.log(`✅ Successfully processed IMEI: ${imei}`);
    } catch (error) {
      console.error(`❌ Error processing IMEI ${imei}:`, error.message);
      throw error;
    }
  }

  // Process bulk data
  async processBulkData(bulkData) {
    console.log(`📦 Processing bulk data with ${bulkData.items?.length || 0} items`);
    
    for (const item of bulkData.items || []) {
      try {
        await this.processDataToDatabase(item);
      } catch (error) {
        console.error(`Failed to process item:`, error.message);
      }
    }
    
    console.log('✅ Bulk data processing completed');
  }

  // Process PhoneCheck data
  async processPhoneCheckData(phonecheckData) {
    console.log(`📱 Processing PhoneCheck data for IMEI: ${phonecheckData.imei}`);
    
    // Mock PhoneCheck API response
    const mockPhoneCheckData = {
      imei: phonecheckData.imei,
      device_model: 'iPhone 14 Pro',
      device_brand: 'Apple',
      storage: '256GB',
      color: 'Space Black',
      carrier_status: 'Unlocked',
      battery_health: '95%',
      bcc: 150,
      test_result: 'PASS',
      device_defects: 'None',
      test_notes: 'Device passed all tests',
      repair_notes: 'No repairs needed',
      location: 'DNCL-Inspection'
    };
    
    await this.processDataToDatabase(mockPhoneCheckData);
  }

  // Get database stats
  async getDatabaseStats() {
    const stats = {};
    
    // Count records in each table
    const tables = ['product', 'item', 'device_test', 'inventory', 'movement_history'];
    for (const table of tables) {
      const result = await this.client.query(`SELECT COUNT(*) FROM ${table}`);
      stats[table] = parseInt(result.rows[0].count);
    }
    
    // Check views
    try {
      const inventoryViewResult = await this.client.query('SELECT COUNT(*) FROM inventory_view');
      stats.inventory_view = parseInt(inventoryViewResult.rows[0].count);
    } catch (error) {
      stats.inventory_view = 0;
    }
    
    try {
      const deletionViewResult = await this.client.query('SELECT COUNT(*) FROM deletion_view');
      stats.deletion_view = parseInt(deletionViewResult.rows[0].count);
    } catch (error) {
      stats.deletion_view = 0;
    }
    
    return stats;
  }
}

// Test function
async function testDatabaseQueue() {
  const queue = new DatabaseQueue();
  
  try {
    console.log('🧪 Testing Database Queue System...\n');
    
    // Connect to database
    await queue.connect();
    
    // Test 1: Process bulk data
    console.log('📦 Testing bulk data processing...');
    const bulkData = {
      source: 'bulk-add',
      batchId: 'test-batch-001',
      items: [
        {
          imei: '111111111111111',
          model: 'iPhone 14 Pro',
          brand: 'Apple',
          capacity: '256GB',
          color: 'Space Black',
          carrier: 'Unlocked',
          working: 'YES',
          location: 'DNCL-Inspection',
          battery_health: '95%',
          battery_count: 150,
          defects: 'None',
          notes: 'Device passed all tests'
        },
        {
          imei: '222222222222222',
          model: 'Samsung Galaxy S23',
          brand: 'Samsung',
          capacity: '512GB',
          color: 'Phantom Black',
          carrier: 'AT&T',
          working: 'NO',
          location: 'DNCL-Inspection',
          battery_health: '20%',
          battery_count: 800,
          defects: 'Screen cracked',
          notes: 'Device failed inspection'
        },
        {
          imei: '333333333333333',
          model: 'Google Pixel 8',
          brand: 'Google',
          capacity: '128GB',
          color: 'Hazel',
          carrier: 'T-Mobile',
          working: 'PENDING',
          location: 'DNCL-Inspection'
        }
      ]
    };
    
    await queue.processBulkData(bulkData);
    
    // Test 2: Process PhoneCheck data
    console.log('\n📱 Testing PhoneCheck data processing...');
    const phonecheckData = {
      imei: '444444444444444',
      source: 'phonecheck-api'
    };
    
    await queue.processPhoneCheckData(phonecheckData);
    
    // Test 3: Get database stats
    console.log('\n📊 Getting database statistics...');
    const stats = await queue.getDatabaseStats();
    console.log('Database Stats:', JSON.stringify(stats, null, 2));
    
    // Test 4: Show sample data from views
    console.log('\n👀 Sample data from views:');
    
    try {
      const inventoryViewData = await queue.client.query('SELECT * FROM inventory_view LIMIT 3');
      console.log('Inventory View:', inventoryViewData.rows);
    } catch (error) {
      console.log('Inventory View Error:', error.message);
    }
    
    try {
      const deletionViewData = await queue.client.query('SELECT * FROM deletion_view LIMIT 3');
      console.log('Deletion View:', deletionViewData.rows);
    } catch (error) {
      console.log('Deletion View Error:', error.message);
    }
    
    console.log('\n🎉 Database queue system test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await queue.disconnect();
  }
}

// Run test
testDatabaseQueue();
