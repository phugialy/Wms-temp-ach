const { Client } = require('pg');
require('dotenv').config();

async function analyzeFailureClassification() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Check the structure of device_test table to understand WORKING field
    console.log('\n🔍 Analyzing Device Test Table Structure:');
    console.log('==========================================');
    
    const deviceTestStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'device_test'
      ORDER BY ordinal_position
    `);

    console.log('Device Test Table Columns:');
    deviceTestStructure.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check for WORKING field and its values
    console.log('\n🔍 Checking WORKING Field Values:');
    console.log('==================================');
    
    const workingFieldCheck = await client.query(`
      SELECT DISTINCT working, COUNT(*) as count
      FROM device_test
      GROUP BY working
      ORDER BY working
    `);

    console.log('WORKING Field Values:');
    workingFieldCheck.rows.forEach(row => {
      console.log(`   "${row.working}": ${row.count} devices`);
    });

    // Analyze current failed devices to classify them
    console.log('\n🔍 Analyzing Current Failed Devices:');
    console.log('=====================================');
    
    const failedDevicesAnalysis = await client.query(`
      SELECT 
        p.imei,
        p.sku as original_sku,
        dt.working,
        dt.defects,
        dt.notes as device_notes,
        CASE 
          WHEN dt.working = 'NO' THEN 'PURE_FAILED'
          WHEN dt.notes ILIKE '%FAIL%' OR dt.notes ILIKE '%FAILED%' THEN 'POTENTIAL_FAILED'
          ELSE 'UNKNOWN'
        END as proposed_classification
      FROM product p
      LEFT JOIN device_test dt ON p.imei = dt.imei
      WHERE dt.notes IS NOT NULL 
      AND (dt.notes ILIKE '%FAIL%' OR dt.notes ILIKE '%FAILED%' OR dt.working = 'NO')
      ORDER BY p.imei
    `);

    console.log(`\n📊 Found ${failedDevicesAnalysis.rows.length} devices with failure indicators:`);
    
    let pureFailed = 0;
    let potentialFailed = 0;
    let unknown = 0;

    failedDevicesAnalysis.rows.forEach((device, index) => {
      console.log(`\n${index + 1}. IMEI: ${device.imei}`);
      console.log(`   Original SKU: "${device.original_sku}"`);
      console.log(`   WORKING: "${device.working}"`);
      console.log(`   Defects: "${device.defects}"`);
      console.log(`   Notes: "${device.device_notes}"`);
      console.log(`   Proposed Classification: ${device.proposed_classification}`);
      
      if (device.proposed_classification === 'PURE_FAILED') pureFailed++;
      else if (device.proposed_classification === 'POTENTIAL_FAILED') potentialFailed++;
      else unknown++;
    });

    console.log(`\n📈 Classification Summary:`);
    console.log(`   PURE_FAILED (WORKING:NO): ${pureFailed}`);
    console.log(`   POTENTIAL_FAILED (FAIL notes): ${potentialFailed}`);
    console.log(`   UNKNOWN: ${unknown}`);

    // Check if there are any devices with WORKING:NO but no FAIL notes
    console.log('\n🔍 Checking WORKING:NO Devices:');
    console.log('===============================');
    
    const workingNoDevices = await client.query(`
      SELECT 
        p.imei,
        p.sku as original_sku,
        dt.working,
        dt.defects,
        dt.notes as device_notes
      FROM product p
      LEFT JOIN device_test dt ON p.imei = dt.imei
      WHERE dt.working = 'NO'
      ORDER BY p.imei
    `);

    console.log(`\n📊 Found ${workingNoDevices.rows.length} devices with WORKING:NO:`);
    workingNoDevices.rows.forEach((device, index) => {
      console.log(`   ${index + 1}. ${device.imei} - "${device.original_sku}" - Notes: "${device.device_notes || 'No notes'}"`);
    });

    // Check if there are any devices with FAIL notes but WORKING:YES
    console.log('\n🔍 Checking FAIL Notes Devices:');
    console.log('===============================');
    
    const failNotesDevices = await client.query(`
      SELECT 
        p.imei,
        p.sku as original_sku,
        dt.working,
        dt.defects,
        dt.notes as device_notes
      FROM product p
      LEFT JOIN device_test dt ON p.imei = dt.imei
      WHERE dt.notes IS NOT NULL 
      AND (dt.notes ILIKE '%FAIL%' OR dt.notes ILIKE '%FAILED%')
      AND dt.working != 'NO'
      ORDER BY p.imei
    `);

    console.log(`\n📊 Found ${failNotesDevices.rows.length} devices with FAIL notes but WORKING != NO:`);
    failNotesDevices.rows.forEach((device, index) => {
      console.log(`   ${index + 1}. ${device.imei} - "${device.original_sku}" - WORKING: "${device.working}" - Notes: "${device.device_notes}"`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

analyzeFailureClassification();
