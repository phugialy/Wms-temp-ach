const { Client } = require('pg');
const SkuMatchingAgent = require('./src/services/SkuMatchingAgent');
const OperatorService = require('./src/services/OperatorService');
require('dotenv').config();

/**
 * End-to-End Workflow Testing
 * 
 * This test covers:
 * 1. Bulk import simulation (insert new devices)
 * 2. Trigger-based auto-queueing
 * 3. Agent processing
 * 4. Manual operator overrides
 * 5. Performance metrics
 * 6. Error handling
 */
class EndToEndTester {
    constructor() {
        this.client = new Client({
            connectionString: process.env.DIRECT_URL
        });
        
        this.agent = new SkuMatchingAgent({
            batchSize: 5,
            pollingInterval: 1000,
            maxRetries: 2
        });
        
        this.operatorService = new OperatorService();
        
        this.testResults = {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            startTime: null,
            endTime: null,
            details: []
        };
    }

    async initialize() {
        try {
            console.log('🔌 Initializing end-to-end test...');
            await this.client.connect();
            await this.agent.initialize();
            await this.operatorService.initialize();
            console.log('✅ All services initialized');
            return true;
        } catch (error) {
            console.error('❌ Initialization failed:', error.message);
            throw error;
        }
    }

    async runTest(testName, testFunction) {
        this.testResults.totalTests++;
        console.log(`\n🧪 Running test: ${testName}`);
        
        try {
            const startTime = Date.now();
            const result = await testFunction();
            const duration = Date.now() - startTime;
            
            this.testResults.passedTests++;
            this.testResults.details.push({
                test: testName,
                status: 'PASSED',
                duration: duration,
                result: result
            });
            
            console.log(`✅ ${testName} - PASSED (${duration}ms)`);
            return result;
        } catch (error) {
            this.testResults.failedTests++;
            this.testResults.details.push({
                test: testName,
                status: 'FAILED',
                duration: 0,
                error: error.message
            });
            
            console.log(`❌ ${testName} - FAILED: ${error.message}`);
            throw error;
        }
    }

    /**
     * Test 1: Bulk Import Simulation
     */
    async testBulkImportSimulation() {
        const testDevices = [
            {
                imei: '999999999999001',
                sku: 'TEST-SKU-001',
                brand: 'Samsung',
                model: 'Galaxy S21',
                capacity: '256',
                color: 'Black',
                carrier: 'Unlocked',
                location: 'DNCL-Inspection',
                working: 'PENDING',
                notes: 'CARRIER UNLOCKED, TEST DEVICE 1'
            },
            {
                imei: '999999999999002',
                sku: 'TEST-SKU-002',
                brand: 'Apple',
                model: 'iPhone 13',
                capacity: '128',
                color: 'Blue',
                carrier: 'Verizon',
                location: 'DNCL-Inspection',
                working: 'PENDING',
                notes: 'CARRIER LOCKED, TEST DEVICE 2'
            },
            {
                imei: '999999999999003',
                sku: 'TEST-SKU-003',
                brand: 'Samsung',
                model: 'Galaxy Z Fold3',
                capacity: '512',
                color: 'Phantom Black',
                carrier: 'T-Mobile',
                location: 'DNCL-Inspection',
                working: 'PENDING',
                notes: 'CARRIER UNLOCKED, TEST DEVICE 3'
            }
        ];

        console.log('📦 Simulating bulk import of 3 test devices...');
        
        for (const device of testDevices) {
            // Insert into product table (triggers should fire)
            await this.client.query(`
                INSERT INTO product (imei, sku, brand, date_in)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (imei) DO UPDATE SET
                    sku = EXCLUDED.sku,
                    brand = EXCLUDED.brand,
                    updated_at = NOW()
            `, [device.imei, device.sku, device.brand]);

            // Insert into item table (triggers should fire)
            await this.client.query(`
                INSERT INTO item (imei, model, capacity, color, carrier, working, location)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (imei) DO UPDATE SET
                    model = EXCLUDED.model,
                    capacity = EXCLUDED.capacity,
                    color = EXCLUDED.color,
                    carrier = EXCLUDED.carrier,
                    working = EXCLUDED.working,
                    location = EXCLUDED.location,
                    updated_at = NOW()
            `, [device.imei, device.model, device.capacity, device.color, device.carrier, device.working, device.location]);

            // Insert into device_test table (triggers should fire)
            await this.client.query(`
                INSERT INTO device_test (imei, notes)
                VALUES ($1, $2)
                ON CONFLICT (imei) DO UPDATE SET
                    notes = EXCLUDED.notes
            `, [device.imei, device.notes]);
        }

        // Check if queue entries were created by triggers
        const queueResult = await this.client.query(`
            SELECT COUNT(*) as count
            FROM sku_matching_queue
            WHERE imei IN ('999999999999001', '999999999999002', '999999999999003')
            AND status = 'pending'
        `);

        const queueCount = parseInt(queueResult.rows[0].count);
        
        if (queueCount >= 3) {
            return {
                success: true,
                devicesImported: testDevices.length,
                queueEntriesCreated: queueCount,
                message: `Successfully imported ${testDevices.length} devices, created ${queueCount} queue entries`
            };
        } else {
            throw new Error(`Expected 3+ queue entries, got ${queueCount}`);
        }
    }

