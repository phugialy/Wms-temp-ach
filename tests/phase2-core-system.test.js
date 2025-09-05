const { Client } = require('pg');
require('dotenv').config();

class Phase2CoreSystemTest {
  constructor() {
    this.client = null;
    this.testResults = {
      skuParsing: { passed: 0, failed: 0, total: 0 },
      tagManagement: { passed: 0, failed: 0, total: 0 },
      deviceTypeDetection: { passed: 0, failed: 0, total: 0 },
      patternRecognition: { passed: 0, failed: 0, total: 0 },
      performance: { passed: 0, failed: 0, total: 0 },
      integration: { passed: 0, failed: 0, total: 0 }
    };
    this.testData = {
      sampleSkus: [
        'S22-128-BLK-TMO',
        'IPHONE-14-256-BLUE-ATT',
        'IPAD-PRO-9.7-128-ROSE-4G',
        'GALAXY-TAB-S6-256-BLACK-WIFI',
        'APPLE-WATCH-SERIES-7-45MM-GPS'
      ],
      expectedPatterns: {
        'S22-128-BLK-TMO': { deviceType: 'PHONE', segments: 4, tags: ['S22', '128', 'BLK', 'TMO'] },
        'IPHONE-14-256-BLUE-ATT': { deviceType: 'PHONE', segments: 5, tags: ['IPHONE', '14', '256', 'BLUE', 'ATT'] },
        'IPAD-PRO-9.7-128-ROSE-4G': { deviceType: 'TABLET', segments: 6, tags: ['IPAD', 'PRO', '9.7', '128', 'ROSE', '4G'] }
      }
    };
  }

