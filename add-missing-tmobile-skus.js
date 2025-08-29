const { Client } = require('pg');
require('dotenv').config();

async function addMissingTmobileSkus() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Define the missing T-Mobile FOLD3 SKUs
    const missingSkus = [
      {
        sku_code: 'FOLD3-256-BLK-TMO',
        post_fix: null,
        is_unlocked: false,
        source_tab: 'T-Mobile'
      },
      {
        sku_code: 'FOLD3-256-GREEN-TMO',
        post_fix: null,
        is_unlocked: false,
        source_tab: 'T-Mobile'
      },
      {
        sku_code: 'FOLD3-512-BLK-TMO',
        post_fix: null,
        is_unlocked: false,
        source_tab: 'T-Mobile'
      },
      {
        sku_code: 'FOLD3-512-GREEN-TMO',
        post_fix: null,
        is_unlocked: false,
        source_tab: 'T-Mobile'
      }
    ];

    console.log('\n🔍 Adding Missing T-Mobile FOLD3 SKUs:');
    console.log('=======================================');

    for (const sku of missingSkus) {
      // Check if SKU already exists
      const existingSku = await client.query(`
        SELECT sku_code FROM sku_master WHERE sku_code = $1
      `, [sku.sku_code]);

      if (existingSku.rows.length > 0) {
        console.log(`   ⚠️  SKU "${sku.sku_code}" already exists, skipping...`);
        continue;
      }

      // Insert the new SKU
      await client.query(`
        INSERT INTO sku_master (sku_code, post_fix, is_unlocked, source_tab, is_active, created_at)
        VALUES ($1, $2, $3, $4, true, NOW())
      `, [sku.sku_code, sku.post_fix, sku.is_unlocked, sku.source_tab]);

      console.log(`   ✅ Added SKU: "${sku.sku_code}"`);
    }

    // Verify the additions
    console.log('\n🔍 Verifying T-Mobile FOLD3 SKUs:');
    console.log('==================================');
    
    const tmobileSkus = await client.query(`
      SELECT sku_code, post_fix, is_unlocked, source_tab
      FROM sku_master 
      WHERE is_active = true
      AND (sku_code LIKE '%FOLD3%' OR sku_code LIKE '%FOLD%')
      AND (sku_code LIKE '%TMO%' OR sku_code LIKE '%T-MOBILE%' OR sku_code LIKE '%TMOBILE%')
      ORDER BY sku_code
    `);

    console.log(`\n📊 Found ${tmobileSkus.rows.length} T-Mobile FOLD3 SKUs:`);
    tmobileSkus.rows.forEach((sku, index) => {
      console.log(`   ${index + 1}. "${sku.sku_code}" (${sku.post_fix || 'no post-fix'})`);
    });

    // Test the specific IMEI matching again
    console.log('\n🧪 Testing IMEI 352707355368444 matching:');
    console.log('==========================================');
    
    const testImei = '352707355368444';
    
    // Get device data
    const deviceData = await client.query(`
      SELECT 
        p.imei,
        p.sku as original_sku,
        p.brand,
        i.model,
        i.capacity,
        i.color,
        i.carrier,
        dt.notes as device_notes
      FROM product p
      LEFT JOIN item i ON p.imei = i.imei
      LEFT JOIN device_test dt ON p.imei = dt.imei
      WHERE p.imei = $1
    `, [testImei]);

    if (deviceData.rows.length > 0) {
      const device = deviceData.rows[0];
      console.log('\n📱 Device Information:');
      console.log(`   IMEI: ${device.imei}`);
      console.log(`   Original SKU: "${device.original_sku}"`);
      console.log(`   Brand: "${device.brand}"`);
      console.log(`   Model: "${device.model}"`);
      console.log(`   Capacity: "${device.capacity}"`);
      console.log(`   Color: "${device.color}"`);
      console.log(`   Carrier: "${device.carrier}"`);
      console.log(`   Notes: "${device.device_notes}"`);

      // Check what SKUs should match now
      const expectedSku = `FOLD3-256-BLK-TMO`;
      const matchingSku = await client.query(`
        SELECT sku_code, post_fix, is_unlocked, source_tab
        FROM sku_master 
        WHERE sku_code = $1 AND is_active = true
      `, [expectedSku]);

      if (matchingSku.rows.length > 0) {
        console.log(`\n✅ Expected SKU "${expectedSku}" is now available!`);
        console.log(`   This should fix the carrier mismatch issue.`);
      } else {
        console.log(`\n❌ Expected SKU "${expectedSku}" not found!`);
      }
    }

    console.log('\n🎯 Next Steps:');
    console.log('1. Run the SKU matching process again for this IMEI');
    console.log('2. The system should now match to FOLD3-256-BLK-TMO instead of FOLD3-256-BLK-ATT');
    console.log('3. This will fix the carrier mismatch issue');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

addMissingTmobileSkus();
