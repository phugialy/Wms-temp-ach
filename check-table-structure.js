const { Client } = require('pg');
require('dotenv').config();

async function checkTableStructure() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    console.log('\n🔍 CHECKING TABLE STRUCTURE...');
    
    // Check if sku_tags table exists and its structure
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'sku_tags'
      );
    `);
    
    if (tableExists.rows[0].exists) {
      console.log('✅ sku_tags table exists');
      
      // Get table structure
      const tableStructure = await client.query(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'sku_tags'
        ORDER BY ordinal_position;
      `);
      
      console.log('\n📊 sku_tags table structure:');
      tableStructure.rows.forEach(col => {
        console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
      
      // Get constraints
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
      
      console.log('\n🔒 Constraints on sku_tags:');
      if (constraints.rows.length > 0) {
        constraints.rows.forEach(constraint => {
          console.log(`   ${constraint.constraint_name}: ${constraint.constraint_type} on ${constraint.column_name}`);
        });
      } else {
        console.log('   No constraints found');
      }
      
    } else {
      console.log('❌ sku_tags table does not exist');
    }

    // Check if sku_master_tags table exists
    const masterTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'sku_master_tags'
      );
    `);
    
    if (masterTableExists.rows[0].exists) {
      console.log('\n✅ sku_master_tags table exists');
    } else {
      console.log('\n❌ sku_master_tags table does not exist');
    }

  } catch (error) {
    console.error('❌ Error checking table structure:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the check
checkTableStructure();