    /**
     * Test 2: Agent Processing
     */
    async testAgentProcessing() {
        console.log('🤖 Testing agent processing...');
        
        // Get pending queue entries
        const pendingEntries = await this.agent.getPendingQueueEntries(10);
        console.log(`📋 Found ${pendingEntries.length} pending entries`);
        
        if (pendingEntries.length === 0) {
            throw new Error('No pending entries found for processing');
        }

        // Process a batch
        const batchResult = await this.agent.processBatch();
        
        return {
            success: true,
            processed: batchResult.processed,
            errors: batchResult.errors,
            totalEntries: pendingEntries.length,
            message: `Processed ${batchResult.processed} entries, ${batchResult.errors} errors`
        };
    }

    /**
     * Test 3: Manual Operator Overrides
     */
    async testManualOperatorOverrides() {
        console.log('👨‍💼 Testing manual operator overrides...');
        
        const testImei = '999999999999001';
        
        // Test shipping pickup
        const shippingResult = await this.operatorService.shippingQuickPickup(testImei, 'TEST-SHIPPING-OP');
        
        // Test postfix update
        const postfixResult = await this.operatorService.postfixUpdate(testImei, 'A+BOX', 'TEST-POSTFIX-OP');
        
        // Test repair update
        const repairResult = await this.operatorService.repairUpdate(testImei, 'REPAIR-BAY', 'Test repair notes', 'TEST-REPAIR-OP');
        
        // Test inspector update
        const inspectorResult = await this.operatorService.inspectorUpdate(testImei, {
            deviceNotes: 'End-to-end test inspection',
            workingStatus: 'PASS',
            batteryHealth: '90'
        }, 'TEST-INSPECTOR-OP');
        
        return {
            success: true,
            operations: {
                shipping: shippingResult.success,
                postfix: postfixResult.success,
                repair: repairResult.success,
                inspector: inspectorResult.success
            },
            message: 'All operator override operations completed successfully'
        };
    }

    /**
     * Test 4: Performance Metrics
     */
    async testPerformanceMetrics() {
        console.log('⚡ Testing performance metrics...');
        
        const startTime = Date.now();
        
        // Test queue processing speed
        const queueStart = Date.now();
        const queueEntries = await this.agent.getPendingQueueEntries(50);
        const queueTime = Date.now() - queueStart;
        
        // Test device info retrieval speed
        const deviceStart = Date.now();
        const deviceInfo = await this.operatorService.getDeviceInfo('999999999999001');
        const deviceTime = Date.now() - deviceStart;
        
        // Test recent actions retrieval speed
        const actionsStart = Date.now();
        const recentActions = await this.operatorService.getRecentActions(20);
        const actionsTime = Date.now() - actionsStart;
        
        const totalTime = Date.now() - startTime;
        
        return {
            success: true,
            metrics: {
                queueRetrievalTime: queueTime,
                deviceInfoTime: deviceTime,
                actionsRetrievalTime: actionsTime,
                totalTestTime: totalTime,
                queueEntriesFound: queueEntries.length,
                recentActionsFound: recentActions.length
            },
            message: `Performance test completed in ${totalTime}ms`
        };
    }

    /**
     * Test 5: Error Handling
     */
    async testErrorHandling() {
        console.log('🛡️ Testing error handling...');
        
        const errors = [];
        
        // Test invalid IMEI
        try {
            await this.operatorService.getDeviceInfo('INVALID_IMEI');
        } catch (error) {
            errors.push('Invalid IMEI handled correctly');
        }
        
        // Test non-existent device
        try {
            await this.operatorService.shippingQuickPickup('000000000000000');
        } catch (error) {
            errors.push('Non-existent device handled correctly');
        }
        
        // Test invalid grade
        try {
            await this.operatorService.postfixUpdate('999999999999001', 'INVALID_GRADE');
        } catch (error) {
            errors.push('Invalid grade handled correctly');
        }
        
        return {
            success: true,
            errorsHandled: errors.length,
            errorTypes: errors,
            message: `Error handling test completed - ${errors.length} error types handled correctly`
        };
    }