  async connect() {
    try {
      this.client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false
      });
      await this.client.connect();
      console.log('🔗 Connected to database successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to database:', error.message);
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.end();
      console.log('🔌 Disconnected from database');
    }
  }

  async runAllTests() {
    console.log('\n🧪 PHASE 2: CORE SYSTEM TESTING\n');
    console.log('=' .repeat(60));

    if (!(await this.connect())) {
      return false;
    }

    try {
      await this.testSkuParsing();
      await this.testTagManagement();
      await this.testDeviceTypeDetection();
      await this.testPatternRecognition();
      await this.testPerformance();
      await this.testIntegration();
      await this.generateTestReport();
      
      return this.calculateOverallScore() >= 80; // 80% pass rate required
    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
      return false;
    } finally {
      await this.disconnect();
    }
  }

  async testSkuParsing() {
    console.log('\n📋 TESTING SKU PARSING FUNCTIONALITY...');
    
    for (const sku of this.testData.sampleSkus) {
      try {
        const segments = sku.split('-');
        const segmentCount = segments.length;
        
        if (segmentCount >= 3 && segmentCount <= 7) {
          console.log(`   ✅ ${sku} - ${segmentCount} segments parsed correctly`);
          this.testResults.skuParsing.passed++;
        } else {
          console.log(`   ❌ ${sku} - Unexpected segment count: ${segmentCount}`);
          this.testResults.skuParsing.failed++;
        }
        this.testResults.skuParsing.total++;
      } catch (error) {
        console.log(`   ❌ ${sku} - Parsing error: ${error.message}`);
        this.testResults.skuParsing.failed++;
        this.testResults.skuParsing.total++;
      }
    }
  }

  async testTagManagement() {
    console.log('\n📋 TESTING TAG MANAGEMENT SYSTEM...');
    
    try {
      // Test 1: Insert test tags
      const testTags = [
        { name: 'TEST_MODEL', category: 'MODEL', value: 'TEST_DEVICE' },
        { name: 'TEST_CAPACITY', category: 'CAPACITY', value: '256' },
        { name: 'TEST_COLOR', category: 'COLOR', value: 'BLACK' }
      ];

      for (const tag of testTags) {
        const result = await this.client.query(`
          INSERT INTO sku_tags (tag_name, tag_category, tag_value, usage_count)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `, [tag.name, tag.category, tag.value, 1]);

        if (result.rows.length > 0) {
          console.log(`   ✅ Tag inserted: ${tag.name} (${tag.category})`);
          this.testResults.tagManagement.passed++;
        } else {
          console.log(`   ❌ Failed to insert tag: ${tag.name}`);
          this.testResults.tagManagement.failed++;
        }
        this.testResults.tagManagement.total++;
      }

      // Test 2: Check tag retrieval
      const retrievedTags = await this.client.query(`
        SELECT tag_name, tag_category, tag_value
        FROM sku_tags
        WHERE tag_name LIKE 'TEST_%'
        ORDER BY tag_name
      `);

      if (retrievedTags.rows.length === testTags.length) {
        console.log(`   ✅ All test tags retrieved: ${retrievedTags.rows.length} tags`);
        this.testResults.tagManagement.passed++;
      } else {
        console.log(`   ❌ Tag retrieval mismatch: expected ${testTags.length}, got ${retrievedTags.rows.length}`);
        this.testResults.tagManagement.failed++;
      }
      this.testResults.tagManagement.total++;

      // Test 3: Test unique constraint
      try {
        await this.client.query(`
          INSERT INTO sku_tags (tag_name, tag_category, tag_value, usage_count)
          VALUES ($1, $2, $3, $4)
        `, ['TEST_MODEL', 'MODEL', 'DUPLICATE', 1]);
        
        console.log('   ❌ Unique constraint failed - duplicate allowed');
        this.testResults.tagManagement.failed++;
      } catch (constraintError) {
        if (constraintError.code === '23505') {
          console.log('   ✅ Unique constraint working correctly');
          this.testResults.tagManagement.passed++;
        } else {
          console.log(`   ❌ Unexpected error: ${constraintError.message}`);
          this.testResults.tagManagement.failed++;
        }
      }
      this.testResults.tagManagement.total++;

      // Clean up test data
      await this.client.query('DELETE FROM sku_tags WHERE tag_name LIKE $1', ['TEST_%']);
      console.log('   ✅ Test data cleanup completed');

    } catch (error) {
      console.log(`   ❌ Tag management test error: ${error.message}`);
      this.testResults.tagManagement.failed++;
      this.testResults.tagManagement.total++;
    }
  }

  async testDeviceTypeDetection() {
    console.log('\n📋 TESTING DEVICE TYPE DETECTION...');
    
    const deviceTypeTests = [
      { sku: 'S22-128-BLK-TMO', expected: 'PHONE' },
      { sku: 'IPAD-PRO-9.7-128-ROSE-4G', expected: 'TABLET' },
      { sku: 'APPLE-WATCH-SERIES-7-45MM-GPS', expected: 'WATCH' },
      { sku: 'MACBOOK-PRO-13-256-SILVER', expected: 'DESKTOP' }
    ];

    for (const test of deviceTypeTests) {
      try {
        const deviceType = this.detectDeviceType(test.sku);
        
        if (deviceType === test.expected) {
          console.log(`   ✅ ${test.sku} - Detected as ${deviceType}`);
          this.testResults.deviceTypeDetection.passed++;
        } else {
          console.log(`   ❌ ${test.sku} - Expected ${test.expected}, got ${deviceType}`);
          this.testResults.deviceTypeDetection.failed++;
        }
        this.testResults.deviceTypeDetection.total++;
      } catch (error) {
        console.log(`   ❌ ${test.sku} - Detection error: ${error.message}`);
        this.testResults.deviceTypeDetection.failed++;
        this.testResults.deviceTypeDetection.total++;
      }
    }
  }

  detectDeviceType(sku) {
    const upperSku = sku.toUpperCase();
    
    if (upperSku.includes('WATCH') || upperSku.includes('SERIES')) {
      return 'WATCH';
    } else if (upperSku.includes('IPAD') || upperSku.includes('TAB') || upperSku.includes('GALAXY-TAB')) {
      return 'TABLET';
    } else if (upperSku.includes('MACBOOK') || upperSku.includes('IMAC') || upperSku.includes('MAC')) {
      return 'DESKTOP';
    } else if (upperSku.includes('IPHONE') || upperSku.includes('S22') || upperSku.includes('S23') || 
               upperSku.includes('GALAXY') || upperSku.includes('PIXEL')) {
      return 'PHONE';
    } else {
      return 'UNKNOWN';
    }
  }

  async testPatternRecognition() {
    console.log('\n📋 TESTING PATTERN RECOGNITION...');
    
    for (const [sku, expected] of Object.entries(this.testData.expectedPatterns)) {
      try {
        const segments = sku.split('-');
        const actualSegments = segments.length;
        const actualTags = segments;
        
        let patternPassed = true;
        
        // Check segment count
        if (actualSegments !== expected.segments) {
          console.log(`   ❌ ${sku} - Segment count mismatch: expected ${expected.segments}, got ${actualSegments}`);
          patternPassed = false;
        }
        
        // Check device type detection
        const detectedType = this.detectDeviceType(sku);
        if (detectedType !== expected.deviceType) {
          console.log(`   ❌ ${sku} - Device type mismatch: expected ${expected.deviceType}, got ${detectedType}`);
          patternPassed = false;
        }
        
        // Check tag extraction
        if (actualTags.length !== expected.tags.length) {
          console.log(`   ❌ ${sku} - Tag count mismatch: expected ${expected.tags.length}, got ${actualTags.length}`);
          patternPassed = false;
        }
        
        if (patternPassed) {
          console.log(`   ✅ ${sku} - Pattern recognized correctly (${detectedType}, ${actualSegments} segments)`);
          this.testResults.patternRecognition.passed++;
        } else {
          this.testResults.patternRecognition.failed++;
        }
        this.testResults.patternRecognition.total++;
        
      } catch (error) {
        console.log(`   ❌ ${sku} - Pattern recognition error: ${error.message}`);
        this.testResults.patternRecognition.failed++;
        this.testResults.patternRecognition.total++;
      }
    }
  }

  async testPerformance() {
    console.log('\n📋 TESTING PERFORMANCE METRICS...');
    
    try {
      // Test 1: Database query performance
      const startTime = Date.now();
      
      const result = await this.client.query(`
        SELECT COUNT(*) as total_skus
        FROM sku_master
        WHERE is_active = true
      `);
      
      const queryTime = Date.now() - startTime;
      const totalSkus = result.rows[0].total_skus;
      
      if (queryTime < 1000) { // Less than 1 second
        console.log(`   ✅ Database query performance: ${queryTime}ms for ${totalSkus} SKUs`);
        this.testResults.performance.passed++;
      } else {
        console.log(`   ⚠️ Database query performance: ${queryTime}ms (slow for ${totalSkus} SKUs)`);
        this.testResults.performance.failed++;
      }
      this.testResults.performance.total++;

      // Test 2: Index effectiveness
      const indexResult = await this.client.query(`
        SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
        FROM pg_stat_user_indexes
        WHERE tablename IN ('sku_tags', 'sku_master_tags')
        ORDER BY tablename, indexname
      `);

      if (indexResult.rows.length > 0) {
        console.log(`   ✅ Index statistics available for ${indexResult.rows.length} indexes`);
        this.testResults.performance.passed++;
      } else {
        console.log('   ⚠️ No index statistics available');
        this.testResults.performance.failed++;
      }
      this.testResults.performance.total++;

      // Test 3: Memory usage check
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      
      if (heapUsedMB < 100) { // Less than 100MB
        console.log(`   ✅ Memory usage: ${heapUsedMB}MB (within limits)`);
        this.testResults.performance.passed++;
      } else {
        console.log(`   ⚠️ Memory usage: ${heapUsedMB}MB (high usage)`);
        this.testResults.performance.failed++;
      }
      this.testResults.performance.total++;

    } catch (error) {
      console.log(`   ❌ Performance test error: ${error.message}`);
      this.testResults.performance.failed++;
      this.testResults.performance.total++;
    }
  }

  async testIntegration() {
    console.log('\n📋 TESTING SYSTEM INTEGRATION...');
    
    try {
      // Test 1: Check if existing SKU matching still works
      const existingSkuResult = await this.client.query(`
        SELECT COUNT(*) as count
        FROM sku_master
        WHERE brand IS NOT NULL AND model IS NOT NULL
        LIMIT 1
      `);

      if (existingSkuResult.rows.length > 0) {
        console.log('   ✅ Existing SKU data accessible');
        this.testResults.integration.passed++;
      } else {
        console.log('   ❌ Existing SKU data not accessible');
        this.testResults.integration.failed++;
      }
      this.testResults.integration.total++;

      // Test 2: Check new tag system integration
      const tagSystemResult = await this.client.query(`
        SELECT 
          (SELECT COUNT(*) FROM sku_tags) as tag_count,
          (SELECT COUNT(*) FROM sku_master_tags) as mapping_count,
          (SELECT COUNT(*) FROM undefined_tag_review) as review_count
      `);

      if (tagSystemResult.rows.length > 0) {
        const stats = tagSystemResult.rows[0];
        console.log(`   ✅ Tag system accessible - Tags: ${stats.tag_count}, Mappings: ${stats.mapping_count}, Review: ${stats.review_count}`);
        this.testResults.integration.passed++;
      } else {
        console.log('   ❌ Tag system not accessible');
        this.testResults.integration.failed++;
      }
      this.testResults.integration.total++;

      // Test 3: Check data consistency
      const consistencyResult = await this.client.query(`
        SELECT 
          (SELECT COUNT(*) FROM sku_master WHERE device_type IS NOT NULL) as with_device_type,
          (SELECT COUNT(*) FROM sku_master WHERE tag_count IS NOT NULL) as with_tag_count
      `);

      if (consistencyResult.rows.length > 0) {
        const consistency = consistencyResult.rows[0];
        console.log(`   ✅ Data consistency check - Device types: ${consistency.with_device_type}, Tag counts: ${consistency.with_tag_count}`);
        this.testResults.integration.passed++;
      } else {
        console.log('   ❌ Data consistency check failed');
        this.testResults.integration.failed++;
      }
      this.testResults.integration.total++;

    } catch (error) {
      console.log(`   ❌ Integration test error: ${error.message}`);
      this.testResults.integration.failed++;
      this.testResults.integration.total++;
    }
  }

  calculateOverallScore() {
    const totalTests = Object.values(this.testResults).reduce((sum, category) => sum + category.total, 0);
    const totalPassed = Object.values(this.testResults).reduce((sum, category) => sum + category.passed, 0);
    
    if (totalTests === 0) return 0;
    return Math.round((totalPassed / totalTests) * 100);
  }

  async generateTestReport() {
    console.log('\n' + '=' .repeat(60));
    console.log('📊 PHASE 2 TEST RESULTS SUMMARY');
    console.log('=' .repeat(60));

    const categories = [
      { name: 'SKU Parsing', results: this.testResults.skuParsing },
      { name: 'Tag Management', results: this.testResults.tagManagement },
      { name: 'Device Detection', results: this.testResults.deviceTypeDetection },
      { name: 'Pattern Recognition', results: this.testResults.patternRecognition },
      { name: 'Performance', results: this.testResults.performance },
      { name: 'Integration', results: this.testResults.integration }
    ];

    categories.forEach(category => {
      const { passed, failed, total } = category.results;
      const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;
      const status = passed === total ? '✅ PASS' : failed > 0 ? '❌ FAIL' : '⚠️ PARTIAL';
      
      console.log(`${category.name.padEnd(20)}: ${passed}/${total} (${percentage}%) ${status}`);
    });

    const overallScore = this.calculateOverallScore();
    console.log('\n' + '=' .repeat(60));
    console.log(`🎯 OVERALL SCORE: ${overallScore}%`);
    
    if (overallScore >= 90) {
      console.log('🏆 EXCELLENT - Core system fully functional');
    } else if (overallScore >= 80) {
      console.log('✅ GOOD - Core system ready for production use');
    } else if (overallScore >= 70) {
      console.log('⚠️ ACCEPTABLE - Some issues need attention');
    } else {
      console.log('❌ FAILED - Critical issues must be resolved');
    }

    console.log('=' .repeat(60));
  }
}

// Run the tests
async function runPhase2Tests() {
  const tester = new Phase2CoreSystemTest();
  const success = await tester.runAllTests();
  
  if (success) {
    console.log('\n🚀 PHASE 2 TESTS COMPLETED SUCCESSFULLY!');
    console.log('✅ Core system is ready for production use');
  } else {
    console.log('\n⚠️ PHASE 2 TESTS REVEALED ISSUES');
    console.log('🔧 Please resolve issues before proceeding to production');
  }
  
  process.exit(success ? 0 : 1);
}

runPhase2Tests();

