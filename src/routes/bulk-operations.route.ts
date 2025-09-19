import { Router } from 'express';
import { logger } from '../utils/logger';
import { dbService } from '../services/DatabaseConnectionService';
import { bulkProcessingService } from '../services/BulkProcessingService';

const router = Router();

// Create tables endpoint for initial setup
router.post('/setup-tables', async (req, res): Promise<void> => {
  try {
    // Create scheduled_bulk_operations table
    const createScheduledTable = `
      CREATE TABLE IF NOT EXISTS scheduled_bulk_operations (
        id SERIAL PRIMARY KEY,
        station_id VARCHAR(50) NOT NULL,
        location_inspection VARCHAR(100) NOT NULL,
        operation_type VARCHAR(50) NOT NULL DEFAULT 'BULK_ADD',
        schedule_date DATE NOT NULL DEFAULT CURRENT_DATE,
        schedule_time TIME NOT NULL,
        schedule_type VARCHAR(20) DEFAULT 'once',
        is_active BOOLEAN DEFAULT true,
        is_modified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(100),
        notes TEXT
      );
    `;

    // Create bulk_operation_executions table
    const createExecutionsTable = `
      CREATE TABLE IF NOT EXISTS bulk_operation_executions (
        id SERIAL PRIMARY KEY,
        scheduled_operation_id INTEGER REFERENCES scheduled_bulk_operations(id),
        execution_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        execution_completed_at TIMESTAMP,
        execution_status VARCHAR(20) DEFAULT 'RUNNING',
        total_devices_processed INTEGER DEFAULT 0,
        devices_passed INTEGER DEFAULT 0,
        devices_failed INTEGER DEFAULT 0,
        devices_pending INTEGER DEFAULT 0,
        devices_added_to_db INTEGER DEFAULT 0,
        skus_added INTEGER DEFAULT 0,
        execution_duration_seconds INTEGER,
        error_message TEXT
      );
    `;

    // Create bulk_operation_sku_results table
    const createSkuResultsTable = `
      CREATE TABLE IF NOT EXISTS bulk_operation_sku_results (
        id SERIAL PRIMARY KEY,
        execution_id INTEGER REFERENCES bulk_operation_executions(id),
        sku_code VARCHAR(100) NOT NULL,
        brand VARCHAR(50),
        model VARCHAR(100),
        capacity VARCHAR(20),
        color VARCHAR(30),
        carrier VARCHAR(50),
        device_count INTEGER DEFAULT 0,
        working_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0
      );
    `;

    await dbService.query(createScheduledTable, []);
    await dbService.query(createExecutionsTable, []);
    await dbService.query(createSkuResultsTable, []);

    // Insert sample data if table is empty
    const checkData = await dbService.query('SELECT COUNT(*) as count FROM scheduled_bulk_operations', []);
    if (checkData.rows[0].count === '0') {
      const insertSample = `
        INSERT INTO scheduled_bulk_operations (station_id, location_inspection, schedule_date, schedule_time, created_by, notes)
        VALUES 
          ('dncltz1', 'MAIN_INSPECTION_AREA', CURRENT_DATE, '09:00:00', 'Manager', 'Daily morning bulk processing'),
          ('dncltz2', 'QUALITY_CONTROL', CURRENT_DATE, '14:00:00', 'Manager', 'Afternoon quality check'),
          ('dncltz3', 'RETURNS_PROCESSING', CURRENT_DATE, '16:30:00', 'Manager', 'End of day returns processing')
        ON CONFLICT DO NOTHING;
      `;
      await dbService.query(insertSample, []);
    }

    res.json({
      success: true,
      message: 'Bulk operations tables created successfully',
      tables_created: [
        'scheduled_bulk_operations',
        'bulk_operation_executions', 
        'bulk_operation_sku_results'
      ]
    });

  } catch (error) {
    console.error('Error creating bulk operations tables:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create tables',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get all scheduled operations
router.get('/scheduled', async (req, res): Promise<void> => {
  try {
    const query = `
      SELECT 
        id, station_id, location_inspection, operation_type,
        schedule_date, schedule_time, schedule_type, is_active, is_modified,
        created_at, updated_at, created_by, notes
      FROM scheduled_bulk_operations
      ORDER BY schedule_date, schedule_time
    `;
    
    const result = await dbService.query(query, []);
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    logger.error('Error fetching scheduled operations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch scheduled operations' });
  }
});

// Create new scheduled operation
router.post('/scheduled', async (req, res): Promise<void> => {
  try {
    const {
      station_id,
      location_inspection,
      operation_type = 'BULK_ADD',
      schedule_date,
      schedule_time,
      schedule_type = 'once',
      notes,
      created_by = 'Manager'
    } = req.body;
    
    const query = `
      INSERT INTO scheduled_bulk_operations 
      (station_id, location_inspection, operation_type, schedule_date, schedule_time, schedule_type, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const result = await dbService.query(query, [
      station_id, location_inspection, operation_type, schedule_date, schedule_time, schedule_type, notes, created_by
    ]);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    logger.error('Error creating scheduled operation:', error);
    res.status(500).json({ success: false, error: 'Failed to create scheduled operation' });
  }
});

// Update scheduled operation
router.put('/scheduled/:id', async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      station_id,
      location_inspection,
      schedule_date,
      schedule_time,
      is_active,
      notes
    } = req.body;
    
    const query = `
      UPDATE scheduled_bulk_operations 
      SET 
        station_id = COALESCE($2, station_id),
        location_inspection = COALESCE($3, location_inspection),
        schedule_date = COALESCE($4, schedule_date),
        schedule_time = COALESCE($5, schedule_time),
        is_active = COALESCE($6, is_active),
        notes = COALESCE($7, notes),
        is_modified = true,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await dbService.query(query, [
      id, station_id, location_inspection, schedule_date, schedule_time, is_active, notes
    ]);
    
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Scheduled operation not found' });
      return;
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    logger.error('Error updating scheduled operation:', error);
    res.status(500).json({ success: false, error: 'Failed to update scheduled operation' });
  }
});

// Delete scheduled operation
router.delete('/scheduled/:id', async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    
    const query = 'DELETE FROM scheduled_bulk_operations WHERE id = $1';
    const result = await dbService.query(query, [id]);
    
    res.json({
      success: true,
      message: 'Scheduled operation deleted successfully'
    });
    
  } catch (error) {
    logger.error('Error deleting scheduled operation:', error);
    res.status(500).json({ success: false, error: 'Failed to delete scheduled operation' });
  }
});

// Get execution history
router.get('/executions', async (req, res): Promise<void> => {
  try {
    const query = `
      SELECT 
        boe.id,
        boe.scheduled_operation_id,
        sbo.station_id,
        sbo.location_inspection,
        boe.execution_started_at,
        boe.execution_completed_at,
        boe.execution_status,
        boe.total_devices_processed,
        boe.devices_passed,
        boe.devices_failed,
        boe.devices_pending,
        boe.devices_added_to_db,
        boe.skus_added,
        boe.execution_duration_seconds,
        boe.error_message
      FROM bulk_operation_executions boe
      LEFT JOIN scheduled_bulk_operations sbo ON boe.scheduled_operation_id = sbo.id
      ORDER BY boe.execution_started_at DESC
      LIMIT 50
    `;
    
    const result = await dbService.query(query, []);
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    logger.error('Error fetching execution history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch execution history' });
  }
});

