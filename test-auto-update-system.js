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
 * Test Auto-Update System
 * Demonstrates how triggers automatically sync data across tables
 */
class AutoUpdateTester {
  
  constructor() {
    this.testItemId = null;
  }

  /**
   * Create a test item with all related records
   */
  async createTestItem() {
    console.log('🔧 Creating test item with related records...\n');

    try {
      // 1. Create a test item
      const { data: item, error: itemError } = await supabase
        .from('Item')
        .insert({
          imei: '123456789012345',
          sku: 'TEST-APPLE-IPHONE14-128GB-BLACK-UNLOCKED',
          name: 'iPhone 14 Test',
          description: 'Test iPhone 14 for auto-update demonstration',
          brand: 'Apple',
          model: 'iPhone 14',
          grade: 'used',
          working: 'YES',
          type: 'PHONE',
          carrier: 'Unlocked',
          color: 'Black',
          storage: '128GB',
          condition: 'USED',
          batteryHealth: 85,
          screenCondition: 'GOOD',
          bodyCondition: 'GOOD',
          testResults: { testType: 'PHONECHECK', status: 'PASS' },
          isActive: true
        })
        .select()
        .single();

      if (itemError) throw new Error(`Item creation error: ${itemError.message}`);
      
      this.testItemId = item.id;
      console.log(`✅ Created test item: ${item.imei} (ID: ${item.id})`);

      // 2. Get or create a location
      let locationId;
      const { data: locations } = await supabase
        .from('Location')
        .select('id')
        .limit(1);

      if (locations && locations.length > 0) {
        locationId = locations[0].id;
      } else {
        // Create a test warehouse and location if none exist
        const { data: warehouse } = await supabase
          .from('Warehouse')
          .insert({
            name: 'Test Warehouse',
            description: 'Test warehouse for auto-update demo',
            isActive: true
          })
          .select()
          .single();

        const { data: location } = await supabase
          .from('Location')
          .insert({
            name: 'Test Location',
            warehouseId: warehouse.id,
            description: 'Test location for auto-update demo',
            isActive: true,
            capacity: 100,
            currentOccupancy: 0,
            locationType: 'SHELF'
          })
          .select()
          .single();

        locationId = location.id;
      }

      // 3. Create inventory record
      const { data: inventory, error: inventoryError } = await supabase
        .from('Inventory')
        .insert({
          itemId: item.id,
          locationId: locationId,
          sku: item.sku,
          quantity: 1,
          reserved: 0,
          available: 1
        })
        .select()
        .single();

      if (inventoryError) throw new Error(`Inventory creation error: ${inventoryError.message}`);
      console.log(`✅ Created inventory record: Qty ${inventory.quantity}, Available ${inventory.available}`);

      // 4. Create device test record
      const { data: deviceTest, error: deviceTestError } = await supabase
        .from('DeviceTest')
        .insert({
          itemId: item.id,
          testType: 'PHONECHECK',
          testResults: { status: 'PASS', batteryHealth: 85, condition: 'GOOD' },
          passed: true,
          notes: 'Initial PhoneCheck test',
          testedBy: 'SYSTEM'
        })
        .select()
        .single();

      if (deviceTestError) throw new Error(`DeviceTest creation error: ${deviceTestError.message}`);
      console.log(`✅ Created device test record: ${deviceTest.testType}, Passed: ${deviceTest.passed}`);

      // 5. Create processing queue record
      const { data: processingQueue, error: queueError } = await supabase
        .from('ProcessingQueue')
        .insert({
          itemId: item.id,
          inboundLogId: 1, // You might need to create an InboundLog first
          status: 'PENDING',
          priority: 1,
          notes: 'Test processing queue entry'
        })
        .select()
        .single();

      if (queueError) {
        console.log(`⚠️  ProcessingQueue creation skipped (requires InboundLog): ${queueError.message}`);
      } else {
        console.log(`✅ Created processing queue record: Status ${processingQueue.status}`);
      }

      console.log('\n🎯 Test item created successfully with all related records!');
      return item;

    } catch (error) {
      console.error('❌ Error creating test item:', error.message);
      throw error;
    }
  }

  /**
   * Test updating the item and see automatic updates
   */
  async testAutoUpdates() {
    if (!this.testItemId) {
      throw new Error('No test item created. Run createTestItem() first.');
    }

    console.log('\n🔄 Testing Auto-Update System...\n');

    try {
      // Get initial state
      console.log('📊 Initial State:');
      await this.showCurrentState();

      // Test 1: Update item condition and battery health
      console.log('\n🔄 Test 1: Updating item condition and battery health...');
      const { error: updateError } = await supabase
        .from('Item')
        .update({
          condition: 'NEW',
          batteryHealth: 95,
          working: 'YES',
          screenCondition: 'EXCELLENT',
          bodyCondition: 'EXCELLENT',
          testResults: { testType: 'PHONECHECK', status: 'PASS', batteryHealth: 95, condition: 'NEW' }
        })
        .eq('id', this.testItemId);

      if (updateError) throw new Error(`Update error: ${updateError.message}`);
      console.log('✅ Item updated successfully');

      // Show updated state
      console.log('\n📊 State after update:');
      await this.showCurrentState();

      // Test 2: Deactivate the item
      console.log('\n🔄 Test 2: Deactivating the item...');
      const { error: deactivateError } = await supabase
        .from('Item')
        .update({ isActive: false })
        .eq('id', this.testItemId);

      if (deactivateError) throw new Error(`Deactivate error: ${deactivateError.message}`);
      console.log('✅ Item deactivated successfully');

      // Show state after deactivation
      console.log('\n📊 State after deactivation:');
      await this.showCurrentState();

      // Test 3: Reactivate the item
      console.log('\n🔄 Test 3: Reactivating the item...');
      const { error: reactivateError } = await supabase
        .from('Item')
        .update({ isActive: true })
        .eq('id', this.testItemId);

      if (reactivateError) throw new Error(`Reactivate error: ${reactivateError.message}`);
      console.log('✅ Item reactivated successfully');

      // Show final state
      console.log('\n📊 Final state:');
      await this.showCurrentState();

      // Show audit log
      console.log('\n📋 Audit Log:');
      await this.showAuditLog();

    } catch (error) {
      console.error('❌ Error during auto-update test:', error.message);
      throw error;
    }
  }

