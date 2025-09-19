import { dbService } from './DatabaseConnectionService';
import { logger } from '../utils/logger';

export class InventoryProcessorService {
    private static instance: InventoryProcessorService;
    private isProcessing = false;
    private lastRefreshTime: Date | null = null;

    public static getInstance(): InventoryProcessorService {
        if (!InventoryProcessorService.instance) {
            InventoryProcessorService.instance = new InventoryProcessorService();
        }
        return InventoryProcessorService.instance;
    }

    /**
     * Refresh the inventory aggregated table with latest data
     */
    public async refreshInventoryData(): Promise<{
        success: boolean;
        processedCount: number;
        message: string;
    }> {
        if (this.isProcessing) {
            return {
                success: false,
                processedCount: 0,
                message: 'Inventory refresh already in progress'
            };
        }

        try {
            this.isProcessing = true;
            logger.info('Starting inventory data refresh...');

            // Call the database function to refresh inventory data
            const result = await dbService.query('SELECT refresh_inventory_data() as processed_count', []);
            const processedCount = result.rows[0]?.processed_count || 0;

            this.lastRefreshTime = new Date();
            
            logger.info(`Inventory data refresh completed. Processed ${processedCount} records.`);
            
            return {
                success: true,
                processedCount,
                message: `Successfully refreshed ${processedCount} inventory records`
            };

        } catch (error) {
            logger.error('Error refreshing inventory data:', error);
            return {
                success: false,
                processedCount: 0,
                message: `Failed to refresh inventory data: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Get inventory summary statistics
     */
    public async getInventorySummary(): Promise<{
        success: boolean;
        data: any;
        message: string;
    }> {
        try {
            const result = await dbService.query('SELECT * FROM inventory_summary', []);
            
            return {
                success: true,
                data: result.rows,
                message: 'Inventory summary retrieved successfully'
            };

        } catch (error) {
            logger.error('Error getting inventory summary:', error);
            return {
                success: false,
                data: null,
                message: `Failed to get inventory summary: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Get detailed inventory data with filtering
     */
    public async getInventoryData(filters: {
        brand?: string;
        model?: string;
        capacity?: string;
        color?: string;
        carrier?: string;
    } = {}): Promise<{
        success: boolean;
        data: any;
        message: string;
    }> {
        try {
            let query = `
                SELECT 
                    brand, model, capacity, color, carrier, sku_code,
                    device_count, working_count, failed_count,
                    last_updated
                FROM inventory_aggregated
            `;
            
            const conditions: string[] = [];
            const params: any[] = [];
            let paramIndex = 1;

            if (filters.brand) {
                conditions.push(`brand ILIKE $${paramIndex}`);
                params.push(`%${filters.brand}%`);
                paramIndex++;
            }

            if (filters.model) {
                conditions.push(`model ILIKE $${paramIndex}`);
                params.push(`%${filters.model}%`);
                paramIndex++;
            }

            if (filters.capacity) {
                conditions.push(`capacity ILIKE $${paramIndex}`);
                params.push(`%${filters.capacity}%`);
                paramIndex++;
            }

            if (filters.color) {
                conditions.push(`color ILIKE $${paramIndex}`);
                params.push(`%${filters.color}%`);
                paramIndex++;
            }

            if (filters.carrier) {
                conditions.push(`carrier ILIKE $${paramIndex}`);
                params.push(`%${filters.carrier}%`);
                paramIndex++;
            }

            if (conditions.length > 0) {
                query += ` WHERE ${conditions.join(' AND ')}`;
            }

            query += ` ORDER BY brand, model, capacity, color, carrier`;

            const result = await dbService.query(query, params);
            
            return {
                success: true,
                data: result.rows,
                message: 'Inventory data retrieved successfully'
            };

        } catch (error) {
            logger.error('Error getting inventory data:', error);
            return {
                success: false,
                data: null,
                message: `Failed to get inventory data: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Check if inventory data needs refresh (older than specified minutes)
     */
    public async needsRefresh(maxAgeMinutes: number = 30): Promise<boolean> {
        try {
            if (!this.lastRefreshTime) {
                return true;
            }

            const now = new Date();
            const ageMinutes = (now.getTime() - this.lastRefreshTime.getTime()) / (1000 * 60);
            
            return ageMinutes > maxAgeMinutes;
        } catch (error) {
            logger.error('Error checking refresh status:', error);
            return true; // Default to needing refresh on error
        }
    }

    /**
     * Get last refresh time
     */
    public getLastRefreshTime(): Date | null {
        return this.lastRefreshTime;
    }

    /**
     * Check if currently processing
     */
    public isCurrentlyProcessing(): boolean {
        return this.isProcessing;
    }
}

export const inventoryProcessor = InventoryProcessorService.getInstance();
