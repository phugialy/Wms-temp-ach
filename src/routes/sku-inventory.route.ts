import { Router } from 'express';
import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { dbService } from '../services/DatabaseConnectionService';
import { inventoryProcessor } from '../services/InventoryProcessorService';

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
        COUNT(CASE WHEN device_notes IS NULL OR device_notes NOT ILIKE '%FAIL%' THEN 1 END) as working_count,
        COUNT(CASE WHEN device_notes ILIKE '%FAIL%' THEN 1 END) as not_working_count,
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
        COUNT(CASE WHEN device_notes IS NULL OR device_notes NOT ILIKE '%FAIL%' THEN 1 END) as total_working,
        COUNT(CASE WHEN device_notes ILIKE '%FAIL%' THEN 1 END) as total_not_working
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
        location,
        sku_match_status as match_status,
        sku_match_score as match_score,
        sku_match_notes as match_notes,
        requires_attention,
        device_notes,
        match_processed_at,
        CASE
          WHEN device_notes IS NOT NULL AND device_notes != ''
          THEN carrier || ' (' || device_notes || ')'
          ELSE carrier
        END as carrier_with_notes,
        CASE
          WHEN device_notes IS NULL OR device_notes NOT ILIKE '%FAIL%' THEN 'Working'
          WHEN device_notes ILIKE '%FAIL%' THEN 'Failed'
          ELSE 'Unknown'
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
        COUNT(CASE WHEN device_notes IS NULL OR device_notes NOT ILIKE '%FAIL%' THEN 1 END) as working_count,
        COUNT(CASE WHEN device_notes ILIKE '%FAIL%' THEN 1 END) as not_working_count,
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

    // Use sku_matching_view to get clean SKU data with proper matching
    const query = `
      SELECT 
        brand,
        model,
        COUNT(*) as total_devices
      FROM sku_matching_view
      WHERE brand IS NOT NULL AND model IS NOT NULL
      ${whereClause ? 'AND ' + whereConditions.join(' AND ') : ''}
      GROUP BY brand, model
      ORDER BY brand, model
    `;

    const result = await dbService.query(query, params);

    // Get defective counts using the same view - exclude devices with FAILED notes
    const defectiveQuery = `
      SELECT 
        brand,
        model,
        COUNT(*) as defective_count
      FROM sku_matching_view
      WHERE (device_notes ILIKE '%FAIL%' OR device_notes ILIKE '%FAILED%')
      ${whereClause ? 'AND ' + whereConditions.join(' AND ').replace(/brand ILIKE/g, 'brand ILIKE').replace(/model ILIKE/g, 'model ILIKE').replace(/capacity ILIKE/g, 'capacity ILIKE').replace(/carrier ILIKE/g, 'carrier ILIKE') : ''}
      GROUP BY brand, model
    `;

    const defectiveResult = await dbService.query(defectiveQuery, params);
    
    // Create a map of defective counts
    const defectiveMap: any = {};
    defectiveResult.rows.forEach((row: any) => {
      const key = `${row.brand}-${row.model}`;
      defectiveMap[key] = parseInt(row.defective_count);
    });

    // Normalize model names to treat variations as the same (e.g., "PIXEL 7 DUAL" = "PIXEL 7")
    const normalizeModelName = (modelName: string): string => {
      if (!modelName) return modelName;
      let normalized = modelName.toUpperCase().trim();
      
      // Remove common variations that should be treated as the same model
      normalized = normalized.replace(/\s+DUAL\s*$/i, '');
      normalized = normalized.replace(/\s+/g, ' ');
      normalized = normalized.replace(/\s+$/, '').replace(/^\s+/, '');
      
      return normalized;
    };

    // Combine the data with model normalization
    const modelMap = new Map<string, any>();
    
    result.rows.forEach((row: any) => {
      const normalizedModel = normalizeModelName(row.model);
      const key = `${row.brand}-${normalizedModel}`;
      const originalKey = `${row.brand}-${row.model}`;
      
      const totalDevices = parseInt(row.total_devices);
      const defectiveCount = defectiveMap[originalKey] || 0;
      const defectiveRate = totalDevices > 0 ? Math.round((defectiveCount / totalDevices) * 100 * 10) / 10 : 0;
      
      if (modelMap.has(key)) {
        // Merge with existing normalized model
        const existing = modelMap.get(key);
        existing.total_devices += totalDevices;
        existing.defective_count += defectiveCount;
        existing.defective_rate = existing.total_devices > 0 ? 
          Math.round((existing.defective_count / existing.total_devices) * 100 * 10) / 10 : 0;
      } else {
        // Create new normalized model entry
        modelMap.set(key, {
          brand: row.brand,
          model: normalizedModel, // Use normalized model name
          total_devices: totalDevices,
          defective_count: defectiveCount,
          defective_rate: defectiveRate,
          capacities: [] // Will be populated by separate API calls
        });
      }
    });

    const modelData = Array.from(modelMap.values());

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

