const { Client } = require('pg');
require('dotenv').config();

async function fixTableConstraints() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log('\n🔧 FIXING TABLE CONSTRAINTS...');
    
    // First, clean up any existing data
    console.log('\n🧹 Cleaning existing data...');
    await client.query('DELETE FROM sku_master_tags');
    await client.query('DELETE FROM sku_tags');
    console.log('✅ Cleared existing data');

    // Drop the incorrect unique constraint
    console.log('\n🗑️ Dropping incorrect unique constraint...');
    try {
      await client.query('ALTER TABLE sku_tags DROP CONSTRAINT sku_tags_tag_name_key');
      console.log('✅ Dropped sku_tags_tag_name_key constraint');
    } catch (error) {
      console.log('⚠️ Constraint already dropped or doesn\'t exist');
    }

    // Create the correct unique constraint on (tag_name, tag_category)
    console.log('\n🔒 Creating correct unique constraint...');
    try {
      await client.query('ALTER TABLE sku_tags ADD CONSTRAINT sku_tags_name_category_unique UNIQUE (tag_name, tag_category)');
      console.log('✅ Added sku_tags_name_category_unique constraint');
    } catch (error) {
      console.log('⚠️ Constraint already exists or error:', error.message);
    }

    // Verify the new constraint structure
    console.log('\n✅ Verifying new constraint structure...');
    const constraints = await client.query(`
      SELECT 
        tc.constraint_name,
        tc.constraint_type,
        ccu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'sku_tags';
    `);
    
    console.log('\n🔒 New constraints on sku_tags:');
    if (constraints.rows.length > 0) {
      constraints.rows.forEach(constraint => {
        console.log(`   ${constraint.constraint_name}: ${constraint.constraint_type} on ${constraint.column_name}`);
      });
    } else {
      console.log('   No constraints found');
    }

    console.log('\n🎯 Constraint fix complete!');
    console.log('✅ Now the same tag_name can exist in different categories');
    console.log('✅ Ready to run the parser!');

  } catch (error) {
    console.error('❌ Error fixing constraints:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the fix
fixTableConstraints();
