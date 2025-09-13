import express from 'express';
import { Pool } from 'pg';
import { logger } from '../utils/logger';

const pool = new Pool({
  connectionString: process.env['DIRECT_URL'],
  ssl: { rejectUnauthorized: false }
});

const router = express.Router();

// Create new SKU
router.post('/create', async (req, res): Promise<void> => {
  try {
    const {
      skuCode,
      brand,
      model,
      capacity,
      color,
      carrier,
      postFix,
      modelTag,
      capacityTag,
      colorTag,
      carrierTag,
      skuTags
    } = req.body;

    // Validate required fields
    if (!skuCode || !brand || !model) {
      res.status(400).json({
        success: false,
        error: 'SKU Code, Brand, and Model are required'
      });
      return;
    }

    // Check if SKU already exists
    const existingSku = await pool.query(
      'SELECT sku_code FROM sku_master WHERE sku_code = $1',
      [skuCode]
    );

    if (existingSku.rows.length > 0) {
      res.status(400).json({
        success: false,
        error: 'SKU code already exists'
      });
      return;
    }

    // Generate tags if not provided
    const generatedTags = skuTags || [];
    if (!modelTag && model) {
      generatedTags.push(model.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    }
    if (!capacityTag && capacity) {
      generatedTags.push(capacity.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    }
    if (!colorTag && color) {
      generatedTags.push(color.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    }
    if (!carrierTag && carrier) {
      generatedTags.push(carrier.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    }

    // Insert new SKU
    const insertQuery = `
      INSERT INTO sku_master (
        sku_code, brand, model, capacity, color, carrier, post_fix,
        model_tag, capacity_tag, color_tag, carrier_tag, sku_tags,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
      )
      RETURNING sku_code
    `;

    const result = await pool.query(insertQuery, [
      skuCode.toUpperCase(),
      brand,
      model,
      capacity || null,
      color || null,
      carrier || null,
      postFix || null,
      modelTag || null,
      capacityTag || null,
      colorTag || null,
      carrierTag || null,
      generatedTags
    ]);

    logger.info(`New SKU created: ${result.rows[0].sku_code}`);

    res.json({
      success: true,
      message: 'SKU created successfully',
      sku_code: result.rows[0].sku_code
    });

  } catch (error) {
    logger.error('Error creating SKU:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create SKU'
    });
  }
});

// Get all SKUs with pagination and search
router.get('/list', async (req, res): Promise<void> => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let whereClause = '';
    let params: any[] = [];
    let paramIndex = 1;

    if (search && typeof search === 'string' && search.trim()) {
      whereClause = `
        WHERE sku_code ILIKE $${paramIndex} 
        OR brand ILIKE $${paramIndex} 
        OR model ILIKE $${paramIndex}
        OR capacity ILIKE $${paramIndex}
        OR color ILIKE $${paramIndex}
        OR carrier ILIKE $${paramIndex}
      `;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const query = `
      SELECT 
        sku_code,
        brand,
        model,
        capacity,
        color,
        carrier,
        post_fix,
        model_tag,
        capacity_tag,
        color_tag,
        carrier_tag,
        sku_tags,
        created_at,
        updated_at
      FROM sku_master
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(parseInt(limit as string), offset);

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM sku_master
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string))
      }
    });

  } catch (error) {
    logger.error('Error fetching SKUs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SKUs'
    });
  }
});

// Get SKU history (must be before /:skuCode route)
router.get('/history', async (req, res): Promise<void> => {
  try {
    const { page = 1, limit = 20, action, sku_code } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let whereClause = '';
    let params: any[] = [];
    let paramIndex = 1;

    const conditions = [];
    
    if (action && typeof action === 'string') {
      conditions.push(`action = $${paramIndex}`);
      params.push(action);
      paramIndex++;
    }
    
    if (sku_code && typeof sku_code === 'string') {
      conditions.push(`sku_code ILIKE $${paramIndex}`);
      params.push(`%${sku_code}%`);
      paramIndex++;
    }
    
    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    const query = `
      SELECT 
        id,
        sku_code,
        action,
        old_data,
        new_data,
        changed_by,
        change_reason,
        created_at
      FROM sku_history
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(parseInt(limit as string), offset);

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM sku_history
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string))
      }
    });

  } catch (error) {
    logger.error('Error fetching SKU history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SKU history'
    });
  }
});

