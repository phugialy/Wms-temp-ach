const { Client } = require('pg');
require('dotenv').config();

async function checkSkuCount() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    // Check total SKU count
    const totalCount = await client.query(`
      SELECT COUNT(*) as total_skus
      FROM sku_master 
      WHERE is_active = true
    `);
    
    console.log(`📊 Total active SKUs in database: ${totalCount.rows[0].total_skus}`);

    // Check SKUs by category
    const categoryCount = await client.query(`
      SELECT 
        CASE 
          WHEN sku_code LIKE 'IPAD%' THEN 'IPAD'
          WHEN sku_code LIKE 'IPHONE%' THEN 'IPHONE'
          WHEN sku_code LIKE 'FOLD%' THEN 'SAMSUNG_FOLD'
          WHEN sku_code LIKE 'S%' AND sku_code ~ '^S[0-9]+' THEN 'SAMSUNG_S'
          WHEN sku_code LIKE 'PIXEL%' THEN 'PIXEL'
          ELSE 'OTHER'
        END as category,
        COUNT(*) as count
      FROM sku_master 
      WHERE is_active = true
      GROUP BY 
        CASE 
          WHEN sku_code LIKE 'IPAD%' THEN 'IPAD'
          WHEN sku_code LIKE 'IPHONE%' THEN 'IPHONE'
          WHEN sku_code LIKE 'FOLD%' THEN 'SAMSUNG_FOLD'
          WHEN sku_code LIKE 'S%' AND sku_code ~ '^S[0-9]+' THEN 'SAMSUNG_S'
          WHEN sku_code LIKE 'PIXEL%' THEN 'PIXEL'
          ELSE 'OTHER'
        END
      ORDER BY count DESC
    `);

    console.log('\n📱 SKUs by Category:');
    categoryCount.rows.forEach(row => {
      console.log(`   ${row.category}: ${row.count} SKUs`);
    });

  } catch (error) {
    console.error('❌ Error during count check:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('🔌 Disconnected from database');
  }
}

// Run the check
checkSkuCount();
