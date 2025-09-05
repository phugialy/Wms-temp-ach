const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function debugAllJsonFields() {
  const client = await pool.connect();
  try {
    console.log('🔍 Debugging all JSON field access...');
    
    // Let's check what fields are actually in the real data
    const sampleData = await client.query(`
      SELECT raw_data FROM data_queue 
      WHERE raw_data IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (sampleData.rows.length > 0) {
      console.log('📋 Sample raw_data structure:');
      const data = sampleData.rows[0].raw_data;
      console.log('Keys:', Object.keys(data));
      
      // Check for any fields with special characters
      Object.keys(data).forEach(key => {
        if (key.includes('#') || key.includes('@') || key.includes('$') || key.includes('%') || key.includes('&')) {
          console.log(`⚠️  Field with special character: "${key}"`);
        }
      });
    }
    
    // Let's test the trigger function step by step
    console.log('\n🧪 Testing trigger function step by step...');
    
    // Test 1: Simple JSONB access
    try {
      const testData = { imei: '999999999999999', brand: 'Test' };
      console.log('Test 1: Simple JSONB access');
      
      const result = await client.query(`
        SELECT $1::jsonb->>'imei' as imei, $1::jsonb->>'brand' as brand
      `, [JSON.stringify(testData)]);
      
      console.log('✅ Simple access works:', result.rows[0]);
    } catch (error) {
      console.log('❌ Simple access failed:', error.message);
    }
    
    // Test 2: COALESCE with JSONB
    try {
      const testData = { imei: '999999999999999', serialNumber: 'SN123' };
      console.log('Test 2: COALESCE with JSONB');
      
      const result = await client.query(`
        SELECT COALESCE($1::jsonb->>'serialNumber', $1::jsonb->>'imei') as result
      `, [JSON.stringify(testData)]);
      
      console.log('✅ COALESCE works:', result.rows[0]);
    } catch (error) {
      console.log('❌ COALESCE failed:', error.message);
    }
    
    // Test 3: Type casting with JSONB
    try {
      const testData = { batteryCycle: '100' };
      console.log('Test 3: Type casting with JSONB');
      
      const result = await client.query(`
        SELECT ($1::jsonb->>'batteryCycle')::integer as result
      `, [JSON.stringify(testData)]);
      
      console.log('✅ Type casting works:', result.rows[0]);
    } catch (error) {
      console.log('❌ Type casting failed:', error.message);
    }
    
    // Test 4: The exact problematic line from trigger
    try {
      const testData = { 
        imei: '999999999999999',
        serialNumber: 'SN123',
        serialnumber: 'SN456',
        model: 'TestModel'
      };
      console.log('Test 4: Exact problematic COALESCE line');
      
      const result = await client.query(`
        SELECT COALESCE($1::jsonb->>'serialNumber', $1::jsonb->>'serialnumber', $1::jsonb->>'model') as result
      `, [JSON.stringify(testData)]);
      
      console.log('✅ Problematic COALESCE works:', result.rows[0]);
    } catch (error) {
      console.log('❌ Problematic COALESCE failed:', error.message);
    }
    
    // Test 5: Check if the issue is with the trigger function itself
    console.log('\n🔍 Checking trigger function syntax...');
    
    const triggerFunction = await client.query(`
      SELECT prosrc FROM pg_proc 
      WHERE proname = 'process_data_queue_automatically'
    `);
    
    if (triggerFunction.rows.length > 0) {
      const functionCode = triggerFunction.rows[0].prosrc;
      
      // Check for any syntax issues
      const lines = functionCode.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('NEW.raw_data->>') && line.includes('COALESCE')) {
          console.log(`Line ${index + 1}: ${line.trim()}`);
        }
      });
    }
    
    // Test 6: Try to create a minimal trigger function
    console.log('\n🧪 Testing minimal trigger function...');
    
    try {
      await client.query(`
        CREATE OR REPLACE FUNCTION test_minimal_trigger()
        RETURNS TRIGGER AS $$
        BEGIN
          -- Just test basic JSONB access
          INSERT INTO product (imei, brand, sku, created_at, updated_at)
          VALUES (
            NEW.raw_data->>'imei',
            NEW.raw_data->>'brand',
            'test-sku',
            NOW(),
            NOW()
          );
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);
      
      console.log('✅ Minimal trigger function created');
      
      // Test it
      const testData = { imei: '888888888888888', brand: 'TestBrand' };
      const result = await client.query(`
        INSERT INTO data_queue (raw_data, status, source, priority, retry_count, max_retries)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [testData, 'pending', 'test', 5, 0, 3]);
      
      console.log('✅ Minimal trigger test insert successful');
      
      // Clean up
      await client.query(`DELETE FROM product WHERE imei = $1`, [testData.imei]);
      await client.query(`DELETE FROM data_queue WHERE id = $1`, [result.rows[0].id]);
      await client.query(`DROP FUNCTION test_minimal_trigger()`);
      
    } catch (error) {
      console.log('❌ Minimal trigger test failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

debugAllJsonFields();


