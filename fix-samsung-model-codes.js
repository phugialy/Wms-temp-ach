const { Client } = require('pg');
require('dotenv').config();

async function fixSamsungModelCodes() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    console.log('🔧 Adding Samsung model code patterns...');

    // Get Samsung brand ID
    const samsungBrand = await client.query(`SELECT id FROM sku_brand_reference WHERE brand_name = 'SAMSUNG';`);
    const samsungBrandId = samsungBrand.rows[0]?.id;

    if (samsungBrandId) {
      // Add Samsung model code patterns
      await client.query(`
        INSERT INTO sku_model_reference (model_name, model_code, sku_patterns, brand_id, description) VALUES
        ('Galaxy A03S', 'A03S', ARRAY['A03S'], $1, 'Samsung Galaxy A03S'),
        ('Galaxy Tab A7 Lite', 'TAB-A7-LITE', ARRAY['SM-T290', 'TAB-A7-LITE'], $1, 'Samsung Galaxy Tab A7 Lite'),
        ('Galaxy Tab S6 Lite', 'TAB-S6-LITE', ARRAY['SM-T670', 'TAB-S6-LITE'], $1, 'Samsung Galaxy Tab S6 Lite'),
        ('Galaxy Tab S7', 'TAB-S7', ARRAY['SM-T870', 'TAB-S7'], $1, 'Samsung Galaxy Tab S7'),
        ('Galaxy Tab S8', 'TAB-S8', ARRAY['SM-X700', 'TAB-S8'], $1, 'Samsung Galaxy Tab S8'),
        ('Galaxy Tab S8 Ultra', 'TAB-S8-ULTRA', ARRAY['SM-X808', 'TAB-S8-ULTRA'], $1, 'Samsung Galaxy Tab S8 Ultra')
        ON CONFLICT (model_code) DO NOTHING;
      `, [samsungBrandId]);
    }

    console.log('✅ Added Samsung model code patterns');

    // Now fix the missing models
    console.log('\n🔧 Fixing Samsung devices with missing models...');
    
    const samsungSkus = await client.query(`
      SELECT sku_code, brand, model, capacity, color, carrier, post_fix
      FROM sku_master 
      WHERE brand = 'SAMSUNG'
      AND (model IS NULL OR model = '')
      ORDER BY sku_code;
    `);
    
    console.log(`Found ${samsungSkus.rows.length} SAMSUNG devices with missing model`);

    let updatedCount = 0;
    for (const sku of samsungSkus.rows) {
      try {
        const modelResult = await client.query(`SELECT get_model_from_sku($1) as model;`, [sku.sku_code]);
        const parsedModel = modelResult.rows[0].model;

        if (parsedModel) {
          await client.query(`
            UPDATE sku_master 
            SET model = $1, updated_at = NOW()
            WHERE sku_code = $2;
          `, [parsedModel, sku.sku_code]);
          
          console.log(`   ✅ Updated ${sku.sku_code} -> Model: ${parsedModel}`);
          updatedCount++;
        } else {
          console.log(`   ⚠️  Could not parse model for ${sku.sku_code}`);
        }
      } catch (error) {
        console.log(`   ❌ Error updating model for ${sku.sku_code}: ${error.message}`);
      }
    }

    console.log(`\n📊 Update Summary:`);
    console.log(`   ✅ SAMSUNG devices updated: ${updatedCount}`);

    // Test the fixes
    console.log('\n🧪 Testing Samsung model code fixes...');
    
    const testSkus = [
      'A03S-32-BLK-TRACFONE',
      'SM-T290NZKEXAR-BLACK',
      'SM-T670NZKAXAR',
      'SM-T870NZKEXAR-BLACK',
      'SM-X808U-BLK'
    ];

    for (const sku of testSkus) {
      try {
        const modelResult = await client.query(`SELECT get_model_from_sku($1) as model;`, [sku]);
        console.log(`   ${sku} -> Model: ${modelResult.rows[0].model || 'NULL'}`);
      } catch (error) {
        console.log(`   ${sku} -> ERROR: ${error.message}`);
      }
    }

    console.log('\n✅ Samsung model code fixes completed!');

  } catch (error) {
    console.error('❌ Error fixing Samsung model codes:', error);
  } finally {
    await client.end();
  }
}

fixSamsungModelCodes();
