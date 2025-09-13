import { Router } from 'express';
import { Pool } from 'pg';
import { logger } from '../utils/logger';

const router = Router();
const pool = new Pool({
  connectionString: process.env['DIRECT_URL'],
  ssl: { rejectUnauthorized: false }
});

// Get enhanced inventory data with undefined items
router.get('/inventory-data', async (req, res): Promise<void> => {
  try {
    const { filter, status, limit = 100, offset = 0 } = req.query;

    let whereClause = 'WHERE matched_sku IS NOT NULL';
    const params: any[] = [];
    let paramIndex = 1;

    if (filter === 'undefined') {
      whereClause += ' AND sku_match_status = $' + paramIndex;
      params.push('undefined');
      paramIndex++;
    } else if (filter === 'issues') {
      whereClause += ' AND requires_attention = true';
    } else if (filter === 'matched') {
      whereClause += ' AND sku_match_status = $' + paramIndex;
      params.push('matched');
      paramIndex++;
    }

    if (status) {
      whereClause += ' AND sku_match_status = $' + paramIndex;
      params.push(status);
      paramIndex++;
    }

    const query = `
      SELECT
        matched_sku,
        imei,
        brand || ' - ' || model || ' - ' || capacity as device_characteristics,
        
        -- Enhanced carrier info with device notes
        CASE 
          WHEN device_notes IS NOT NULL AND device_notes != '' 
          THEN carrier || ' (' || device_notes || ')'
          ELSE carrier
        END as carrier_with_notes,
        
        working as working_status,
        location,
        sku_match_status as match_status,
        sku_match_score as match_score,
        sku_match_notes as match_notes,
        requires_attention,
        match_processed_at

      FROM sku_matching_view
      ${whereClause}
      ORDER BY
        requires_attention DESC,
        sku_match_status DESC,
        sku_match_score DESC,
        matched_sku,
        imei
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await pool.query(query, params);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM sku_matching_view 
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: (parseInt(offset as string) + parseInt(limit as string)) < total
      }
    });

  } catch (error) {
    logger.error('Error fetching inventory data:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch inventory data' });
  }
});

// Get detailed view for a specific SKU
router.get('/sku-details/:sku', async (req, res): Promise<void> => {
  try {
    const { sku } = req.params;
    
    const query = `
      SELECT 
        imei, 
        brand, 
        model, 
        capacity, 
        color, 
        carrier,
        working, 
        location,
        sku_match_status, 
        sku_match_score, 
        sku_match_notes, 
        requires_attention,
        data_completeness, 
        device_notes, 
        match_processed_at,
        
        -- Enhanced carrier display with device notes
        CASE 
          WHEN device_notes IS NOT NULL AND device_notes != '' 
          THEN carrier || ' (' || device_notes || ')'
          ELSE carrier
        END as carrier_with_notes,
        
        -- Working status with more detail
        CASE 
          WHEN working = 'YES' THEN 'Working'
          WHEN working = 'NO' THEN 'Not Working'
          WHEN working = 'PASS' THEN 'Passed'
          WHEN working = 'FAILED' THEN 'Failed'
          WHEN working = 'PENDING' THEN 'Pending'
          ELSE COALESCE(working, 'Unknown')
        END as working_status_display
        
      FROM sku_matching_view 
      WHERE matched_sku = $1
      ORDER BY 
        sku_match_status DESC,
        sku_match_score DESC,
        imei
    `;

    const result = await pool.query(query, [sku]);

    res.json({
      success: true,
      sku,
      devices: result.rows
    });

  } catch (error) {
    logger.error('Error fetching SKU details:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch SKU details' });
  }
});

// Update SKU match status (fix undefined items)
router.post('/fix-undefined', async (req, res): Promise<void> => {
  try {
    const { imei, action, newSku, notes } = req.body;

    if (!imei || !action) {
      res.status(400).json({ success: false, error: 'IMEI and action are required' });
      return;
    }

    let updateQuery = '';
    let params: any[] = [imei];

    switch (action) {
      case 'approve_match':
        // Mark as matched (approve the current suggestion)
        updateQuery = `
          UPDATE item 
          SET 
            sku_match_status = 'matched',
            sku_match_notes = COALESCE($2, sku_match_notes),
            updated_at = NOW()
          WHERE imei = $1
        `;
        params.push(notes || 'Manually approved undefined match');
        break;

      case 'change_sku':
        if (!newSku) {
          res.status(400).json({ success: false, error: 'New SKU is required for change_sku action' });
          return;
        }
        updateQuery = `
          UPDATE item 
          SET 
            matched_sku = $2,
            sku_match_status = 'matched',
            sku_match_notes = COALESCE($3, 'SKU manually changed'),
            updated_at = NOW()
          WHERE imei = $1
        `;
        params.push(newSku, notes || 'SKU manually changed');
        break;

      case 'mark_no_match':
        updateQuery = `
          UPDATE item 
          SET 
            sku_match_status = 'no_match',
            sku_match_notes = COALESCE($2, 'Marked as no match'),
            updated_at = NOW()
          WHERE imei = $1
        `;
        params.push(notes || 'Marked as no match');
        break;

      default:
        res.status(400).json({ success: false, error: 'Invalid action' });
        return;
    }

    await pool.query(updateQuery, params);

    // Also update sku_matching_results table
    const updateResultsQuery = `
      UPDATE sku_matching_results 
      SET 
        match_status = CASE 
          WHEN $2 = 'change_sku' THEN 'matched'
          WHEN $2 = 'approve_match' THEN 'matched'
          WHEN $2 = 'mark_no_match' THEN 'no_match'
          ELSE match_status
        END,
        matched_sku = CASE 
          WHEN $2 = 'change_sku' THEN $3
          ELSE matched_sku
        END,
        match_notes = COALESCE($4, match_notes),
        updated_at = NOW()
      WHERE imei = $1
    `;

    await pool.query(updateResultsQuery, [imei, action, newSku, notes]);

    logger.info(`Fixed undefined item: ${imei} with action: ${action}`);

    res.json({
      success: true,
      message: `Successfully ${action.replace('_', ' ')} for IMEI ${imei}`
    });

  } catch (error) {
    logger.error('Error fixing undefined item:', error);
    res.status(500).json({ success: false, error: 'Failed to fix undefined item' });
  }
});

// Bulk fix undefined items
router.post('/bulk-fix', async (req, res): Promise<void> => {
  try {
    const { items, action, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, error: 'Items array is required' });
      return;
    }

    if (!action) {
      res.status(400).json({ success: false, error: 'Action is required' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const results = [];
      for (const item of items) {
        const { imei, newSku } = item;
        
        let updateQuery = '';
        let params: any[] = [imei];

        switch (action) {
          case 'approve_all':
            updateQuery = `
              UPDATE item 
              SET 
                sku_match_status = 'matched',
                sku_match_notes = COALESCE($2, 'Bulk approved undefined match'),
                updated_at = NOW()
              WHERE imei = $1
            `;
            params.push(notes || 'Bulk approved undefined match');
            break;

          case 'mark_no_match':
            updateQuery = `
              UPDATE item 
              SET 
                sku_match_status = 'no_match',
                sku_match_notes = COALESCE($2, 'Bulk marked as no match'),
                updated_at = NOW()
              WHERE imei = $1
            `;
            params.push(notes || 'Bulk marked as no match');
            break;

          default:
            throw new Error(`Invalid bulk action: ${action}`);
        }

        const result = await client.query(updateQuery, params);
        results.push({ imei, success: (result.rowCount || 0) > 0 });
      }

      await client.query('COMMIT');

      const successCount = results.filter(r => r.success).length;
      logger.info(`Bulk fix completed: ${successCount}/${items.length} items processed`);

      res.json({
        success: true,
        message: `Successfully processed ${successCount} out of ${items.length} items`,
        results
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Error in bulk fix:', error);
    res.status(500).json({ success: false, error: 'Failed to process bulk fix' });
  }
});

// Get undefined item statistics
router.get('/stats', async (req, res): Promise<void> => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN sku_match_status = 'matched' THEN 1 END) as matched_count,
        COUNT(CASE WHEN sku_match_status = 'undefined' THEN 1 END) as undefined_count,
        COUNT(CASE WHEN sku_match_status = 'no_match' THEN 1 END) as no_match_count,
        COUNT(CASE WHEN requires_attention = true THEN 1 END) as requires_attention_count,
        
        -- Common undefined reasons
        array_agg(DISTINCT sku_match_notes) FILTER (WHERE sku_match_status = 'undefined' AND sku_match_notes IS NOT NULL) as undefined_reasons
        
      FROM sku_matching_view
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      stats: result.rows[0]
    });

  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
  }
});

// Search SKU codes for autocomplete
router.get('/search-skus', async (req, res): Promise<void> => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q || typeof q !== 'string' || q.length < 2) {
      res.json({ success: true, skus: [] });
      return;
    }

    const searchTerm = `%${q}%`;
    
    const query = `
      SELECT 
        sku_code,
        brand,
        model,
        capacity,
        color,
        carrier,
        post_fix
      FROM sku_master 
      WHERE sku_code ILIKE $1
      ORDER BY 
        CASE 
          WHEN sku_code ILIKE $2 THEN 1
          WHEN sku_code ILIKE $3 THEN 2
          ELSE 3
        END,
        sku_code
      LIMIT $4
    `;

    const exactMatch = `${q}%`;
    const startsWith = `${q}%`;
    
    const result = await pool.query(query, [searchTerm, exactMatch, startsWith, parseInt(limit as string)]);

    const skus = result.rows.map(row => ({
      sku_code: row.sku_code,
      display: `${row.sku_code} (${row.brand} ${row.model} ${row.capacity} ${row.color} ${row.carrier || 'No Carrier'}${row.post_fix ? ' ' + row.post_fix : ''})`,
      details: {
        brand: row.brand,
        model: row.model,
        capacity: row.capacity,
        color: row.color,
        carrier: row.carrier,
        post_fix: row.post_fix
      }
    }));

    res.json({
      success: true,
      skus
    });

  } catch (error) {
    logger.error('Error searching SKUs:', error);
    res.status(500).json({ success: false, error: 'Failed to search SKUs' });
  }
});

// Get SKU details by SKU code
router.get('/sku-info/:skuCode', async (req, res): Promise<void> => {
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
        sku_tags,
        model_tag,
        capacity_tag,
        color_tag,
        carrier_tag
      FROM sku_master 
      WHERE sku_code = $1
    `;

    const result = await pool.query(query, [skuCode]);

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'SKU not found' });
      return;
    }

    const sku = result.rows[0];
    
    res.json({
      success: true,
      sku: {
        sku_code: sku.sku_code,
        brand: sku.brand,
        model: sku.model,
        capacity: sku.capacity,
        color: sku.color,
        carrier: sku.carrier,
        post_fix: sku.post_fix,
        sku_tags: sku.sku_tags,
        model_tag: sku.model_tag,
        capacity_tag: sku.capacity_tag,
        color_tag: sku.color_tag,
        carrier_tag: sku.carrier_tag
      }
    });

  } catch (error) {
    logger.error('Error fetching SKU details:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch SKU details' });
  }
});

export default router;