// Get SKU by code
router.get('/:skuCode', async (req, res): Promise<void> => {
  try {
    const { skuCode } = req.params;

    const query = `
      SELECT 
        sku_code,
        brand,
        model,
        capacity,
        color,
        carrier,
        post_fix,
        model_tag,
        capacity_tag,
        color_tag,
        carrier_tag,
        sku_tags,
        created_at,
        updated_at
      FROM sku_master
      WHERE sku_code = $1
    `;

    const result = await pool.query(query, [skuCode]);

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'SKU not found'
      });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Error fetching SKU:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SKU'
    });
  }
});

// Update SKU
router.put('/:skuCode', async (req, res): Promise<void> => {
  try {
    const { skuCode } = req.params;
    const {
      brand,
      model,
      capacity,
      color,
      carrier,
      postFix,
      modelTag,
      capacityTag,
      colorTag,
      carrierTag,
      skuTags
    } = req.body;

    // Check if SKU exists
    const existingSku = await pool.query(
      'SELECT sku_code FROM sku_master WHERE sku_code = $1',
      [skuCode]
    );

    if (existingSku.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'SKU not found'
      });
      return;
    }

    const updateQuery = `
      UPDATE sku_master SET
        brand = $2,
        model = $3,
        capacity = $4,
        color = $5,
        carrier = $6,
        post_fix = $7,
        model_tag = $8,
        capacity_tag = $9,
        color_tag = $10,
        carrier_tag = $11,
        sku_tags = $12,
        updated_at = NOW()
      WHERE sku_code = $1
      RETURNING sku_code
    `;

    const result = await pool.query(updateQuery, [
      skuCode,
      brand,
      model,
      capacity || null,
      color || null,
      carrier || null,
      postFix || null,
      modelTag || null,
      capacityTag || null,
      colorTag || null,
      carrierTag || null,
      skuTags || []
    ]);

    logger.info(`SKU updated: ${result.rows[0].sku_code}`);

    res.json({
      success: true,
      message: 'SKU updated successfully',
      sku_code: result.rows[0].sku_code
    });

  } catch (error) {
    logger.error('Error updating SKU:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update SKU'
    });
  }
});

// Delete SKU
router.delete('/:skuCode', async (req, res): Promise<void> => {
  try {
    const { skuCode } = req.params;

    // Check if SKU exists
    const existingSku = await pool.query(
      'SELECT sku_code FROM sku_master WHERE sku_code = $1',
      [skuCode]
    );

    if (existingSku.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'SKU not found'
      });
      return;
    }

    // Check if SKU is being used in inventory
    const usageCheck = await pool.query(
      'SELECT COUNT(*) as count FROM sku_matching_results WHERE matched_sku = $1',
      [skuCode]
    );

    if (parseInt(usageCheck.rows[0].count) > 0) {
      res.status(400).json({
        success: false,
        error: 'Cannot delete SKU that is currently in use by inventory items'
      });
      return;
    }

    // Delete SKU
    await pool.query('DELETE FROM sku_master WHERE sku_code = $1', [skuCode]);

    logger.info(`SKU deleted: ${skuCode}`);

    res.json({
      success: true,
      message: 'SKU deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting SKU:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete SKU'
    });
  }
});

