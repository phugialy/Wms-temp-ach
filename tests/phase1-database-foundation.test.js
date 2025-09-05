const { Client } = require('pg');
require('dotenv').config();

class Phase1DatabaseFoundationTest {
  constructor() {
    this.client = null;
    this.testResults = {
      tables: { passed: 0, failed: 0, total: 0 },
      columns: { passed: 0, failed: 0, total: 0 },
      constraints: { passed: 0, failed: 0, total: 0 },
      indexes: { passed: 0, failed: 0, total: 0 },
      triggers: { passed: 0, failed: 0, total: 0 },
      dataIntegrity: { passed: 0, failed: 0, total: 0 }
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
    console.log('\n🧪 PHASE 1: DATABASE FOUNDATION TESTING\n');
    console.log('=' .repeat(60));

    if (!(await this.connect())) {
      return false;
    }

    try {
      await this.testTables();
      await this.testColumns();
      await this.testConstraints();
      await this.testIndexes();
      await this.testTriggers();
      await this.testDataIntegrity();
      await this.generateTestReport();
      
      return this.calculateOverallScore() >= 80; // 80% pass rate required
    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
      return false;
    } finally {
      await this.disconnect();
    }
  }

  async testTables() {
    console.log('\n📋 TESTING NEW TABLES...');
    
    const expectedTables = [
      { name: 'sku_tags', description: 'Tag definitions storage' },
      { name: 'sku_master_tags', description: 'SKU-to-tag relationships' },
      { name: 'undefined_tag_review', description: 'Manual review queue' }
    ];

    for (const expectedTable of expectedTables) {
      try {
        const result = await this.client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )
        `, [expectedTable.name]);

        if (result.rows[0].exists) {
          console.log(`   ✅ ${expectedTable.name} - ${expectedTable.description}`);
          this.testResults.tables.passed++;
        } else {
          console.log(`   ❌ ${expectedTable.name} - Table not found`);
          this.testResults.tables.failed++;
        }
        this.testResults.tables.total++;
      } catch (error) {
        console.log(`   ❌ ${expectedTable.name} - Test error: ${error.message}`);
        this.testResults.tables.failed++;
        this.testResults.tables.total++;
      }
    }
  }

  async testColumns() {
    console.log('\n📋 TESTING NEW COLUMNS IN SKU_MASTER...');
    
    const expectedColumns = [
      { name: 'device_type', type: 'character varying', nullable: 'YES' },
      { name: 'tag_count', type: 'integer', nullable: 'YES' }
    ];

    for (const expectedColumn of expectedColumns) {
      try {
        const result = await this.client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_name = 'sku_master' 
          AND column_name = $1
        `, [expectedColumn.name]);

        if (result.rows.length > 0) {
          const column = result.rows[0];
          if (column.data_type === expectedColumn.type && 
              column.is_nullable === expectedColumn.nullable) {
            console.log(`   ✅ ${expectedColumn.name} - Type: ${column.data_type}, Nullable: ${column.is_nullable}`);
            this.testResults.columns.passed++;
          } else {
            console.log(`   ⚠️ ${expectedColumn.name} - Type mismatch or nullable issue`);
            this.testResults.columns.failed++;
          }
        } else {
          console.log(`   ❌ ${expectedColumn.name} - Column not found`);
          this.testResults.columns.failed++;
        }
        this.testResults.columns.total++;
      } catch (error) {
        console.log(`   ❌ ${expectedColumn.name} - Test error: ${error.message}`);
        this.testResults.columns.failed++;
        this.testResults.columns.total++;
      }
    }
  }

  async testConstraints() {
    console.log('\n📋 TESTING CONSTRAINTS...');
    
    try {
      const result = await this.client.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints 
        WHERE table_name = 'sku_tags' 
        AND constraint_name = 'sku_tags_name_category_unique'
      `);

      if (result.rows.length > 0) {
        const constraint = result.rows[0];
        if (constraint.constraint_type === 'UNIQUE') {
          console.log(`   ✅ ${constraint.constraint_name} - ${constraint.constraint_type} constraint`);
          this.testResults.constraints.passed++;
        } else {
          console.log(`   ❌ ${constraint.constraint_name} - Wrong constraint type: ${constraint.constraint_type}`);
          this.testResults.constraints.failed++;
        }
      } else {
        console.log('   ❌ sku_tags_name_category_unique constraint not found');
        this.testResults.constraints.failed++;
      }
      this.testResults.constraints.total++;
    } catch (error) {
      console.log(`   ❌ Constraint test error: ${error.message}`);
      this.testResults.constraints.failed++;
      this.testResults.constraints.total++;
    }
  }

  async testIndexes() {
    console.log('\n📋 TESTING PERFORMANCE INDEXES...');
    
    const expectedIndexes = [
      'idx_sku_tags_category',
      'idx_sku_tags_name',
      'idx_sku_master_tags_sku_id',
      'idx_sku_master_tags_tag_id',
      'idx_sku_master_device_type',
      'idx_undefined_tag_review_status'
    ];

    for (const indexName of expectedIndexes) {
      try {
        const result = await this.client.query(`
          SELECT indexname, tablename 
          FROM pg_indexes 
          WHERE indexname = $1
        `, [indexName]);

        if (result.rows.length > 0) {
          const index = result.rows[0];
          console.log(`   ✅ ${index.indexname} on ${index.tablename}`);
          this.testResults.indexes.passed++;
        } else {
          console.log(`   ❌ ${indexName} - Index not found`);
          this.testResults.indexes.failed++;
        }
        this.testResults.indexes.total++;
      } catch (error) {
        console.log(`   ❌ ${indexName} - Test error: ${error.message}`);
        this.testResults.indexes.failed++;
        this.testResults.indexes.total++;
      }
    }
  }

  async testTriggers() {
    console.log('\n📋 TESTING AUTO-UPDATE TRIGGERS...');
    
    const expectedTriggers = [
      { name: 'update_sku_tags_updated_at', table: 'sku_tags' },
      { name: 'update_undefined_tag_review_updated_at', table: 'undefined_tag_review' }
    ];

    for (const expectedTrigger of expectedTriggers) {
      try {
        const result = await this.client.query(`
          SELECT trigger_name, event_object_table
          FROM information_schema.triggers 
          WHERE trigger_name = $1
        `, [expectedTrigger.name]);

        if (result.rows.length > 0) {
          const trigger = result.rows[0];
          if (trigger.event_object_table === expectedTrigger.table) {
            console.log(`   ✅ ${trigger.trigger_name} on ${trigger.event_object_table}`);
            this.testResults.triggers.passed++;
          } else {
            console.log(`   ❌ ${expectedTrigger.name} - Wrong table: ${trigger.event_object_table}`);
            this.testResults.triggers.failed++;
          }
        } else {
          console.log(`   ❌ ${expectedTrigger.name} - Trigger not found`);
          this.testResults.triggers.failed++;
        }
        this.testResults.triggers.total++;
      } catch (error) {
        console.log(`   ❌ ${expectedTrigger.name} - Test error: ${error.message}`);
        this.testResults.triggers.failed++;
        this.testResults.triggers.total++;
      }
    }
  }

  async testDataIntegrity() {
    console.log('\n📋 TESTING DATA INTEGRITY...');
    
    try {
      // Test 1: Check if we can insert a test tag
      const insertResult = await this.client.query(`
        INSERT INTO sku_tags (tag_name, tag_category, tag_value, usage_count)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, ['TEST_TAG', 'TEST_CATEGORY', 'TEST_VALUE', 1]);

      if (insertResult.rows.length > 0) {
        console.log('   ✅ Test tag insertion successful');
        this.testResults.dataIntegrity.passed++;
        
        // Clean up test data
        await this.client.query('DELETE FROM sku_tags WHERE tag_name = $1', ['TEST_TAG']);
        console.log('   ✅ Test data cleanup successful');
      } else {
        console.log('   ❌ Test tag insertion failed');
        this.testResults.dataIntegrity.failed++;
      }
      this.testResults.dataIntegrity.total++;

      // Test 2: Check unique constraint
      try {
        await this.client.query(`
          INSERT INTO sku_tags (tag_name, tag_category, tag_value, usage_count)
          VALUES ($1, $2, $3, $4)
        `, ['DUPLICATE_TEST', 'TEST_CATEGORY', 'TEST_VALUE', 1]);

        await this.client.query(`
          INSERT INTO sku_tags (tag_name, tag_category, tag_value, usage_count)
          VALUES ($1, $2, $3, $4)
        `, ['DUPLICATE_TEST', 'TEST_CATEGORY', 'TEST_VALUE', 1]);

        console.log('   ❌ Unique constraint failed - duplicate allowed');
        this.testResults.dataIntegrity.failed++;
      } catch (constraintError) {
        if (constraintError.code === '23505') { // Unique violation
          console.log('   ✅ Unique constraint working correctly');
          this.testResults.dataIntegrity.passed++;
        } else {
          console.log(`   ❌ Unexpected error: ${constraintError.message}`);
          this.testResults.dataIntegrity.failed++;
        }
      }
      this.testResults.dataIntegrity.total++;

      // Clean up duplicate test
      await this.client.query('DELETE FROM sku_tags WHERE tag_name = $1', ['DUPLICATE_TEST']);

    } catch (error) {
      console.log(`   ❌ Data integrity test error: ${error.message}`);
      this.testResults.dataIntegrity.failed++;
      this.testResults.dataIntegrity.total++;
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
    console.log('📊 PHASE 1 TEST RESULTS SUMMARY');
    console.log('=' .repeat(60));

    const categories = [
      { name: 'Tables', results: this.testResults.tables },
      { name: 'Columns', results: this.testResults.columns },
      { name: 'Constraints', results: this.testResults.constraints },
      { name: 'Indexes', results: this.testResults.indexes },
      { name: 'Triggers', results: this.testResults.triggers },
      { name: 'Data Integrity', results: this.testResults.dataIntegrity }
    ];

    categories.forEach(category => {
      const { passed, failed, total } = category.results;
      const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;
      const status = passed === total ? '✅ PASS' : failed > 0 ? '❌ FAIL' : '⚠️ PARTIAL';
      
      console.log(`${category.name.padEnd(15)}: ${passed}/${total} (${percentage}%) ${status}`);
    });

    const overallScore = this.calculateOverallScore();
    console.log('\n' + '=' .repeat(60));
    console.log(`🎯 OVERALL SCORE: ${overallScore}%`);
    
    if (overallScore >= 90) {
      console.log('🏆 EXCELLENT - All tests passed with high confidence');
    } else if (overallScore >= 80) {
      console.log('✅ GOOD - Phase 1 ready for Phase 2');
    } else if (overallScore >= 70) {
      console.log('⚠️ ACCEPTABLE - Some issues need attention before Phase 2');
    } else {
      console.log('❌ FAILED - Critical issues must be resolved before proceeding');
    }

    console.log('=' .repeat(60));
  }
}

// Run the tests
async function runPhase1Tests() {
  const tester = new Phase1DatabaseFoundationTest();
  const success = await tester.runAllTests();
  
  if (success) {
    console.log('\n🚀 PHASE 1 TESTS COMPLETED SUCCESSFULLY!');
    console.log('✅ Ready to proceed with Phase 2: Core System Implementation');
  } else {
    console.log('\n⚠️ PHASE 1 TESTS REVEALED ISSUES');
    console.log('🔧 Please resolve issues before proceeding to Phase 2');
  }
  
  process.exit(success ? 0 : 1);
}

runPhase1Tests();

