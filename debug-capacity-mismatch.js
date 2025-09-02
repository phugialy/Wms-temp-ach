const { Client } = require('pg');
require('dotenv').config();

async function debugCapacityMismatch() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    const testImeis = [
      '353618520520570',  // Should be FOLD3-512-BLK
      '350237727628665'   // Should be FOLD3-512-BLK-ATT
    ];

    for (const imei of testImeis) {
      console.log(`\n🔍 Analyzing IMEI: ${imei}`);
      console.log('=====================================');

      // Get device data
      const deviceResult = await client.query(`
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
      `, [imei]);

      if (deviceResult.rows.length > 0) {
        const device = deviceResult.rows[0];
        console.log('📱 Device Data:');
        console.log(`   IMEI: ${device.imei}`);
        console.log(`   Original SKU: ${device.original_sku}`);
        console.log(`   Brand: ${device.brand}`);
        console.log(`   Model: ${device.model}`);
        console.log(`   Capacity: ${device.capacity}`);
        console.log(`   Color: ${device.color}`);
        console.log(`   Carrier: ${device.carrier}`);
        console.log(`   Device Notes: ${device.device_notes}`);

        // Get current SKU match result
        const matchResult = await client.query(`
          SELECT 
            smr.matched_sku,
            smr.match_score,
            smr.match_method,
            smr.processed_at
          FROM sku_matching_results smr
          WHERE smr.imei = $1
          ORDER BY smr.processed_at DESC
          LIMIT 1
        `, [imei]);

        if (matchResult.rows.length > 0) {
          const match = matchResult.rows[0];
          console.log('\n🎯 Current SKU Match:');
          console.log(`   SKU Code: ${match.matched_sku}`);
          console.log(`   Score: ${match.match_score}`);
          console.log(`   Method: ${match.match_method}`);
          console.log(`   Processed: ${match.processed_at}`);
        } else {
          console.log('\n❌ No SKU match found');
        }

        // Check what SKUs should be available
        const capacityValue = device.capacity ? device.capacity.replace(/[^0-9]/g, '') : '';
        const colorKey = device.color ? device.color.toUpperCase() : '';
        
        console.log(`\n🔍 Expected SKU Pattern: FOLD3-${capacityValue}-${colorKey}`);
        
        // Find available SKUs for this pattern
        const skuResult = await client.query(`
          SELECT sku_code, is_unlocked, post_fix
          FROM sku_master 
          WHERE sku_code LIKE $1 
          AND is_active = true
          ORDER BY sku_code
        `, [`FOLD3-${capacityValue}-%`]);

        if (skuResult.rows.length > 0) {
          console.log('\n📋 Available SKUs for this capacity:');
          skuResult.rows.forEach(row => {
            console.log(`   ${row.sku_code} (${row.is_unlocked ? 'Unlocked' : 'Locked'}) ${row.post_fix ? `[${row.post_fix}]` : ''}`);
          });
        } else {
          console.log('\n❌ No SKUs found for this capacity pattern');
        }

        // Also check what the system actually matched to
        if (matchResult.rows.length > 0) {
          const matchedSku = matchResult.rows[0].matched_sku;
          const matchedParts = matchedSku.split('-');
          console.log(`\n⚠️  Capacity Mismatch Analysis:`);
          console.log(`   Device Capacity: ${capacityValue}GB`);
          console.log(`   Matched SKU Capacity: ${matchedParts[1] || 'Unknown'}`);
          console.log(`   Mismatch: ${capacityValue !== matchedParts[1] ? 'YES ❌' : 'NO ✅'}`);
        }

      } else {
        console.log('❌ Device not found');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

debugCapacityMismatch();