// Get all capacity breakdown data - using working approach with matched_sku
router.get('/all-capacity-breakdown', async (req, res): Promise<void> => {
  try {
    // Use the working query that was successful before, but try to get matched_sku
    const query = `
      SELECT 
        p.brand,
        i.model,
        i.capacity,
        i.color,
        i.carrier,
        COALESCE(smr.matched_sku, CONCAT(UPPER(p.brand), '-', UPPER(i.model), '-', COALESCE(i.capacity, ''), '-', COALESCE(i.color, ''))) as matched_sku,
        p.imei,
        i.working,
        CASE 
          WHEN LOWER(i.model) LIKE '%pixel 7%' AND LOWER(i.model) LIKE '%dual%' 
          THEN REPLACE(LOWER(i.model), ' dual', '')
          ELSE LOWER(i.model)
        END as normalized_model
      FROM product p
      INNER JOIN item i ON p.imei = i.imei
      LEFT JOIN sku_matching_results smr ON p.imei = smr.imei
      WHERE p.brand IS NOT NULL
        AND i.model IS NOT NULL
      ORDER BY p.brand, i.model, i.capacity, i.color, i.carrier
    `;
    
    const result = await dbService.query(query, []);
    
    // Process and group data with normalization
    const processedData: any = {};
    const deviceDetails: any = {}; // Store individual device details for differences
    
    result.rows.forEach((row: any) => {
      // Use normalized model for grouping (Pixel 7 Dual becomes Pixel 7)
      const normalizedModel = row.normalized_model || row.model.toLowerCase();
      const modelKey = `${row.brand.toLowerCase()}-${normalizedModel}`;
      const capacity = row.capacity || 'Unknown';
      const color = row.color || 'Unknown';
      const carrier = row.carrier || 'Unlocked';
      
      // Create SKU key using matched_sku
      const skuKey = row.matched_sku || `${row.brand.toUpperCase()}-${normalizedModel.toUpperCase()}-${capacity}-${color}`;
      
      // Initialize structure
      if (!processedData[modelKey]) {
        processedData[modelKey] = {
          brand: row.brand,
          model: normalizedModel,
          original_models: new Set(), // Track original model variations
          capacities: {}
        };
      }
      
      // Track original model variations
      processedData[modelKey].original_models.add(row.model);
      
      if (!processedData[modelKey].capacities[capacity]) {
        processedData[modelKey].capacities[capacity] = {
          capacity: capacity,
          skus: {}
        };
      }
      
      if (!processedData[modelKey].capacities[capacity].skus[skuKey]) {
        processedData[modelKey].capacities[capacity].skus[skuKey] = {
          sku: skuKey,
          brand: row.brand,
          model: normalizedModel,
          capacity: capacity,
          color: color,
          total_devices: 0,
          working_devices: 0,
          failed_devices: 0,
          carriers: [],
          device_details: [] // Store individual device info
        };
      }
      
      // Determine device status
      const isWorking = row.working === 'YES' || row.working === 'PASS' || 
        (!row.working || row.working.toLowerCase() !== 'no');
      
      // Store device details for differences view
      const deviceInfo = {
        imei: row.imei,
        original_model: row.model,
        carrier: carrier,
        device_notes: row.working || '',
        status: isWorking ? 'Working' : 'Failed',
        differences: [] // Will be populated when comparing
      };
      
      processedData[modelKey].capacities[capacity].skus[skuKey].device_details.push(deviceInfo);
      
      // Update counts
      processedData[modelKey].capacities[capacity].skus[skuKey].total_devices++;
      if (isWorking) {
        processedData[modelKey].capacities[capacity].skus[skuKey].working_devices++;
      } else {
        processedData[modelKey].capacities[capacity].skus[skuKey].failed_devices++;
      }
    });
    
    // Convert Sets to Arrays for JSON serialization
    Object.keys(processedData).forEach(modelKey => {
      processedData[modelKey].original_models = Array.from(processedData[modelKey].original_models);
    });
    
    const breakdownData = processedData;

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

// Manual refresh endpoint for inventory data
router.post('/refresh-inventory', async (req, res): Promise<void> => {
  try {
    logger.info('Manual inventory refresh requested');
    
    const refreshResult = await inventoryProcessor.refreshInventoryData();
    
    if (refreshResult.success) {
      res.json({
        success: true,
        message: refreshResult.message,
        processedCount: refreshResult.processedCount,
        lastRefreshTime: inventoryProcessor.getLastRefreshTime()
      });
    } else {
      res.status(500).json({
        success: false,
        error: refreshResult.message
      });
    }

  } catch (error) {
    logger.error('Error refreshing inventory:', error);
    res.status(500).json({ success: false, error: 'Failed to refresh inventory data' });
  }
});

// Get inventory refresh status
router.get('/inventory-status', async (req, res): Promise<void> => {
  try {
    const lastRefreshTime = inventoryProcessor.getLastRefreshTime();
    const isProcessing = inventoryProcessor.isCurrentlyProcessing();
    const needsRefresh = await inventoryProcessor.needsRefresh(30);

    res.json({
      success: true,
      data: {
        lastRefreshTime,
        isProcessing,
        needsRefresh,
        status: isProcessing ? 'processing' : needsRefresh ? 'stale' : 'fresh'
      }
    });

  } catch (error) {
    logger.error('Error getting inventory status:', error);
    res.status(500).json({ success: false, error: 'Failed to get inventory status' });
  }
});

// Get device differences for a specific SKU
router.get('/sku-differences/:sku', async (req, res): Promise<void> => {
  try {
    const { sku } = req.params;
    
    const query = `
      SELECT 
        p.imei,
        i.model as original_model,
        i.capacity,
        i.color,
        i.carrier,
        i.working as device_notes,
        COALESCE(smr.matched_sku, CONCAT(UPPER(p.brand), '-', UPPER(i.model), '-', COALESCE(i.capacity, ''), '-', COALESCE(i.color, ''))) as sku_matched,
        CASE 
          WHEN i.working = 'YES' OR i.working = 'PASS'
          THEN 'Working'
          ELSE 'Failed'
        END as status
      FROM product p
      INNER JOIN item i ON p.imei = i.imei
      LEFT JOIN sku_matching_results smr ON p.imei = smr.imei
      WHERE COALESCE(smr.matched_sku, CONCAT(UPPER(p.brand), '-', UPPER(i.model), '-', COALESCE(i.capacity, ''), '-', COALESCE(i.color, ''))) = $1
      ORDER BY p.imei
    `;
    
    const result = await dbService.query(query, [sku]);
    
    // Analyze differences between devices
    const devices = result.rows;
    const differences = [];
    
    if (devices.length > 1) {
      // Compare each device with others to find differences
      for (let i = 0; i < devices.length; i++) {
        for (let j = i + 1; j < devices.length; j++) {
          const device1 = devices[i];
          const device2 = devices[j];
          const deviceDifferences = [];
          
          // Compare each field
          if (device1.original_model !== device2.original_model) {
            deviceDifferences.push({
              field: 'Model',
              device1: device1.original_model,
              device2: device2.original_model
            });
          }
          
          if (device1.capacity !== device2.capacity) {
            deviceDifferences.push({
              field: 'Capacity',
              device1: device1.capacity,
              device2: device2.capacity
            });
          }
          
          if (device1.color !== device2.color) {
            deviceDifferences.push({
              field: 'Color',
              device1: device1.color,
              device2: device2.color
            });
          }
          
          if (device1.carrier !== device2.carrier) {
            deviceDifferences.push({
              field: 'Carrier',
              device1: device1.carrier,
              device2: device2.carrier
            });
          }
          
          if (device1.status !== device2.status) {
            deviceDifferences.push({
              field: 'Status',
              device1: device1.status,
              device2: device2.status
            });
          }
          
          if (deviceDifferences.length > 0) {
            differences.push({
              device1_imei: device1.imei,
              device2_imei: device2.imei,
              differences: deviceDifferences
            });
          }
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        sku: sku,
        device_count: devices.length,
        devices: devices,
        differences: differences,
        summary: {
          working_count: devices.filter((d: any) => d.status === 'Working').length,
          failed_count: devices.filter((d: any) => d.status === 'Failed').length,
          unique_models: [...new Set(devices.map((d: any) => d.original_model))],
          unique_carriers: [...new Set(devices.map((d: any) => d.carrier))],
          unique_colors: [...new Set(devices.map((d: any) => d.color))]
        }
      }
    });
    
  } catch (error) {
    logger.error('Error fetching SKU differences:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch SKU differences' });
  }
});

export default router;
