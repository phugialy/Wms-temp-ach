const { Client } = require('pg');
require('dotenv').config();

async function testSkuAvailability() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log('\n🔍 Testing SKU Availability for FOLD3-512:');
    console.log('==========================================');

    // Test different capacity patterns
    const patterns = [
      'FOLD3-512-%',
      'FOLD3-256-%',
      'FOLD3-%'
    ];

    for (const pattern of patterns) {
      console.log(`\n📋 Pattern: ${pattern}`);
      const result = await client.query(`
        SELECT sku_code, is_active, is_unlocked, post_fix
        FROM sku_master 
        WHERE sku_code LIKE $1 
        AND is_active = true
        ORDER BY sku_code
        LIMIT 10
      `, [pattern]);

      if (result.rows.length > 0) {
        console.log(`   Found ${result.rows.length} SKUs:`);
        result.rows.forEach(row => {
          console.log(`     ${row.sku_code} (${row.is_unlocked ? 'Unlocked' : 'Locked'}) ${row.post_fix ? `[${row.post_fix}]` : ''}`);
        });
      } else {
        console.log('   No SKUs found');
      }
    }

    // Test specific capacity values
    console.log('\n🔍 Testing Specific Capacity Values:');
    console.log('=====================================');
    
    const capacities = ['512', '256'];
    for (const capacity of capacities) {
      console.log(`\n📱 Capacity: ${capacity}GB`);
      const result = await client.query(`
        SELECT sku_code, is_active, is_unlocked, post_fix
        FROM sku_master 
        WHERE sku_code LIKE $1 
        AND is_active = true
        ORDER BY sku_code
        LIMIT 5
      `, [`%-${capacity}-%`]);

      if (result.rows.length > 0) {
        console.log(`   Found ${result.rows.length} SKUs:`);
        result.rows.forEach(row => {
          console.log(`     ${row.sku_code} (${row.is_unlocked ? 'Unlocked' : 'Locked'}) ${row.post_fix ? `[${row.post_fix}]` : ''}`);
        });
      } else {
        console.log('   No SKUs found');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

testSkuAvailability();