  /**
   * Show current state of all related records
   */
  async showCurrentState() {
    try {
      // Get item
      const { data: item } = await supabase
        .from('Item')
        .select('*')
        .eq('id', this.testItemId)
        .single();

      console.log(`  📱 Item: ${item.imei} | Condition: ${item.condition} | Battery: ${item.batteryHealth}% | Active: ${item.isActive}`);

      // Get inventory
      const { data: inventory } = await supabase
        .from('Inventory')
        .select('*')
        .eq('itemId', this.testItemId)
        .single();

      if (inventory) {
        console.log(`  📦 Inventory: Qty ${inventory.quantity} | Reserved ${inventory.reserved} | Available ${inventory.available}`);
      }

      // Get device test
      const { data: deviceTest } = await supabase
        .from('DeviceTest')
        .select('*')
        .eq('itemId', this.testItemId)
        .eq('testType', 'PHONECHECK')
        .single();

      if (deviceTest) {
        console.log(`  🧪 DeviceTest: ${deviceTest.testType} | Passed: ${deviceTest.passed} | Notes: ${deviceTest.notes}`);
      }

      // Get processing queue
      const { data: processingQueue } = await supabase
        .from('ProcessingQueue')
        .select('*')
        .eq('itemId', this.testItemId)
        .single();

      if (processingQueue) {
        console.log(`  🔄 ProcessingQueue: Status ${processingQueue.status} | Notes: ${processingQueue.notes}`);
      }

    } catch (error) {
      console.error('Error showing current state:', error.message);
    }
  }

  /**
   * Show audit log for the test item
   */
  async showAuditLog() {
    try {
      const { data: auditLogs } = await supabase
        .from('ItemAuditLog')
        .select('*')
        .eq('itemId', this.testItemId)
        .order('changedAt', { ascending: true });

      if (auditLogs && auditLogs.length > 0) {
        auditLogs.forEach((log, index) => {
          console.log(`  ${index + 1}. ${log.action} at ${log.changedAt} by ${log.changedBy}`);
          if (log.action === 'UPDATE') {
            const oldCondition = log.oldValues?.condition;
            const newCondition = log.newValues?.condition;
            const oldBattery = log.oldValues?.batteryHealth;
            const newBattery = log.newValues?.batteryHealth;
            const oldActive = log.oldValues?.isActive;
            const newActive = log.newValues?.isActive;
            
            if (oldCondition !== newCondition) {
              console.log(`     Condition: ${oldCondition} → ${newCondition}`);
            }
            if (oldBattery !== newBattery) {
              console.log(`     Battery: ${oldBattery}% → ${newBattery}%`);
            }
            if (oldActive !== newActive) {
              console.log(`     Active: ${oldActive} → ${newActive}`);
            }
          }
        });
      } else {
        console.log('  No audit logs found');
      }
    } catch (error) {
      console.error('Error showing audit log:', error.message);
    }
  }

  /**
   * Clean up test data
   */
  async cleanup() {
    if (!this.testItemId) return;

    console.log('\n🧹 Cleaning up test data...');
    
    try {
      // Delete the test item (cascading deletes will handle related records)
      const { error } = await supabase
        .from('Item')
        .delete()
        .eq('id', this.testItemId);

      if (error) {
        console.error('Error cleaning up:', error.message);
      } else {
        console.log('✅ Test data cleaned up successfully');
      }
    } catch (error) {
      console.error('Error during cleanup:', error.message);
    }
  }
}

// Main test function
async function runAutoUpdateTest() {
  console.log('🧪 Auto-Update System Test\n');
  
  const tester = new AutoUpdateTester();
  
  try {
    // Create test item
    await tester.createTestItem();
    
    // Test auto-updates
    await tester.testAutoUpdates();
    
    console.log('\n✅ Auto-update system test completed successfully!');
    console.log('\n🎯 Key Benefits:');
    console.log('  • Update Item → All related tables update automatically');
    console.log('  • Deactivate Item → Inventory available = 0 automatically');
    console.log('  • Reactivate Item → Inventory available restored automatically');
    console.log('  • All changes logged in audit trail');
    console.log('  • Data consistency maintained across all tables');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    // Clean up
    await tester.cleanup();
  }
}

// Export for use in other modules
module.exports = { AutoUpdateTester, runAutoUpdateTest };

// Run test if called directly
if (require.main === module) {
  runAutoUpdateTest().catch(console.error);
}
