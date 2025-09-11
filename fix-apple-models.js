const { Client } = require('pg');
require('dotenv').config();

async function fixAppleModels() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    console.log('🔧 Adding Apple model patterns...');

    // Get Apple brand ID
    const appleBrand = await client.query(`SELECT id FROM sku_brand_reference WHERE brand_name = 'APPLE';`);
    const appleBrandId = appleBrand.rows[0]?.id;

    if (appleBrandId) {
      // Add Apple model patterns
      await client.query(`
        INSERT INTO sku_model_reference (model_name, model_code, sku_patterns, brand_id, description) VALUES
        ('iPhone 11', 'IPHONE11', ARRAY['IP-11'], $1, 'Apple iPhone 11'),
        ('iPhone 12', 'IPHONE12', ARRAY['IP-12'], $1, 'Apple iPhone 12'),
        ('iPad Pro 12.9', 'IPAD-PRO-12.9', ARRAY['MJYR2LL/A'], $1, 'Apple iPad Pro 12.9'),
        ('iPad Air', 'IPAD-AIR', ARRAY['ML0G2LL/A', 'ML3Q2LL/A'], $1, 'Apple iPad Air'),
        ('iPad', 'IPAD', ARRAY['MP6J2LL/A', 'MQDD2LL/A'], $1, 'Apple iPad'),
        ('MacBook Pro', 'MACBOOK-PRO', ARRAY['MXNG2LL/A'], $1, 'Apple MacBook Pro')
        ON CONFLICT (model_code) DO NOTHING;
      `, [appleBrandId]);
    }

    console.log('✅ Added Apple model patterns');

    // Now fix the missing models
    console.log('\n🔧 Fixing Apple devices with missing models...');
    
    const appleSkus = await client.query(`
      SELECT sku_code, brand, model, capacity, color, carrier, post_fix
      FROM sku_master 
      WHERE brand = 'APPLE'
      AND (model IS NULL OR model = '')
      ORDER BY sku_code;
    `);
    
    console.log(`Found ${appleSkus.rows.length} APPLE devices with missing model`);

    let updatedCount = 0;
    for (const sku of appleSkus.rows) {
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
    console.log(`   ✅ APPLE devices updated: ${updatedCount}`);

    // Final check
    console.log('\n📊 Final APPLE Status Check...');
    
    const finalCheck = await client.query(`
      SELECT 
        COUNT(*) as total_apple,
        COUNT(CASE WHEN model IS NOT NULL AND model != '' THEN 1 END) as with_model,
        COUNT(CASE WHEN model IS NULL OR model = '' THEN 1 END) as no_model
      FROM sku_master 
      WHERE brand = 'APPLE';
    `);
    
    const stats = finalCheck.rows[0];
    console.log(`   📱 Total APPLE devices: ${stats.total_apple}`);
    console.log(`   ✅ With models: ${stats.with_model}`);
    console.log(`   ❌ Missing models: ${stats.no_model}`);

    console.log('\n✅ Apple model fixes completed!');

  } catch (error) {
    console.error('❌ Error fixing Apple models:', error);
  } finally {
    await client.end();
  }
}

fixAppleModels();
