import { dbService } from './DatabaseConnectionService';
import { logger } from '../utils/logger';

export class BulkProcessingService {
  private static instance: BulkProcessingService;

  public static getInstance(): BulkProcessingService {
    if (!BulkProcessingService.instance) {
      BulkProcessingService.instance = new BulkProcessingService();
    }
    return BulkProcessingService.instance;
  }

  /**
   * Simulate bulk device processing for a scheduled operation
   */
  async processBulkOperation(scheduledOperationId: number): Promise<void> {
    const startTime = new Date();
    let executionId: number | undefined;

    try {
      // Get scheduled operation details
      const operationQuery = 'SELECT * FROM scheduled_bulk_operations WHERE id = $1';
      const operationResult = await dbService.query(operationQuery, [scheduledOperationId]);
      
      if (operationResult.rows.length === 0) {
        throw new Error('Scheduled operation not found');
      }

      const operation = operationResult.rows[0];

      // Create execution record
      const executionQuery = `
        INSERT INTO bulk_operation_executions 
        (scheduled_operation_id, execution_status)
        VALUES ($1, 'RUNNING')
        RETURNING id
      `;
      
      const executionResult = await dbService.query(executionQuery, [scheduledOperationId]);
      executionId = executionResult.rows[0].id;

      logger.info(`Starting bulk operation execution ${executionId} for station ${operation.station_id}`);

      // Simulate device processing
      const processingResult = await this.simulateDeviceProcessing(executionId!, operation);

      // Update execution with results
      const updateQuery = `
        UPDATE bulk_operation_executions 
        SET 
          execution_status = 'COMPLETED',
          execution_completed_at = CURRENT_TIMESTAMP,
          total_devices_processed = $2,
          devices_passed = $3,
          devices_failed = $4,
          devices_pending = $5,
          devices_added_to_db = $6,
          skus_added = $7,
          execution_duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - execution_started_at))::INTEGER
        WHERE id = $1
      `;

      await dbService.query(updateQuery, [
        executionId,
        processingResult.totalDevices,
        processingResult.devicesPassed,
        processingResult.devicesFailed,
        processingResult.devicesPending,
        processingResult.devicesAddedToDb,
        processingResult.skusAdded
      ]);

      // Store detailed SKU results
      await this.storeSkuResults(executionId!, processingResult.skuResults);

      logger.info(`Bulk operation execution ${executionId} completed successfully`);

    } catch (error) {
      logger.error(`Bulk operation execution failed:`, error);
      
      if (executionId !== undefined) {
        try {
          // Update execution with error
          const errorQuery = `
            UPDATE bulk_operation_executions 
            SET 
              execution_status = 'FAILED',
              execution_completed_at = CURRENT_TIMESTAMP,
              error_message = $2,
              execution_duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - execution_started_at))::INTEGER
            WHERE id = $1
          `;
          
          const errorMessage = error instanceof Error ? error.message : String(error);
          await dbService.query(errorQuery, [executionId, errorMessage]);
        } catch (updateError) {
          logger.error(`Failed to update execution error status:`, updateError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Simulate device processing with realistic results
   */
  private async simulateDeviceProcessing(executionId: number, operation: any): Promise<any> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

    // Generate realistic device data
    const brands = ['Apple', 'Samsung', 'Google', 'OnePlus', 'Motorola'];
    const models: Record<string, string[]> = {
      'Apple': ['iPhone 12', 'iPhone 13', 'iPhone 14', 'iPhone 15'],
      'Samsung': ['Galaxy S21', 'Galaxy S22', 'Galaxy S23', 'Galaxy A54'],
      'Google': ['Pixel 6', 'Pixel 7', 'Pixel 8', 'Pixel 7a'],
      'OnePlus': ['OnePlus 9', 'OnePlus 10', 'OnePlus 11'],
      'Motorola': ['Moto G Power', 'Moto G Stylus', 'Moto Edge']
    };
    
    const capacities = ['64GB', '128GB', '256GB', '512GB'];
    const colors = ['Black', 'White', 'Blue', 'Red', 'Green', 'Purple'];
    const carriers = ['Unlocked', 'Verizon', 'AT&T', 'T-Mobile', 'Sprint'];

    const totalDevices = Math.floor(Math.random() * 50) + 20; // 20-70 devices
    const skuResults: any[] = [];
    
    let devicesPassed = 0;
    let devicesFailed = 0;
    let devicesPending = 0;
    let devicesAddedToDb = 0;
    let skusAdded = 0;

    // Generate SKU groups
    const skuGroups = new Map<string, any>();

    for (let i = 0; i < totalDevices; i++) {
      const brand = brands[Math.floor(Math.random() * brands.length)];
      if (!brand) continue;
      
      const brandModels = models[brand];
      if (!brandModels || brandModels.length === 0) continue;
      
      const model = brandModels[Math.floor(Math.random() * brandModels.length)];
      const capacity = capacities[Math.floor(Math.random() * capacities.length)];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const carrier = carriers[Math.floor(Math.random() * carriers.length)];

      // Ensure all values are defined
      if (!model || !capacity || !color || !carrier) continue;

      // Create SKU key
      const skuKey = `${brand?.toUpperCase() || 'UNKNOWN'}-${model.replace(/\s+/g, '').toUpperCase()}-${capacity}-${color?.toUpperCase() || 'UNKNOWN'}-${carrier?.toUpperCase() || 'UNKNOWN'}`;
      
      // Determine device status (85% pass rate)
      const isWorking = Math.random() < 0.85;
      const status = isWorking ? 'PASS' : 'FAIL';
      
      if (isWorking) {
        devicesPassed++;
      } else {
        devicesFailed++;
      }

      // Add to SKU group
      if (!skuGroups.has(skuKey)) {
        skuGroups.set(skuKey, {
          sku_code: skuKey,
          brand: brand,
          model: model,
          capacity: capacity,
          color: color,
          carrier: carrier,
          device_count: 0,
          working_count: 0,
          failed_count: 0
        });
      }

      const skuGroup = skuGroups.get(skuKey);
      if (skuGroup) {
        skuGroup.device_count++;
        if (isWorking) {
          skuGroup.working_count++;
        } else {
          skuGroup.failed_count++;
        }
      }
    }

    // Convert to array
    skuResults.push(...skuGroups.values());
    
    devicesAddedToDb = totalDevices;
    skusAdded = skuResults.length;

    logger.info(`Simulated processing: ${totalDevices} devices, ${devicesPassed} passed, ${devicesFailed} failed, ${skusAdded} SKUs`);

    return {
      totalDevices,
      devicesPassed,
      devicesFailed,
      devicesPending,
      devicesAddedToDb,
      skusAdded,
      skuResults
    };
  }

  /**
   * Store detailed SKU results in the database
   */
  private async storeSkuResults(executionId: number, skuResults: any[]): Promise<void> {
    if (skuResults.length === 0) return;

    try {
      // Insert SKU results one by one to avoid parameter limit issues
      for (const sku of skuResults) {
        const query = `
          INSERT INTO bulk_operation_sku_results 
          (execution_id, sku_code, brand, model, capacity, color, carrier, device_count, working_count, failed_count)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `;

        await dbService.query(query, [
          executionId,
          sku.sku_code,
          sku.brand,
          sku.model,
          sku.capacity,
          sku.color,
          sku.carrier,
          sku.device_count,
          sku.working_count,
          sku.failed_count
        ]);
      }

      logger.info(`Stored ${skuResults.length} SKU results for execution ${executionId}`);
    } catch (error) {
      logger.error(`Error storing SKU results for execution ${executionId}:`, error);
      throw error;
    }
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(executionId: number): Promise<any> {
    const query = `
      SELECT 
        boe.*,
        sbo.station_id,
        sbo.location_inspection
      FROM bulk_operation_executions boe
      LEFT JOIN scheduled_bulk_operations sbo ON boe.scheduled_operation_id = sbo.id
      WHERE boe.id = $1
    `;

    const result = await dbService.query(query, [executionId]);
    return result.rows[0];
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(executionId: number): Promise<void> {
    const query = `
      UPDATE bulk_operation_executions 
      SET 
        execution_status = 'CANCELLED',
        execution_completed_at = CURRENT_TIMESTAMP,
        execution_duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - execution_started_at))::INTEGER
      WHERE id = $1 AND execution_status = 'RUNNING'
    `;

    const result = await dbService.query(query, [executionId]);
    
    if (result.rowCount === 0) {
      throw new Error('Execution not found or not running');
    }

    logger.info(`Cancelled execution ${executionId}`);
  }
}

export const bulkProcessingService = BulkProcessingService.getInstance();