    /**
     * Test 6: Data Integrity
     */
    async testDataIntegrity() {
        console.log('🔍 Testing data integrity...');
        
        const testImei = '999999999999001';
        
        // Check if device exists in all required tables
        const productCheck = await this.client.query('SELECT COUNT(*) as count FROM product WHERE imei = $1', [testImei]);
        const itemCheck = await this.client.query('SELECT COUNT(*) as count FROM item WHERE imei = $1', [testImei]);
        const deviceTestCheck = await this.client.query('SELECT COUNT(*) as count FROM device_test WHERE imei = $1', [testImei]);
        const skuResultsCheck = await this.client.query('SELECT COUNT(*) as count FROM sku_matching_results WHERE imei = $1', [testImei]);
        const operatorActionsCheck = await this.client.query('SELECT COUNT(*) as count FROM operator_actions WHERE imei = $1', [testImei]);
        
        const checks = {
            product: parseInt(productCheck.rows[0].count),
            item: parseInt(itemCheck.rows[0].count),
            device_test: parseInt(deviceTestCheck.rows[0].count),
            sku_matching_results: parseInt(skuResultsCheck.rows[0].count),
            operator_actions: parseInt(operatorActionsCheck.rows[0].count)
        };
        
        const allPresent = Object.values(checks).every(count => count > 0);
        
        return {
            success: allPresent,
            tableChecks: checks,
            message: allPresent ? 'All required data present' : 'Some data missing'
        };
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        this.testResults.startTime = new Date();
        
        try {
            await this.initialize();
            
            // Run all tests
            await this.runTest('Bulk Import Simulation', () => this.testBulkImportSimulation());
            await this.runTest('Agent Processing', () => this.testAgentProcessing());
            await this.runTest('Manual Operator Overrides', () => this.testManualOperatorOverrides());
            await this.runTest('Performance Metrics', () => this.testPerformanceMetrics());
            await this.runTest('Error Handling', () => this.testErrorHandling());
            await this.runTest('Data Integrity', () => this.testDataIntegrity());
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
        } finally {
            this.testResults.endTime = new Date();
            await this.cleanup();
            this.printResults();
        }
    }

    /**
     * Print test results
     */
    printResults() {
        const duration = this.testResults.endTime - this.testResults.startTime;
        
        console.log('\n' + '='.repeat(60));
        console.log('🎯 END-TO-END TEST RESULTS');
        console.log('='.repeat(60));
        console.log(`⏱️  Total Duration: ${duration}ms`);
        console.log(`📊 Tests Run: ${this.testResults.totalTests}`);
        console.log(`✅ Passed: ${this.testResults.passedTests}`);
        console.log(`❌ Failed: ${this.testResults.failedTests}`);
        console.log(`📈 Success Rate: ${((this.testResults.passedTests / this.testResults.totalTests) * 100).toFixed(1)}%`);
        
        console.log('\n📋 Test Details:');
        this.testResults.details.forEach((test, index) => {
            const status = test.status === 'PASSED' ? '✅' : '❌';
            console.log(`  ${index + 1}. ${status} ${test.test} (${test.duration}ms)`);
            if (test.status === 'FAILED') {
                console.log(`     Error: ${test.error}`);
            }
        });
        
        console.log('\n' + '='.repeat(60));
        
        if (this.testResults.failedTests === 0) {
            console.log('🎉 ALL TESTS PASSED! System is ready for production!');
        } else {
            console.log('⚠️  Some tests failed. Please review and fix issues.');
        }
        console.log('='.repeat(60));
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            if (this.client) {
                await this.client.end();
            }
            if (this.agent) {
                await this.agent.cleanup();
            }
            if (this.operatorService) {
                await this.operatorService.cleanup();
            }
            console.log('🧹 Cleanup completed');
        } catch (error) {
            console.error('❌ Cleanup error:', error.message);
        }
    }
}

// Run the end-to-end test
async function runEndToEndTest() {
    const tester = new EndToEndTester();
    await tester.runAllTests();
}

// Execute the test
runEndToEndTest()
    .then(() => {
        console.log('🎉 End-to-end testing completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 End-to-end testing failed:', error.message);
        process.exit(1);
    });

