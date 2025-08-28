const { Client } = require('pg');
require('dotenv').config();

async function checkDeviceTestFields() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check device_test table field mapping
    console.log('\n🧪 Device Test Table Field Analysis:');
    const fieldQuery = `
      SELECT 
        COUNT(*) as total_tests,
        COUNT(CASE WHEN defects IS NOT NULL THEN 1 END) as tests_with_defects,
        COUNT(CASE WHEN defects IS NULL THEN 1 END) as tests_without_defects,
        COUNT(CASE WHEN custom1 IS NOT NULL THEN 1 END) as tests_with_custom1,
        COUNT(CASE WHEN custom1 IS NULL THEN 1 END) as tests_without_custom1,
        COUNT(CASE WHEN notes IS NOT NULL THEN 1 END) as tests_with_notes,
        COUNT(CASE WHEN notes IS NULL THEN 1 END) as tests_without_notes
      FROM device_test
    `;
    const fieldResult = await client.query(fieldQuery);
    const fieldStats = fieldResult.rows[0];
    console.log(`  Total device tests: ${fieldStats.total_tests}`);
    console.log(`  Tests with defects: ${fieldStats.tests_with_defects}`);
    console.log(`  Tests without defects: ${fieldStats.tests_without_defects}`);
    console.log(`  Tests with custom1: ${fieldStats.tests_with_custom1}`);
    console.log(`  Tests without custom1: ${fieldStats.tests_without_custom1}`);
    console.log(`  Tests with notes: ${fieldStats.tests_with_notes}`);
    console.log(`  Tests without notes: ${fieldStats.tests_without_notes}`);

    // Check sample device_test data
    console.log('\n📋 Sample Device Test Data (first 10 items):');
    const sampleQuery = `
      SELECT imei, working, defects, notes, custom1
      FROM device_test 
      ORDER BY created_at DESC 
      LIMIT 10
    `;
    const sampleResult = await client.query(sampleQuery);
    sampleResult.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. IMEI: ${row.imei}`);
      console.log(`     Working: "${row.working}"`);
      console.log(`     Defects: "${row.defects}"`);
      console.log(`     Notes: "${row.notes}"`);
      console.log(`     Custom1: "${row.custom1}"`);
      console.log('');
    });

    // Check for any non-null defects values
    console.log('\n🔍 Non-null defects values analysis:');
    const defectsQuery = `
      SELECT 
        defects,
        COUNT(*) as count
      FROM device_test 
      WHERE defects IS NOT NULL AND defects != ''
      GROUP BY defects
      ORDER BY count DESC
      LIMIT 10
    `;
    const defectsResult = await client.query(defectsQuery);
    console.log('  Defects values:');
    if (defectsResult.rows.length === 0) {
      console.log('    No defects values found');
    } else {
      defectsResult.rows.forEach(row => {
        console.log(`    "${row.defects}": ${row.count} tests`);
      });
    }

    // Check for any non-null custom1 values
    console.log('\n🔍 Non-null custom1 values analysis:');
    const custom1Query = `
      SELECT 
        custom1,
        COUNT(*) as count
      FROM device_test 
      WHERE custom1 IS NOT NULL AND custom1 != ''
      GROUP BY custom1
      ORDER BY count DESC
      LIMIT 10
    `;
    const custom1Result = await client.query(custom1Query);
    console.log('  Custom1 values:');
    if (custom1Result.rows.length === 0) {
      console.log('    No custom1 values found');
    } else {
      custom1Result.rows.forEach(row => {
        console.log(`    "${row.custom1}": ${row.count} tests`);
      });
    }

    // Check for any non-null notes values
    console.log('\n🔍 Non-null notes values analysis:');
    const notesQuery = `
      SELECT 
        notes,
        COUNT(*) as count
      FROM device_test 
      WHERE notes IS NOT NULL AND notes != ''
      GROUP BY notes
      ORDER BY count DESC
      LIMIT 10
    `;
    const notesResult = await client.query(notesQuery);
    console.log('  Notes values:');
    if (notesResult.rows.length === 0) {
      console.log('    No notes values found');
    } else {
      notesResult.rows.forEach(row => {
        console.log(`    "${row.notes}": ${row.count} tests`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkDeviceTestFields();
