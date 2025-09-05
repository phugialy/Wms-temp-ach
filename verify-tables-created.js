const { Client } = require('pg');
require('dotenv').config();

async function verifyTablesCreated() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log('\n🔍 VERIFYING NEW TAG SYSTEM TABLES...\n');

    // 1. Check if new tables exist
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('sku_tags', 'sku_master_tags', 'undefined_tag_review')
      ORDER BY table_name
    `);

    console.log('📋 New Tables Created:');
    if (tables.rows.length === 3) {
      tables.rows.forEach(table => {
        console.log(`   ✅ ${table.table_name}`);
      });
    } else {
      console.log(`   ❌ Expected 3 tables, found ${tables.rows.length}`);
    }

    // 2. Check new columns in sku_master
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'sku_master' 
      AND column_name IN ('device_type', 'tag_count')
      ORDER BY column_name
    `);

    console.log('\n📋 New Columns in sku_master:');
    if (columns.rows.length === 2) {
      columns.rows.forEach(col => {
        console.log(`   ✅ ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    } else {
      console.log(`   ❌ Expected 2 columns, found ${columns.rows.length}`);
    }

    // 3. Check constraints
    const constraints = await client.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints 
      WHERE table_name = 'sku_tags' 
      AND constraint_name = 'sku_tags_name_category_unique'
    `);

    console.log('\n📋 Unique Constraint:');
    if (constraints.rows.length === 1) {
      console.log(`   ✅ ${constraints.rows[0].constraint_name} (${constraints.rows[0].constraint_type})`);
    } else {
      console.log('   ❌ Unique constraint not found');
    }

    // 4. Check indexes
    const indexes = await client.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE indexname IN (
        'idx_sku_tags_category', 'idx_sku_tags_name',
        'idx_sku_master_tags_sku_id', 'idx_sku_master_tags_tag_id',
        'idx_sku_master_device_type', 'idx_undefined_tag_review_status'
      )
      ORDER BY indexname
    `);

    console.log('\n📋 Performance Indexes:');
    if (indexes.rows.length === 6) {
      indexes.rows.forEach(idx => {
        console.log(`   ✅ ${idx.indexname} on ${idx.tablename}`);
      });
    } else {
      console.log(`   ❌ Expected 6 indexes, found ${indexes.rows.length}`);
    }

    // 5. Check triggers
    const triggers = await client.query(`
      SELECT trigger_name, event_object_table
      FROM information_schema.triggers 
      WHERE trigger_name IN ('update_sku_tags_updated_at', 'update_undefined_tag_review_updated_at')
      ORDER BY trigger_name
    `);

    console.log('\n📋 Auto-Update Triggers:');
    if (triggers.rows.length === 2) {
      triggers.rows.forEach(trigger => {
        console.log(`   ✅ ${trigger.trigger_name} on ${trigger.event_object_table}`);
      });
    } else {
      console.log(`   ❌ Expected 2 triggers, found ${triggers.rows.length}`);
    }

    // 6. Check table structure details
    console.log('\n📋 Table Structure Details:');
    
    const skuTagsStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'sku_tags'
      ORDER BY ordinal_position
    `);
    
    console.log('\n   sku_tags structure:');
    skuTagsStructure.rows.forEach(col => {
      console.log(`     ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    const skuMasterTagsStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'sku_master_tags'
      ORDER BY ordinal_position
    `);
    
    console.log('\n   sku_master_tags structure:');
    skuMasterTagsStructure.rows.forEach(col => {
      console.log(`     ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    const undefinedTagReviewStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'undefined_tag_review'
      ORDER BY ordinal_position
    `);
    
    console.log('\n   undefined_tag_review structure:');
    undefinedTagReviewStructure.rows.forEach(col => {
      console.log(`     ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    console.log('\n🎉 VERIFICATION COMPLETE!');
    
    if (tables.rows.length === 3 && columns.rows.length === 2 && 
        constraints.rows.length === 1 && indexes.rows.length === 6 && 
        triggers.rows.length === 2) {
      console.log('✅ All new tag system components created successfully!');
      console.log('🚀 Ready to proceed with Phase 2: Core System Implementation');
    } else {
      console.log('⚠️ Some components may need attention');
    }

  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected from database');
  }
}

verifyTablesCreated();

