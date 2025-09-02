const { Client } = require('pg');
require('dotenv').config();

async function testEnhancedCapacityColorHandling() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log('🧪 Testing Enhanced Capacity & Color Handling in SKU Matching View\n');

    // Test 1: Check the enhanced view structure
    console.log('📋 Test 1: Enhanced View Structure');
    console.log('=====================================');
    
    const viewStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'sku_matching_view'
      AND column_name IN ('normalized_capacity', 'normalized_color', 'capacity_status', 'color_status')
      ORDER BY column_name
    `);

    if (viewStructure.rows.length > 0) {
      console.log('✅ Enhanced columns found:');
      viewStructure.rows.forEach(col => {
        console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    } else {
      console.log('❌ Enhanced columns not found - view may not be updated');
      return;
    }

    // Test 2: Test capacity normalization
    console.log('\n📊 Test 2: Capacity Normalization');
    console.log('=====================================');
    
    const capacityTestData = await client.query(`
      SELECT DISTINCT capacity, normalized_capacity, capacity_status
      FROM sku_matching_view
      WHERE capacity IS NOT NULL
      ORDER BY capacity
      LIMIT 10
    `);

    if (capacityTestData.rows.length > 0) {
      console.log('Capacity normalization examples:');
      capacityTestData.rows.forEach(row => {
        console.log(`   "${row.capacity}" → "${row.normalized_capacity}" (${row.capacity_status})`);
      });
    } else {
      console.log('   No capacity data found to test');
    }

    // Test 3: Test color normalization
    console.log('\n🎨 Test 3: Color Normalization');
    console.log('=====================================');
    
    const colorTestData = await client.query(`
      SELECT DISTINCT color, normalized_color, color_status
      FROM sku_matching_view
      WHERE color IS NOT NULL
      ORDER BY color
      LIMIT 10
    `);

    if (colorTestData.rows.length > 0) {
      console.log('Color normalization examples:');
      colorTestData.rows.forEach(row => {
        console.log(`   "${row.color}" → "${row.normalized_color}" (${row.color_status})`);
      });
    } else {
      console.log('   No color data found to test');
    }

    // Test 4: Test specific capacity patterns
    console.log('\n🔢 Test 4: Specific Capacity Patterns');
    console.log('=====================================');
    
    const capacityPatterns = [
      '256GB', '512GB', '1TB', '128MB', '256', '512'
    ];

    for (const pattern of capacityPatterns) {
      const result = await client.query(`
        SELECT capacity, normalized_capacity, capacity_status
        FROM sku_matching_view
        WHERE capacity = $1
        LIMIT 1
      `, [pattern]);

      if (result.rows.length > 0) {
        const row = result.rows[0];
        console.log(`   "${pattern}" → "${row.normalized_capacity}" (${row.capacity_status})`);
      } else {
        console.log(`   "${pattern}" → No data found`);
      }
    }

    // Test 5: Test specific color patterns
    console.log('\n🎨 Test 5: Specific Color Patterns');
    console.log('=====================================');
    
    const colorPatterns = [
      'BLK', 'BLACK', 'Phantom Black', 'PHANTOMBLACK',
      'GRN', 'GREEN', 'Phantom Green', 'PHANTOMGREEN',
      'BLU', 'BLUE', 'Phantom Blue', 'PHANTOMBLUE'
    ];

    for (const pattern of colorPatterns) {
      const result = await client.query(`
        SELECT color, normalized_color, color_status
        FROM sku_matching_view
        WHERE color = $1
        LIMIT 1
      `, [pattern]);

      if (result.rows.length > 0) {
        const row = result.rows[0];
        console.log(`   "${pattern}" → "${row.normalized_color}" (${row.color_status})`);
      } else {
        console.log(`   "${pattern}" → No data found`);
      }
    }

    // Test 6: Check data completeness with enhanced fields
    console.log('\n📈 Test 6: Data Completeness with Enhanced Fields');
    console.log('===================================================');
    
    const completenessStats = await client.query(`
      SELECT 
        data_completeness,
        COUNT(*) as device_count,
        COUNT(CASE WHEN capacity_status = 'valid_storage' THEN 1 END) as valid_capacity,
        COUNT(CASE WHEN color_status = 'valid' THEN 1 END) as valid_colors
      FROM sku_matching_view
      GROUP BY data_completeness
      ORDER BY data_completeness
    `);

    if (completenessStats.rows.length > 0) {
      console.log('Data completeness statistics:');
      completenessStats.rows.forEach(row => {
        console.log(`   ${row.data_completeness}: ${row.device_count} devices`);
        console.log(`     Valid capacity: ${row.valid_capacity}, Valid colors: ${row.valid_colors}`);
      });
    }

    // Test 7: Check summary view enhancements
    console.log('\n📊 Test 7: Enhanced Summary View');
    console.log('===================================');
    
    const summaryData = await client.query(`
      SELECT 
        total_devices,
        valid_numeric_capacity,
        valid_storage_capacity,
        valid_mb_capacity,
        invalid_capacity_format,
        valid_colors,
        unknown_color_formats
      FROM sku_matching_summary
      LIMIT 1
    `);

    if (summaryData.rows.length > 0) {
      const summary = summaryData.rows[0];
      console.log('Enhanced summary statistics:');
      console.log(`   Total devices: ${summary.total_devices}`);
      console.log(`   Capacity breakdown:`);
      console.log(`     Valid numeric: ${summary.valid_numeric_capacity}`);
      console.log(`     Valid storage (GB/TB): ${summary.valid_storage_capacity}`);
      console.log(`     Valid MB: ${summary.valid_mb_capacity}`);
      console.log(`     Invalid format: ${summary.invalid_capacity_format}`);
      console.log(`   Color breakdown:`);
      console.log(`     Valid colors: ${summary.valid_colors}`);
      console.log(`     Unknown formats: ${summary.unknown_color_formats}`);
    }

    console.log('\n✅ Enhanced capacity and color handling tests completed!');

  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test if called directly
if (require.main === module) {
  testEnhancedCapacityColorHandling();
}

module.exports = testEnhancedCapacityColorHandling;