// Apply SKU history migration
router.post('/migrate/history', async (req, res): Promise<void> => {
  try {
    // Create SKU history table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS sku_history (
        id SERIAL PRIMARY KEY,
        sku_code VARCHAR(255) NOT NULL,
        action VARCHAR(50) NOT NULL,
        old_data JSONB,
        new_data JSONB,
        changed_by VARCHAR(255),
        change_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    
    await pool.query(createTableQuery);
    
    // Create indexes
    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_sku_history_sku_code ON sku_history(sku_code)',
      'CREATE INDEX IF NOT EXISTS idx_sku_history_action ON sku_history(action)',
      'CREATE INDEX IF NOT EXISTS idx_sku_history_created_at ON sku_history(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_sku_history_changed_by ON sku_history(changed_by)'
    ];
    
    for (const query of indexQueries) {
      await pool.query(query);
    }
    
    // Create trigger function
    const triggerFunction = `
      CREATE OR REPLACE FUNCTION log_sku_changes()
      RETURNS TRIGGER AS $$
      BEGIN
          IF TG_OP = 'INSERT' THEN
              INSERT INTO sku_history (sku_code, action, new_data, changed_by, change_reason)
              VALUES (
                  NEW.sku_code,
                  'created',
                  to_jsonb(NEW),
                  COALESCE(current_setting('app.current_user', true), 'system'),
                  'SKU created via API'
              );
              RETURN NEW;
          ELSIF TG_OP = 'UPDATE' THEN
              INSERT INTO sku_history (sku_code, action, old_data, new_data, changed_by, change_reason)
              VALUES (
                  NEW.sku_code,
                  'updated',
                  to_jsonb(OLD),
                  to_jsonb(NEW),
                  COALESCE(current_setting('app.current_user', true), 'system'),
                  'SKU updated via API'
              );
              RETURN NEW;
          ELSIF TG_OP = 'DELETE' THEN
              INSERT INTO sku_history (sku_code, action, old_data, changed_by, change_reason)
              VALUES (
                  OLD.sku_code,
                  'deleted',
                  to_jsonb(OLD),
                  COALESCE(current_setting('app.current_user', true), 'system'),
                  'SKU deleted via API'
              );
              RETURN OLD;
          END IF;
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql
    `;
    
    await pool.query(triggerFunction);
    
    // Create trigger
    const triggerQuery = `
      DROP TRIGGER IF EXISTS sku_history_trigger ON sku_master;
      CREATE TRIGGER sku_history_trigger
          AFTER INSERT OR UPDATE OR DELETE ON sku_master
          FOR EACH ROW EXECUTE FUNCTION log_sku_changes()
    `;
    
    await pool.query(triggerQuery);
    
    // Migrate existing recent SKUs to history
    const migrateQuery = `
      INSERT INTO sku_history (sku_code, action, new_data, changed_by, change_reason, created_at)
      SELECT 
          sku_code,
          'created',
          to_jsonb(sku_master.*),
          'system',
          'Existing SKU - migrated to history',
          created_at
      FROM sku_master
      WHERE created_at >= NOW() - INTERVAL '7 days'
      ON CONFLICT DO NOTHING
    `;
    
    await pool.query(migrateQuery);
    
    logger.info('SKU history migration applied successfully');
    
    res.json({
      success: true,
      message: 'SKU history migration applied successfully'
    });
    
  } catch (error) {
    logger.error('Error applying SKU history migration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply SKU history migration'
    });
  }
});

// Get SKU statistics
router.get('/stats/overview', async (req, res): Promise<void> => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_skus,
        COUNT(DISTINCT brand) as total_brands,
        COUNT(DISTINCT model) as total_models,
        COUNT(DISTINCT carrier) as total_carriers,
        COUNT(CASE WHEN carrier = 'UNLOCKED' THEN 1 END) as unlocked_count,
        COUNT(CASE WHEN carrier != 'UNLOCKED' AND carrier IS NOT NULL THEN 1 END) as carrier_locked_count
      FROM sku_master
    `;

    const result = await pool.query(statsQuery);

    res.json({
      success: true,
      stats: result.rows[0]
    });

  } catch (error) {
    logger.error('Error fetching SKU stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SKU statistics'
    });
  }
});

export default router;
