const { Client } = require('pg');
require('dotenv').config();

async function checkDeviceColor() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    const testImei = '352707355368444';
    console.log(`\n🔍 Checking color for IMEI: ${testImei}`);

    const result = await client.query(`
      SELECT 
        p.imei, 
        p.sku as original_sku, 
        i.color, 
        i.carrier,
        dt.notes as device_notes
      FROM product p 
      LEFT JOIN item i ON p.imei = i.imei 
      LEFT JOIN device_test dt ON p.imei = dt.imei
      WHERE p.imei = $1
    `, [testImei]);

    if (result.rows.length > 0) {
      const device = result.rows[0];
      console.log('\n📱 Device Information:');
      console.log(`   IMEI: ${device.imei}`);
      console.log(`   Original SKU: "${device.original_sku}"`);
      console.log(`   Color: "${device.color}"`);
      console.log(`   Carrier: "${device.carrier}"`);
      console.log(`   Notes: "${device.device_notes}"`);

      // Check what SKUs should match this color
      console.log('\n🔍 Checking available SKUs for this color:');
      
      if (device.color) {
        const colorQuery = await client.query(`
          SELECT sku_code, post_fix, is_unlocked, source_tab
          FROM sku_master 
          WHERE is_active = true
          AND sku_code LIKE '%FOLD3%'
          AND sku_code LIKE '%256%'
          AND sku_code LIKE '%TMO%'
          ORDER BY sku_code
        `);

        console.log(`\n📊 Found ${colorQuery.rows.length} T-Mobile FOLD3 256GB SKUs:`);
        colorQuery.rows.forEach((sku, index) => {
          console.log(`   ${index + 1}. "${sku.sku_code}" (${sku.post_fix || 'no post-fix'})`);
        });

        // Check if there's a GREEN variant
        const greenQuery = await client.query(`
          SELECT sku_code, post_fix, is_unlocked, source_tab
          FROM sku_master 
          WHERE is_active = true
          AND sku_code LIKE '%FOLD3%'
          AND sku_code LIKE '%256%'
          AND sku_code LIKE '%TMO%'
          AND (sku_code LIKE '%GREEN%' OR sku_code LIKE '%GRN%')
          ORDER BY sku_code
        `);

        if (greenQuery.rows.length > 0) {
          console.log(`\n🎨 Found ${greenQuery.rows.length} GREEN T-Mobile FOLD3 256GB SKUs:`);
          greenQuery.rows.forEach((sku, index) => {
            console.log(`   ${index + 1}. "${sku.sku_code}" (${sku.post_fix || 'no post-fix'})`);
          });
        } else {
          console.log('\n❌ No GREEN T-Mobile FOLD3 256GB SKUs found');
        }
      }
    } else {
      console.log('❌ Device not found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkDeviceColor();

