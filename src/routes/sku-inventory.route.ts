import { Router } from 'express';
import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { dbService } from '../services/DatabaseConnectionService';

const router = Router();

// Get SKU inventory summary with device counts
router.get('/summary', async (req, res): Promise<void> => {
  try {
    const { brand, model, capacity, color, carrier, type } = req.query;
    
    // Build dynamic WHERE clause
    let whereConditions = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (brand && typeof brand === 'string') {
      whereConditions.push(`brand ILIKE $${paramIndex}`);
      params.push(`%${brand}%`);
      paramIndex++;
    }

    if (model && typeof model === 'string') {
      whereConditions.push(`model ILIKE $${paramIndex}`);
      params.push(`%${model}%`);
      paramIndex++;
    }

    if (capacity && typeof capacity === 'string') {
      whereConditions.push(`capacity ILIKE $${paramIndex}`);
      params.push(`%${capacity}%`);
      paramIndex++;
    }

    if (color && typeof color === 'string') {
      whereConditions.push(`color ILIKE $${paramIndex}`);
      params.push(`%${color}%`);
      paramIndex++;
    }

    if (carrier && typeof carrier === 'string') {
      whereConditions.push(`carrier ILIKE $${paramIndex}`);
      params.push(`%${carrier}%`);
      paramIndex++;
    }

    if (type && typeof type === 'string') {
      whereConditions.push(`matched_sku ILIKE $${paramIndex}`);
      params.push(`${type.toUpperCase()}-%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Main query to get SKU inventory summary
    const query = `
      SELECT 
        matched_sku,
        brand,
        model,
        capacity,
        color,
        carrier,
        COUNT(*) as device_count,
        COUNT(CASE WHEN sku_match_status = 'matched' THEN 1 END) as matched_count,
        COUNT(CASE WHEN sku_match_status = 'undefined' THEN 1 END) as undefined_count,
        COUNT(CASE WHEN sku_match_status = 'no_match' THEN 1 END) as no_match_count,
        COUNT(CASE WHEN working = 'YES' THEN 1 END) as working_count,
        COUNT(CASE WHEN working = 'NO' THEN 1 END) as not_working_count,
        AVG(sku_match_score) as avg_match_score,
        MIN(match_processed_at) as first_seen,
        MAX(match_processed_at) as last_seen
      FROM sku_matching_view
      ${whereClause}
      GROUP BY matched_sku, brand, model, capacity, color, carrier
      ORDER BY device_count DESC, matched_sku
    `;

    const result = await dbService.query(query, params);

    // Get total summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT matched_sku) as total_skus,
        COUNT(*) as total_devices,
        COUNT(CASE WHEN sku_match_status = 'matched' THEN 1 END) as total_matched,
        COUNT(CASE WHEN sku_match_status = 'undefined' THEN 1 END) as total_undefined,
        COUNT(CASE WHEN sku_match_status = 'no_match' THEN 1 END) as total_no_match,
        COUNT(CASE WHEN working = 'YES' THEN 1 END) as total_working,
        COUNT(CASE WHEN working = 'NO' THEN 1 END) as total_not_working
      FROM sku_matching_view
      ${whereClause}
    `;

    const summaryResult = await dbService.query(summaryQuery, params);

    res.json({
      success: true,
      data: result.rows,
      summary: summaryResult.rows[0],
      filters: {
        brand: brand || '',
        model: model || '',
        capacity: capacity || '',
        color: color || '',
        carrier: carrier || '',
        type: type || ''
      }
    });

  } catch (error) {
    logger.error('Error fetching SKU inventory summary:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch SKU inventory summary' });
  }
});

// Get filter options for hierarchical filtering
router.get('/filter-options', async (req, res): Promise<void> => {
  try {
    const { type, brand, model, capacity, color } = req.query;
    
    let whereConditions = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (type && typeof type === 'string') {
      whereConditions.push(`matched_sku ILIKE $${paramIndex}`);
      params.push(`${type.toUpperCase()}-%`);
      paramIndex++;
    }

    if (brand && typeof brand === 'string') {
      whereConditions.push(`brand ILIKE $${paramIndex}`);
      params.push(`%${brand}%`);
      paramIndex++;
    }

    if (model && typeof model === 'string') {
      whereConditions.push(`model ILIKE $${paramIndex}`);
      params.push(`%${model}%`);
      paramIndex++;
    }

    if (capacity && typeof capacity === 'string') {
      whereConditions.push(`capacity ILIKE $${paramIndex}`);
      params.push(`%${capacity}%`);
      paramIndex++;
    }

    if (color && typeof color === 'string') {
      whereConditions.push(`color ILIKE $${paramIndex}`);
      params.push(`%${color}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get unique values for each filter level
    const brandsQuery = `
      SELECT DISTINCT p.brand, COUNT(*) as count
      FROM product p
      INNER JOIN item i ON p.imei = i.imei
      ${whereClause.replace('brand', 'p.brand').replace('model', 'i.model').replace('capacity', 'i.capacity').replace('carrier', 'i.carrier')}
      GROUP BY p.brand
      ORDER BY count DESC, p.brand
    `;

    const modelsQuery = `
      SELECT DISTINCT i.model, COUNT(*) as count
      FROM product p
      INNER JOIN item i ON p.imei = i.imei
      ${whereClause.replace('brand', 'p.brand').replace('model', 'i.model').replace('capacity', 'i.capacity').replace('carrier', 'i.carrier')}
      GROUP BY i.model
      ORDER BY count DESC, i.model
    `;

    const capacitiesQuery = `
      SELECT DISTINCT i.capacity, COUNT(*) as count
      FROM product p
      INNER JOIN item i ON p.imei = i.imei
      ${whereClause.replace('brand', 'p.brand').replace('model', 'i.model').replace('capacity', 'i.capacity').replace('carrier', 'i.carrier')}
      GROUP BY i.capacity
      ORDER BY count DESC, i.capacity
    `;

    const colorsQuery = `
      SELECT DISTINCT i.color, COUNT(*) as count
      FROM product p
      INNER JOIN item i ON p.imei = i.imei
      ${whereClause.replace('brand', 'p.brand').replace('model', 'i.model').replace('capacity', 'i.capacity').replace('carrier', 'i.carrier')}
      GROUP BY i.color
      ORDER BY count DESC, i.color
    `;

    const carriersQuery = `
      SELECT DISTINCT i.carrier, COUNT(*) as count
      FROM product p
      INNER JOIN item i ON p.imei = i.imei
      ${whereClause.replace('brand', 'p.brand').replace('model', 'i.model').replace('capacity', 'i.capacity').replace('carrier', 'i.carrier')}
      GROUP BY i.carrier
      ORDER BY count DESC, i.carrier
    `;

    const typesQuery = `
      SELECT 'PHONE' as type, COUNT(*) as count
      FROM product p
      INNER JOIN item i ON p.imei = i.imei
      WHERE p.brand IN ('Samsung', 'Apple', 'Google')
      UNION ALL
      SELECT 'TABLET' as type, COUNT(*) as count
      FROM product p
      INNER JOIN item i ON p.imei = i.imei
      WHERE p.brand IN ('Samsung', 'Apple') AND i.model ILIKE '%tab%'
      ORDER BY count DESC, type
    `;

    const [brandsResult, modelsResult, capacitiesResult, colorsResult, carriersResult, typesResult] = await Promise.all([
      dbService.query(brandsQuery, params),
      dbService.query(modelsQuery, params),
      dbService.query(capacitiesQuery, params),
      dbService.query(colorsQuery, params),
      dbService.query(carriersQuery, params),
      dbService.query(typesQuery)
    ]);

    res.json({
      success: true,
      options: {
        types: typesResult.rows,
        brands: brandsResult.rows,
        models: modelsResult.rows,
        capacities: capacitiesResult.rows,
        colors: colorsResult.rows,
        carriers: carriersResult.rows
      }
    });

  } catch (error) {
    logger.error('Error fetching filter options:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch filter options' });
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
        device_notes,
        match_processed_at,
        CASE
          WHEN device_notes IS NOT NULL AND device_notes != ''
          THEN carrier || ' (' || device_notes || ')'
          ELSE carrier
        END as carrier_with_notes,
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

    const result = await dbService.query(query, [sku]);

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'SKU not found' });
      return;
    }

    // Get SKU summary
    const summaryQuery = `
      SELECT 
        matched_sku,
        brand,
        model,
        capacity,
        color,
        carrier,
        COUNT(*) as total_devices,
        COUNT(CASE WHEN sku_match_status = 'matched' THEN 1 END) as matched_count,
        COUNT(CASE WHEN sku_match_status = 'undefined' THEN 1 END) as undefined_count,
        COUNT(CASE WHEN sku_match_status = 'no_match' THEN 1 END) as no_match_count,
        COUNT(CASE WHEN working = 'YES' THEN 1 END) as working_count,
        COUNT(CASE WHEN working = 'NO' THEN 1 END) as not_working_count,
        AVG(sku_match_score) as avg_match_score
      FROM sku_matching_view
      WHERE matched_sku = $1
      GROUP BY matched_sku, brand, model, capacity, color, carrier
    `;

    const summaryResult = await dbService.query(summaryQuery, [sku]);

    res.json({
      success: true,
      sku: sku,
      summary: summaryResult.rows[0],
      devices: result.rows
    });

  } catch (error) {
    logger.error('Error fetching SKU details:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch SKU details' });
  }
});

// Get hierarchical SKU inventory data (Model → Capacity → Carrier)
router.get('/hierarchical-data', async (req, res): Promise<void> => {
  try {
    const { brand, model, capacity, carrier } = req.query;
    
    // Build dynamic WHERE clause
    let whereConditions = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (brand && typeof brand === 'string') {
      whereConditions.push(`brand ILIKE $${paramIndex}`);
      params.push(`%${brand}%`);
      paramIndex++;
    }

    if (model && typeof model === 'string') {
      whereConditions.push(`model ILIKE $${paramIndex}`);
      params.push(`%${model}%`);
      paramIndex++;
    }

    if (capacity && typeof capacity === 'string') {
      whereConditions.push(`capacity ILIKE $${paramIndex}`);
      params.push(`%${capacity}%`);
      paramIndex++;
    }

    if (carrier && typeof carrier === 'string') {
      whereConditions.push(`carrier ILIKE $${paramIndex}`);
      params.push(`%${carrier}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Simple query that works - get basic counts first
    const query = `
      SELECT 
        p.brand,
        i.model,
        COUNT(*) as total_devices
      FROM product p
      INNER JOIN item i ON p.imei = i.imei
      GROUP BY p.brand, i.model
      ORDER BY p.brand, i.model
    `;

    const result = await dbService.query(query, []);

    // Get defective counts separately to avoid complex query issues
    const defectiveQuery = `
      SELECT 
        p.brand,
        i.model,
        COUNT(*) as defective_count
      FROM product p
      INNER JOIN item i ON p.imei = i.imei
      WHERE i.working = 'NO' OR i.working = 'FAILED'
      GROUP BY p.brand, i.model
    `;

    const defectiveResult = await dbService.query(defectiveQuery, []);
    
    // Create a map of defective counts
    const defectiveMap: any = {};
    defectiveResult.rows.forEach((row: any) => {
      const key = `${row.brand}-${row.model}`;
      defectiveMap[key] = parseInt(row.defective_count);
    });

    // Combine the data
    const modelData = result.rows.map((row: any) => {
      const key = `${row.brand}-${row.model}`;
      const totalDevices = parseInt(row.total_devices);
      const defectiveCount = defectiveMap[key] || 0;
      const defectiveRate = totalDevices > 0 ? Math.round((defectiveCount / totalDevices) * 100 * 10) / 10 : 0;
      
      return {
        brand: row.brand,
        model: row.model,
        total_devices: totalDevices,
        defective_count: defectiveCount,
        defective_rate: defectiveRate,
        capacities: [] // Will be populated by separate API calls
      };
    });

    // Calculate summary with real data
    const totalModels = modelData.length;
    const totalDevices = modelData.reduce((sum: number, model: any) => sum + model.total_devices, 0);
    const totalDefective = modelData.reduce((sum: number, model: any) => sum + model.defective_count, 0);
    const defectiveRate = totalDevices > 0 ? Math.round((totalDefective / totalDevices) * 100 * 10) / 10 : 0;

    res.json({
      success: true,
      data: modelData,
      summary: {
        total_models: totalModels,
        total_devices: totalDevices,
        total_defective: totalDefective,
        defective_rate: defectiveRate
      }
    });

  } catch (error) {
    logger.error('Error fetching hierarchical SKU data:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch hierarchical SKU data' });
  }
});

// Get all capacity breakdown data upfront
router.get('/all-capacity-breakdown', async (req, res): Promise<void> => {
  try {
    // Get all capacity breakdown data (simplified)
    const query = `
      SELECT 
        p.brand,
        i.model,
        i.capacity,
        i.color,
        i.carrier,
        i.matched_sku,
        COUNT(*) as device_count
      FROM product p
      INNER JOIN item i ON p.imei = i.imei
      GROUP BY p.brand, i.model, i.capacity, i.color, i.carrier, i.matched_sku
      ORDER BY p.brand, i.model, i.capacity, i.color, i.carrier
    `;
    const result = await dbService.query(query, []);
    
    // Group by brand-model-capacity-color (SKU without carrier)
    const breakdownData: any = {};
    
    result.rows.forEach((row: any) => {
      const modelKey = `${row.brand}-${row.model}`;
      const capacity = row.capacity || 'Unknown';
      const color = row.color || 'Unknown';
      
      // Create SKU key (without carrier)
      const skuKey = `${row.brand}-${row.model}-${capacity}-${color}`;
      
      if (!breakdownData[modelKey]) {
        breakdownData[modelKey] = {
          brand: row.brand,
          model: row.model,
          capacities: {}
        };
      }
      
      if (!breakdownData[modelKey].capacities[capacity]) {
        breakdownData[modelKey].capacities[capacity] = {
          capacity: capacity,
          skus: {}
        };
      }

      if (!breakdownData[modelKey].capacities[capacity].skus[skuKey]) {
        breakdownData[modelKey].capacities[capacity].skus[skuKey] = {
          sku: row.matched_sku || skuKey, // Use matched_sku if available, fallback to constructed key
          brand: row.brand,
          model: row.model,
          capacity: row.capacity,
          color: row.color,
          total_devices: 0,
          carriers: []
        };
      }

      // Add carrier details
      breakdownData[modelKey].capacities[capacity].skus[skuKey].carriers.push({
        carrier: row.carrier,
        device_count: parseInt(row.device_count),
        device_notes: 'Carrier UNLOCKED', // Simplified for now
        defective_count: 0, // Simplified for now
        defective_rate: 0 // Simplified for now
      });

      // Update SKU totals
      breakdownData[modelKey].capacities[capacity].skus[skuKey].total_devices += parseInt(row.device_count);
    });

    // Calculate rates for each capacity
    Object.values(breakdownData).forEach((model: any) => {
      Object.values(model.capacities).forEach((capacity: any) => {
        capacity.defective_rate = capacity.total_devices > 0 ? 
          Math.round((capacity.defective_count / capacity.total_devices) * 100 * 10) / 10 : 0;
      });
    });

    
    res.json({
      success: true,
      data: breakdownData
    });

  } catch (error) {
    logger.error('Error fetching all capacity breakdown:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch capacity breakdown data' });
  }
});

export default router;
