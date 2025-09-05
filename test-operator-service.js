const OperatorService = require('./src/services/OperatorService');
require('dotenv').config();

async function testOperatorService() {
    const operatorService = new OperatorService();

    try {
        console.log('🚀 Testing OperatorService...');
        
        // Initialize the service
        await operatorService.initialize();
        console.log('✅ OperatorService initialized successfully');
        
        // Test with a real IMEI
        const testImei = '352707358605214'; // Galaxy Z Fold3 Duos, 512GB, Phantom Black, T-Mobile, CARRIER UNLOCKED
        
        console.log(`\n📱 Testing with IMEI: ${testImei}`);
        
        // Test 1: Get device info
        console.log('\n1️⃣ Testing getDeviceInfo...');
        const deviceInfo = await operatorService.getDeviceInfo(testImei);
        if (deviceInfo) {
            console.log('✅ Device info retrieved:');
            console.log(`   - Model: ${deviceInfo.model}`);
            console.log(`   - Capacity: ${deviceInfo.capacity}`);
            console.log(`   - Color: ${deviceInfo.color}`);
            console.log(`   - Carrier: ${deviceInfo.carrier}`);
            console.log(`   - Location: ${deviceInfo.location}`);
            console.log(`   - Matched SKU: ${deviceInfo.matched_sku}`);
        } else {
            console.log('❌ Device info not found');
        }
        
        // Test 2: Shipping pickup
        console.log('\n2️⃣ Testing shipping pickup...');
        try {
            const shippingResult = await operatorService.shippingQuickPickup(testImei, 'TEST-SHIPPING-OP');
            console.log('✅ Shipping pickup successful:');
            console.log(`   - Action: ${shippingResult.action}`);
            console.log(`   - Old Location: ${shippingResult.oldLocation}`);
            console.log(`   - New Location: ${shippingResult.newLocation}`);
            console.log(`   - Message: ${shippingResult.message}`);
        } catch (error) {
            console.log(`❌ Shipping pickup failed: ${error.message}`);
        }
        
        // Test 3: Postfix update
        console.log('\n3️⃣ Testing postfix update...');
        try {
            const postfixResult = await operatorService.postfixUpdate(testImei, 'A+BOX', 'TEST-POSTFIX-OP');
            console.log('✅ Postfix update successful:');
            console.log(`   - Action: ${postfixResult.action}`);
            console.log(`   - Old SKU: ${postfixResult.oldSku}`);
            console.log(`   - New SKU: ${postfixResult.newSku}`);
            console.log(`   - Grade: ${postfixResult.grade}`);
            console.log(`   - Message: ${postfixResult.message}`);
        } catch (error) {
            console.log(`❌ Postfix update failed: ${error.message}`);
        }
        
        // Test 4: Repair update
        console.log('\n4️⃣ Testing repair update...');
        try {
            const repairResult = await operatorService.repairUpdate(testImei, 'REPAIR-BAY', 'Screen replacement needed', 'TEST-REPAIR-OP');
            console.log('✅ Repair update successful:');
            console.log(`   - Action: ${repairResult.action}`);
            console.log(`   - Old Location: ${repairResult.oldLocation}`);
            console.log(`   - New Location: ${repairResult.newLocation}`);
            console.log(`   - Repair Notes: ${repairResult.repairNotes}`);
            console.log(`   - Message: ${repairResult.message}`);
        } catch (error) {
            console.log(`❌ Repair update failed: ${error.message}`);
        }
        
        // Test 5: Inspector update
        console.log('\n5️⃣ Testing inspector update...');
        try {
            const inspectorResult = await operatorService.inspectorUpdate(testImei, {
                deviceNotes: 'Battery health good, minor scratches on back',
                workingStatus: 'PASS',
                batteryHealth: '85'
            }, 'TEST-INSPECTOR-OP');
            console.log('✅ Inspector update successful:');
            console.log(`   - Action: ${inspectorResult.action}`);
            console.log(`   - Changes: ${JSON.stringify(inspectorResult.changes, null, 2)}`);
            console.log(`   - Message: ${inspectorResult.message}`);
        } catch (error) {
            console.log(`❌ Inspector update failed: ${error.message}`);
        }
        
        // Test 6: Get recent actions
        console.log('\n6️⃣ Testing recent actions...');
        const recentActions = await operatorService.getRecentActions(5);
        console.log('✅ Recent actions retrieved:');
        recentActions.forEach((action, index) => {
            console.log(`   ${index + 1}. ${action.operator_role} - ${action.action_type} (IMEI: ${action.imei})`);
            console.log(`      Time: ${new Date(action.created_at).toLocaleString()}`);
        });
        
        // Test 7: Get available locations
        console.log('\n7️⃣ Testing available locations...');
        const locations = operatorService.getAvailableLocations();
        console.log('✅ Available locations:');
        locations.forEach((location, index) => {
            console.log(`   ${index + 1}. ${location}`);
        });
        
        // Test 8: Get postfix options
        console.log('\n8️⃣ Testing postfix options...');
        const postfixOptions = operatorService.getPostfixOptions();
        console.log('✅ Postfix options:');
        Object.entries(postfixOptions).forEach(([key, value]) => {
            console.log(`   - ${key}: ${value.grade} (${value.condition}) → ${value.postfix}`);
        });
        
        console.log('\n🎉 All OperatorService tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        throw error;
    } finally {
        await operatorService.cleanup();
    }
}

// Run the test
testOperatorService()
    .then(() => {
        console.log('🎉 Phase 1D completed successfully!');
        console.log('📋 Next: Phase 1E - End-to-End Testing');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Phase 1D failed:', error.message);
        process.exit(1);
    });

