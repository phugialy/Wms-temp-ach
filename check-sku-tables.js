const { Client } = require('pg');
require('dotenv').config();

async function checkSkuTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    console.log('\n🎯 SKU-RELATED TABLES ANALYSIS');
    console.log('=====================================');

    // Get all tables that contain 'sku' in their name
    console.log('\n📋 SKU-related tables:');
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name ILIKE '%sku%'
      ORDER BY table_name
    `;
    const tableResult = await client.query(tableQuery);
    
    if (tableResult.rows.length === 0) {
      console.log('  No SKU-related tables found');
    } else {
      tableResult.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    }

    // Check each SKU-related table structure
    for (const tableRow of tableResult.rows) {
      const tableName = tableRow.table_name;
      console.log(`\n📊 Table: ${tableName}`);
      
      // Get column information
      const columnQuery = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1
        ORDER BY ordinal_position
      `;
      const columnResult = await client.query(columnQuery, [tableName]);
      
      console.log('  Columns:');
      columnResult.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`    ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
      });

      // Get row count
      const countQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
      const countResult = await client.query(countQuery);
      console.log(`  Row count: ${countResult.rows[0].count}`);

      // Show sample data for small tables
      if (countResult.rows[0].count <= 10) {
        const sampleQuery = `SELECT * FROM ${tableName} LIMIT 5`;
        const sampleResult = await client.query(sampleQuery);
        if (sampleResult.rows.length > 0) {
          console.log('  Sample data:');
          sampleResult.rows.forEach((row, index) => {
            console.log(`    Row ${index + 1}:`, row);
          });
        }
      }
    }

    // Check views that contain 'sku'
    console.log('\n👁️ SKU-related views:');
    const viewQuery = `
      SELECT viewname 
      FROM pg_views 
      WHERE schemaname = 'public' 
      AND viewname ILIKE '%sku%'
      ORDER BY viewname
    `;
    const viewResult = await client.query(viewQuery);
    
    if (viewResult.rows.length === 0) {
      console.log('  No SKU-related views found');
    } else {
      viewResult.rows.forEach(row => {
        console.log(`  - ${row.viewname}`);
      });
    }

    // Check each SKU-related view structure
    for (const viewRow of viewResult.rows) {
      const viewName = viewRow.viewname;
      console.log(`\n👁️ View: ${viewName}`);
      
      // Get column information for view
      const viewColumnQuery = `
        SELECT 
          column_name,
          data_type,
          is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1
        ORDER BY ordinal_position
      `;
      const viewColumnResult = await client.query(viewColumnQuery, [viewName]);
      
      console.log('  Columns:');
      viewColumnResult.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        console.log(`    ${col.column_name}: ${col.data_type} ${nullable}`);
      });

      // Get row count for view
      const viewCountQuery = `SELECT COUNT(*) as count FROM ${viewName}`;
      const viewCountResult = await client.query(viewCountQuery);
      console.log(`  Row count: ${viewCountResult.rows[0].count}`);

      // Show sample data for views
      if (viewCountResult.rows[0].count <= 10) {
        const viewSampleQuery = `SELECT * FROM ${viewName} LIMIT 5`;
        const viewSampleResult = await client.query(viewSampleQuery);
        if (viewSampleResult.rows.length > 0) {
          console.log('  Sample data:');
          viewSampleResult.rows.forEach((row, index) => {
            console.log(`    Row ${index + 1}:`, row);
          });
        }
      }
    }

    // Check for any tables with 'original' or 'match' in the name
    console.log('\n🔍 Tables with "original" or "match" in name:');
    const originalMatchQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name ILIKE '%original%' OR table_name ILIKE '%match%')
      ORDER BY table_name
    `;
    const originalMatchResult = await client.query(originalMatchQuery);
    
    if (originalMatchResult.rows.length === 0) {
      console.log('  No tables with "original" or "match" found');
    } else {
      originalMatchResult.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkSkuTables();