// Get execution results (SKU breakdown)
router.get('/executions/:id/results', async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        sku_code, brand, model, capacity, color, carrier,
        device_count, working_count, failed_count
      FROM bulk_operation_sku_results
      WHERE execution_id = $1
      ORDER BY brand, model, capacity, color, carrier
    `;
    
    const result = await dbService.query(query, [id]);
    
    // Group results by brand-model for better visualization
    const groupedResults: any = {};
    
    result.rows.forEach((row: any) => {
      const modelKey = `${row.brand}-${row.model}`;
      
      if (!groupedResults[modelKey]) {
        groupedResults[modelKey] = {
          brand: row.brand,
          model: row.model,
          total_devices: 0,
          total_working: 0,
          total_failed: 0,
          skus: []
        };
      }
      
      groupedResults[modelKey].skus.push({
        sku: row.sku_code,
        capacity: row.capacity,
        color: row.color,
        carrier: row.carrier,
        device_count: row.device_count,
        working_count: row.working_count,
        failed_count: row.failed_count
      });
      
      groupedResults[modelKey].total_devices += row.device_count;
      groupedResults[modelKey].total_working += row.working_count;
      groupedResults[modelKey].total_failed += row.failed_count;
    });
    
    res.json({
      success: true,
      data: {
        execution_id: id,
        results: Object.values(groupedResults)
      }
    });
    
  } catch (error) {
    logger.error('Error fetching execution results:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch execution results' });
  }
});

// Start bulk operation manually
router.post('/execute/:id', async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Start bulk processing asynchronously
    bulkProcessingService.processBulkOperation(parseInt(id))
      .then(() => {
        logger.info(`Bulk operation ${id} completed successfully`);
      })
      .catch((error) => {
        logger.error(`Bulk operation ${id} failed:`, error);
      });
    
    res.json({
      success: true,
      data: {
        scheduled_operation_id: id,
        message: 'Bulk operation started successfully. Check execution history for progress.'
      }
    });
    
  } catch (error) {
    logger.error('Error starting bulk operation:', error);
    res.status(500).json({ success: false, error: 'Failed to start bulk operation' });
  }
});

// Get stations list
router.get('/stations', async (req, res): Promise<void> => {
  try {
    const stations = [
      { id: 'dncltz1', name: 'DNCL Station 1 - Main Processing' },
      { id: 'dncltz2', name: 'DNCL Station 2 - Quality Control' },
      { id: 'dncltz3', name: 'DNCL Station 3 - Returns Processing' },
      { id: 'dncltz4', name: 'DNCL Station 4 - Inspection Area' },
      { id: 'dncltz5', name: 'DNCL Station 5 - Testing Lab' },
      { id: 'dncltz6', name: 'DNCL Station 6 - Repair Center' },
      { id: 'dncltz7', name: 'DNCL Station 7 - Packaging' },
      { id: 'dncltz8', name: 'DNCL Station 8 - Shipping' },
      { id: 'dncltz9', name: 'DNCL Station 9 - Storage' },
      { id: 'dncltz10', name: 'DNCL Station 10 - Admin' }
    ];
    
    res.json({
      success: true,
      data: stations
    });
    
  } catch (error) {
    logger.error('Error fetching stations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stations' });
  }
});

// Get locations list
router.get('/locations', async (req, res): Promise<void> => {
  try {
    const locations = [
      { id: 'MAIN_INSPECTION_AREA', name: 'Main Inspection Area' },
      { id: 'QUALITY_CONTROL', name: 'Quality Control' },
      { id: 'RETURNS_PROCESSING', name: 'Returns Processing' },
      { id: 'TESTING_LAB', name: 'Testing Laboratory' },
      { id: 'STORAGE_AREA', name: 'Storage Area' },
      { id: 'SHIPPING_DOCK', name: 'Shipping Dock' }
    ];
    
    res.json({
      success: true,
      data: locations
    });
    
  } catch (error) {
    logger.error('Error fetching locations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch locations' });
  }
});

export default router;
