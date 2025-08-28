const { Client } = require('pg');
require('dotenv').config();

async function checkModelNumberData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check Item table model_number data
    console.log('\n📱 Item Table Model Number Analysis:');
    const modelNumberQuery = `
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN model_number IS NOT NULL THEN 1 END) as items_with_model_number,
        COUNT(CASE WHEN model_number IS NULL THEN 1 END) as items_without_model_number,
        COUNT(CASE WHEN model_number = '' THEN 1 END) as items_with_empty_model_number
      FROM item
    `;
    const modelNumberResult = await client.query(modelNumberQuery);
    const modelNumberStats = modelNumberResult.rows[0];
    console.log(`  Total items: ${modelNumberStats.total_items}`);
    console.log(`  Items with model_number: ${modelNumberStats.items_with_model_number}`);
    console.log(`  Items without model_number: ${modelNumberStats.items_without_model_number}`);
    console.log(`  Items with empty model_number: ${modelNumberStats.items_with_empty_model_number}`);

    // Check sample model_number data
    console.log('\n📋 Sample Model Number Data (first 10 items):');
    const sampleQuery = `
      SELECT i.imei, i.model, i.model_number, p.brand
      FROM item i
      LEFT JOIN product p ON i.imei = p.imei
      ORDER BY i.created_at DESC 
      LIMIT 10
    `;
    const sampleResult = await client.query(sampleQuery);
    sampleResult.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. IMEI: ${row.imei}`);
      console.log(`     Model: "${row.model}"`);
      console.log(`     Model Number: "${row.model_number}"`);
      console.log(`     Brand: "${row.brand}"`);
      console.log('');
    });

    // Check for any non-null model_number values
    console.log('\n🔍 Non-null model_number values analysis:');
    const nonNullQuery = `
      SELECT 
        model_number,
        COUNT(*) as count
      FROM item 
      WHERE model_number IS NOT NULL AND model_number != ''
      GROUP BY model_number
      ORDER BY count DESC
      LIMIT 10
    `;
    const nonNullResult = await client.query(nonNullQuery);
    console.log('  Model Number values:');
    if (nonNullResult.rows.length === 0) {
      console.log('    No model_number values found');
    } else {
      nonNullResult.rows.forEach(row => {
        console.log(`    "${row.model_number}": ${row.count} items`);
      });
    }

    // Check queue processing logs for any model-related errors
    console.log('\n📊 Queue Processing Logs (model-related):');
    const logQuery = `
      SELECT action, message, error, created_at
      FROM queue_processing_log 
      WHERE message ILIKE '%model%' OR error ILIKE '%model%'
      ORDER BY created_at DESC 
      LIMIT 5
    `;
    const logResult = await client.query(logQuery);
    if (logResult.rows.length === 0) {
      console.log('  No model-related logs found');
    } else {
      logResult.rows.forEach((row, index) => {
        console.log(`  ${index + 1}. Action: ${row.action}`);
        console.log(`     Message: ${row.message}`);
        console.log(`     Error: ${row.error || 'None'}`);
        console.log(`     Date: ${row.created_at}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkModelNumberData();
