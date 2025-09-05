const { Client } = require('pg');
require('dotenv').config();

class UndefinedTagAdmin {
  constructor(dbClient) {
    this.db = dbClient;
  }

  async viewUndefinedTags(limit = 50, offset = 0) {
    console.log('📋 VIEWING UNDEFINED TAGS FOR MANUAL REVIEW');
    console.log('=' .repeat(60));
    
    const result = await this.db.query(`
      SELECT 
        id,
        tag_value,
        original_sku,
        status,
        suggested_type,
        suggested_category,
        product_description,
        created_at
      FROM undefined_tag_review 
      WHERE status = 'UNDEFINED'
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    if (result.rows.length === 0) {
      console.log('✅ No undefined tags found!');
      return;
    }
    
    console.log(`Found ${result.rows.length} undefined tags:\n`);
    
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. Tag: "${row.tag_value}"`);
      console.log(`   SKU: ${row.original_sku}`);
      console.log(`   Suggested Type: ${row.suggested_type || 'N/A'}`);
      console.log(`   Suggested Category: ${row.suggested_category || 'N/A'}`);
      if (row.product_description) {
        console.log(`   Description: ${row.product_description.substring(0, 100)}${row.product_description.length > 100 ? '...' : ''}`);
      }
      console.log(`   Created: ${row.created_at}`);
      console.log(`   ID: ${row.id}`);
      console.log('');
    });
  }

  async updateTagStatus(tagId, newStatus, newCategory, newType, userNotes, reviewedBy) {
    try {
      const result = await this.db.query(`
        UPDATE undefined_tag_review 
        SET 
          status = $1,
          suggested_category = $2,
          suggested_type = $3,
          user_notes = $4,
          reviewed_by = $5,
          reviewed_at = NOW()
        WHERE id = $6
        RETURNING *
      `, [newStatus, newCategory, newType, userNotes, reviewedBy, tagId]);
      
      if (result.rows.length > 0) {
        console.log(`✅ Tag ${tagId} updated successfully!`);
        console.log(`   New Status: ${newStatus}`);
        console.log(`   New Category: ${newCategory}`);
        console.log(`   New Type: ${newType}`);
        console.log(`   Reviewed by: ${reviewedBy}`);
        return result.rows[0];
      } else {
        console.log(`❌ Tag ${tagId} not found`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Error updating tag ${tagId}:`, error.message);
      return null;
    }
  }

  async getTagStatistics() {
    console.log('📊 UNDEFINED TAG STATISTICS');
    console.log('=' .repeat(40));
    
    // Total counts
    const totalCount = await this.db.query('SELECT COUNT(*) FROM undefined_tag_review');
    const undefinedCount = await this.db.query("SELECT COUNT(*) FROM undefined_tag_review WHERE status = 'UNDEFINED'");
    const reviewedCount = await this.db.query("SELECT COUNT(*) FROM undefined_tag_review WHERE status = 'REVIEWED'");
    
    console.log(`Total tags in review: ${totalCount.rows[0].count}`);
    console.log(`Still undefined: ${undefinedCount.rows[0].count}`);
    console.log(`Reviewed: ${reviewedCount.rows[0].count}`);
    
    // Top undefined tags by frequency
    const topUndefined = await this.db.query(`
      SELECT 
        tag_value,
        COUNT(*) as frequency,
        STRING_AGG(DISTINCT suggested_category, ', ') as suggested_categories,
        STRING_AGG(DISTINCT suggested_type, ', ') as suggested_types
      FROM undefined_tag_review 
      WHERE status = 'UNDEFINED'
      GROUP BY tag_value
      ORDER BY frequency DESC
      LIMIT 10
    `);
    
    console.log('\n🔝 Top 10 Undefined Tags by Frequency:');
    topUndefined.rows.forEach((row, index) => {
      console.log(`${index + 1}. "${row.tag_value}" (${row.frequency}x)`);
      console.log(`   Suggested Categories: ${row.suggested_categories || 'N/A'}`);
      console.log(`   Suggested Types: ${row.suggested_types || 'N/A'}`);
    });
    
    // Device type breakdown
    const typeBreakdown = await this.db.query(`
      SELECT 
        suggested_type,
        COUNT(*) as count
      FROM undefined_tag_review 
      WHERE status = 'UNDEFINED'
      GROUP BY suggested_type
      ORDER BY count DESC
    `);
    
    console.log('\n📱 Undefined Tags by Suggested Type:');
    typeBreakdown.rows.forEach(row => {
      console.log(`   ${row.suggested_type || 'UNKNOWN'}: ${row.count}`);
    });
  }

  async searchTags(searchTerm) {
    console.log(`🔍 SEARCHING FOR TAGS CONTAINING: "${searchTerm}"`);
    console.log('=' .repeat(50));
    
    const result = await this.db.query(`
      SELECT 
        id,
        tag_value,
        original_sku,
        status,
        suggested_type,
        suggested_category
      FROM undefined_tag_review 
      WHERE 
        tag_value ILIKE $1 OR 
        original_sku ILIKE $1
      ORDER BY tag_value
      LIMIT 20
    `, [`%${searchTerm}%`]);
    
    if (result.rows.length === 0) {
      console.log('❌ No tags found matching your search');
      return;
    }
    
    console.log(`Found ${result.rows.length} matching tags:\n`);
    
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. Tag: "${row.tag_value}"`);
      console.log(`   SKU: ${row.original_sku}`);
      console.log(`   Status: ${row.status}`);
      console.log(`   Suggested Type: ${row.suggested_type || 'N/A'}`);
      console.log(`   Suggested Category: ${row.suggested_category || 'N/A'}`);
      console.log(`   ID: ${row.id}`);
      console.log('');
    });
  }

  async exportUndefinedTags() {
    console.log('📤 EXPORTING UNDEFINED TAGS FOR MANUAL REVIEW');
    console.log('=' .repeat(50));
    
    const result = await this.db.query(`
      SELECT 
        tag_value,
        original_sku,
        suggested_type,
        suggested_category,
        product_description,
        created_at
      FROM undefined_tag_review 
      WHERE status = 'UNDEFINED'
      ORDER BY tag_value, original_sku
    `);
    
    if (result.rows.length === 0) {
      console.log('✅ No undefined tags to export');
      return;
    }
    
    console.log(`Exporting ${result.rows.length} undefined tags...\n`);
    
    // Create CSV-like output
    console.log('Tag Value,Original SKU,Suggested Type,Suggested Category,Product Description,Created At');
    result.rows.forEach(row => {
      const description = (row.product_description || '').replace(/"/g, '""');
      console.log(`"${row.tag_value}","${row.original_sku}","${row.suggested_type || ''}","${row.suggested_category || ''}","${description}","${row.created_at}"`);
    });
    
    console.log(`\n✅ Exported ${result.rows.length} undefined tags`);
  }
}

async function runAdminInterface() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database successfully');

    const admin = new UndefinedTagAdmin(client);
    
    // Show statistics
    await admin.getTagStatistics();
    
    console.log('\n' + '='.repeat(60));
    console.log('ADMIN INTERFACE READY');
    console.log('='.repeat(60));
    console.log('Available commands:');
    console.log('1. viewUndefinedTags(limit, offset) - View undefined tags');
    console.log('2. updateTagStatus(id, status, category, type, notes, user) - Update tag');
    console.log('3. searchTags(term) - Search for specific tags');
    console.log('4. exportUndefinedTags() - Export to CSV format');
    console.log('5. getTagStatistics() - Show statistics');
    
    // Example usage
    console.log('\n📋 Example: View first 20 undefined tags');
    await admin.viewUndefinedTags(20, 0);
    
  } catch (error) {
    console.error('❌ Error in admin interface:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the admin interface
runAdminInterface();

