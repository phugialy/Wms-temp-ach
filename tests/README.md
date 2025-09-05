# 🧪 Tag-Based SKU System - Testing Suite

This testing suite validates the complete tag-based SKU system across three phases, ensuring quality, performance, and production readiness.

## 📋 Test Phases Overview

### **Phase 1: Database Foundation** ✅
**Purpose**: Validate database structure, constraints, and basic functionality
**Focus**: Tables, columns, constraints, indexes, triggers, data integrity
**Success Criteria**: 80% pass rate required

**Tests Include**:
- ✅ New table creation (`sku_tags`, `sku_master_tags`, `undefined_tag_review`)
- ✅ New column addition to existing tables
- ✅ Constraint validation (unique constraints, foreign keys)
- ✅ Performance index creation
- ✅ Auto-update trigger functionality
- ✅ Data insertion and retrieval testing

### **Phase 2: Core System** ✅
**Purpose**: Validate SKU parsing, tag management, and device detection
**Focus**: Core business logic, pattern recognition, performance
**Success Criteria**: 80% pass rate required

**Tests Include**:
- ✅ SKU parsing functionality
- ✅ Tag management system (CRUD operations)
- ✅ Device type detection algorithms
- ✅ Pattern recognition and validation
- ✅ Performance metrics and optimization
- ✅ System integration verification

### **Phase 3: Integration & Production** ✅
**Purpose**: Validate end-to-end workflow and production readiness
**Focus**: Complete system integration, load testing, error handling
**Success Criteria**: 85% pass rate required for production

**Tests Include**:
- ✅ End-to-end workflow validation
- ✅ Load testing and performance under stress
- ✅ Data consistency and integrity checks
- ✅ Error handling and edge cases
- ✅ Production readiness assessment
- ✅ Security and monitoring validation

## 🚀 Running Tests

### **Prerequisites**
- Node.js installed
- PostgreSQL database running
- Environment variables configured (`.env` file)
- Database migration completed (Phase 1 foundation)

### **Quick Start**

#### **Run All Phases (Recommended)**
```bash
node tests/run-all-phases.test.js
```

#### **Run Individual Phases**
```bash
# Phase 1: Database Foundation
node tests/run-all-phases.test.js --phase1

# Phase 2: Core System
node tests/run-all-phases.test.js --phase2

# Phase 3: Integration & Production
node tests/run-all-phases.test.js --phase3
```

#### **Run Specific Test Files**
```bash
# Direct execution
node tests/phase1-database-foundation.test.js
node tests/phase2-core-system.test.js
node tests/phase3-integration-production.test.js
```

### **Command Line Options**
```bash
node tests/run-all-phases.test.js --help
```

## 📊 Test Results & Scoring

### **Scoring System**
- **90%+**: 🏆 EXCELLENT - Production ready with high confidence
- **80-89%**: ✅ GOOD - Production ready with minor considerations
- **70-79%**: ⚠️ ACCEPTABLE - Needs attention before production
- **<70%**: ❌ FAILED - Critical issues must be resolved

### **Phase Requirements**
- **Phase 1**: 80% pass rate required to proceed
- **Phase 2**: 80% pass rate required to proceed
- **Phase 3**: 85% pass rate required for production

## 🔍 Test Details

### **Phase 1: Database Foundation Tests**

#### **Table Validation**
- Verifies creation of 3 new tables
- Checks table structure and column definitions
- Validates data types and constraints

#### **Constraint Testing**
- Unique constraint validation
- Foreign key relationship testing
- Data integrity verification

#### **Performance Optimization**
- Index creation and validation
- Trigger functionality testing
- Auto-update timestamp verification

#### **Data Integrity**
- Test data insertion and retrieval
- Constraint violation testing
- Cleanup and rollback verification

### **Phase 2: Core System Tests**

#### **SKU Parsing**
- Segment extraction validation
- Pattern recognition testing
- Edge case handling

#### **Tag Management**
- CRUD operations testing
- Category assignment validation
- Usage count tracking

#### **Device Detection**
- Brand-specific pattern recognition
- Device type classification
- Model variant handling

#### **Performance Metrics**
- Database query performance
- Memory usage monitoring
- Processing speed validation

### **Phase 3: Integration & Production Tests**

#### **End-to-End Workflow**
- Complete SKU processing pipeline
- Tag storage and mapping
- Data relationship verification

#### **Load Testing**
- Batch processing performance
- Concurrent operation handling
- Memory usage under stress

#### **Data Consistency**
- Referential integrity checks
- Data completeness validation
- Constraint violation detection

#### **Error Handling**
- Invalid input handling
- Database error recovery
- Memory allocation testing

#### **Production Readiness**
- System health monitoring
- Backup and recovery testing
- Security and access control

## 🛠️ Troubleshooting

### **Common Issues**

#### **Database Connection Failed**
```bash
❌ Failed to connect to database: connection refused
```
**Solution**: Ensure PostgreSQL is running and `.env` file is configured correctly

#### **Migration Not Applied**
```bash
❌ Table 'sku_tags' does not exist
```
**Solution**: Run the database migration first: `node run-migration.js migrations/036_create_tag_system_tables.sql`

#### **Permission Denied**
```bash
❌ Permission denied for table sku_tags
```
**Solution**: Check database user permissions and ensure proper access rights

#### **Test Timeout**
```bash
❌ Test execution failed: timeout
```
**Solution**: Check database performance, increase timeout values, or optimize queries

### **Debug Mode**
For detailed debugging, run individual test files directly:
```bash
node tests/phase1-database-foundation.test.js
```

## 📈 Performance Benchmarks

### **Expected Performance**
- **Phase 1**: 5-15 seconds (database operations)
- **Phase 2**: 10-30 seconds (core functionality)
- **Phase 3**: 20-60 seconds (integration testing)
- **Total**: 35-105 seconds for complete test suite

### **Performance Factors**
- Database server performance
- Network latency
- System resources (CPU, memory)
- Database size and complexity

## 🔄 Continuous Testing

### **Automated Testing**
- Run tests after each code change
- Validate database migrations
- Check system integration
- Monitor performance metrics

### **Test Maintenance**
- Update test data as needed
- Adjust performance thresholds
- Add new test cases for new features
- Review and update test criteria

## 📚 Additional Resources

### **Related Documentation**
- [Database Schema Documentation](../migrations/README.md)
- [API Documentation](../src/README.md)
- [Deployment Guide](../docs/deployment.md)

### **Support & Issues**
- Check test output for specific error messages
- Review database logs for connection issues
- Verify environment configuration
- Consult system administrator for database access

---

## 🎯 Success Checklist

Before proceeding to production, ensure:

- [ ] **Phase 1**: Database foundation tests pass (80%+)
- [ ] **Phase 2**: Core system tests pass (80%+)
- [ ] **Phase 3**: Integration tests pass (85%+)
- [ ] **Performance**: All tests complete within expected timeframes
- [ ] **Data Integrity**: No critical constraint violations
- [ ] **Error Handling**: Graceful failure handling verified
- [ ] **Documentation**: All test results documented and reviewed

**Remember**: These tests are designed to catch issues early and ensure system quality. Always run the complete test suite before production deployment.

