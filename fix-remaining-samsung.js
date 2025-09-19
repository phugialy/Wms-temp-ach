const { Client } = require('pg');
require('dotenv').config();

async function fixRemainingSamsung() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    console.log('🔧 Adding remaining Samsung model patterns...');

    // Get Samsung brand ID
    const samsungBrand = await client.query(`SELECT id FROM sku_brand_reference WHERE brand_name = 'SAMSUNG';`);
    const samsungBrandId = samsungBrand.rows[0]?.id;

    if (samsungBrandId) {
      // Add remaining Samsung model patterns
      await client.query(`
        INSERT INTO sku_model_reference (model_name, model_code, sku_patterns, brand_id, description) VALUES
        ('Galaxy Tab S7', 'TAB-S7-ALT', ARRAY['SM-T677'], $1, 'Samsung Galaxy Tab S7 (Alternative)'),
        ('Galaxy Tab S8', 'TAB-S8-ALT', ARRAY['SM-X700'], $1, 'Samsung Galaxy Tab S8 (Alternative)'),
        ('Galaxy Tab S8 Ultra', 'TAB-S8-ULTRA-ALT', ARRAY['SM-X808'], $1, 'Samsung Galaxy Tab S8 Ultra (Alternative)')
        ON CONFLICT (model_code) DO NOTHING;
      `, [samsungBrandId]);
    }

    console.log('✅ Added remaining Samsung model patterns');

    // Now fix the remaining missing models
    console.log('\n🔧 Fixing remaining Samsung devices...');
    
    const remainingSkus = await client.query(`
      SELECT sku_code, brand, model, capacity, color, carrier, post_fix
      FROM sku_master 
      WHERE brand = 'SAMSUNG'
      AND (model IS NULL OR model = '')
      ORDER BY sku_code;
    `);
    
    console.log(`Found ${remainingSkus.rows.length} remaining SAMSUNG devices with missing model`);

    let updatedCount = 0;
    for (const sku of remainingSkus.rows) {
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
    console.log(`   ✅ Remaining SAMSUNG devices updated: ${updatedCount}`);

    // Final check
    console.log('\n📊 Final SAMSUNG Status Check...');
    
    const finalCheck = await client.query(`
      SELECT 
        COUNT(*) as total_samsung,
        COUNT(CASE WHEN model IS NOT NULL AND model != '' THEN 1 END) as with_model,
        COUNT(CASE WHEN model IS NULL OR model = '' THEN 1 END) as no_model
      FROM sku_master 
      WHERE brand = 'SAMSUNG';
    `);
    
    const stats = finalCheck.rows[0];
    console.log(`   📱 Total SAMSUNG devices: ${stats.total_samsung}`);
    console.log(`   ✅ With models: ${stats.with_model}`);
    console.log(`   ❌ Missing models: ${stats.no_model}`);

    console.log('\n✅ Remaining Samsung fixes completed!');

  } catch (error) {
    console.error('❌ Error fixing remaining Samsung:', error);
  } finally {
    await client.end();
  }
}

fixRemainingSamsung();


