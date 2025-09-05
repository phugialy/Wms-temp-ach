import { Client } from 'pg';
const { CompleteSkuMatchingService } = require('./CompleteSkuMatchingService');

/**
 * OperatorService - Handles different operator workflows
 * 
 * Roles:
 * - SHIPPING: Quick pickup, update location to SHIPOUT
 * - POSTFIX: Grade items and update SKU with postfix
 * - REPAIR: Update location and repair notes
 * - INSPECTOR: Update device characteristics and notes
 */
export class OperatorService {
    private client: Client;
    private availableLocations: string[];
    private postfixOptions: Record<string, { grade: string; condition: string; postfix: string }>;

    constructor() {
        this.client = new Client({
            connectionString: process.env['DIRECT_URL']
        });
        
        // Available locations from your system
        this.availableLocations = [
            'DNCL-Inspection',
            'DNCL-Testing', 
            'DNCL-Storage',
            'DNCL-Warehouse-A',
            'DNCL-Warehouse-B',
            'DNCL-Processing',
            'DNCL-QC',
            'DNCL-Shipping',
            'SHIPOUT',  // Special location for shipping
            'REPAIR-BAY' // Special location for repair
        ];
        
        // Postfix options for grading
        this.postfixOptions = {
            'A': { grade: 'A', condition: 'NO RETAIL BOX', postfix: '' },
            'A+BOX': { grade: 'A', condition: 'HAS RETAIL BOX', postfix: '-UL' },
            'B': { grade: 'B', condition: 'Grade B', postfix: '-VG' },
            'C': { grade: 'C', condition: 'Grade C', postfix: '-ACCEPTABLE' },
            'NEW': { grade: 'NEW', condition: 'New Sealed', postfix: '-NEW' }
        };
    }

    /**
     * Initialize the service
     */
    async initialize(): Promise<boolean> {
        try {
            await this.client.connect();
            console.log('✅ OperatorService connected to database');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize OperatorService:', error);
            throw error;
        }
    }

    /**
     * Get device information by IMEI
     */
    async getDeviceInfo(imei: string): Promise<any> {
        const query = `
            SELECT 
                p.imei,
                p.sku as original_sku,
                p.brand,
                i.model,
                i.carrier,
                i.capacity,
                i.color,
                i.working,
                i.location,
                dt.notes as device_notes,
                smr.matched_sku,
                smr.match_score,
                smr.requires_attention
            FROM product p
            LEFT JOIN item i ON p.imei = i.imei
            LEFT JOIN device_test dt ON p.imei = dt.imei
            LEFT JOIN sku_matching_results smr ON p.imei = smr.imei
            WHERE p.imei = $1
        `;
        
        const result = await this.client.query(query, [imei]);
        return result.rows[0] || null;
    }

    /**
     * SHIPPING OPERATOR: Quick pickup - update location to SHIPOUT
     */
    async shippingQuickPickup(imei: string, operatorName: string = 'SHIPPING-OP'): Promise<any> {
        try {
            console.log(`🚚 Shipping pickup: IMEI ${imei}`);
            
            // Get current device info
            const device = await this.getDeviceInfo(imei);
            if (!device) {
                throw new Error(`Device not found: ${imei}`);
            }
            
            const oldLocation = device.location || 'Unknown';
            
            // Update location to SHIPOUT
            await this.updateDeviceLocation(imei, 'SHIPOUT', operatorName, 'SHIPPING_PICKUP');
            
            // Log the action
            await this.logOperatorAction(imei, 'SHIPPING', 'QUICK_PICKUP', {
                old_location: oldLocation,
                new_location: 'SHIPOUT',
                matched_sku: device.matched_sku,
                operator: operatorName
            });
            
            return {
                success: true,
                imei,
                action: 'SHIPPING_PICKUP',
                oldLocation,
                newLocation: 'SHIPOUT',
                matchedSku: device.matched_sku,
                message: `Device ${imei} moved to SHIPOUT`
            };
            
        } catch (error) {
            console.error(`❌ Shipping pickup failed for ${imei}:`, error);
            throw error;
        }
    }

    /**
     * POSTFIX OPERATOR: Grade item and update SKU with postfix
     */
    async postfixUpdate(imei: string, grade: string, operatorName: string = 'POSTFIX-OP'): Promise<any> {
        try {
            console.log(`🏷️ Postfix update: IMEI ${imei}, Grade: ${grade}`);
            
            // Get current device info
            const device = await this.getDeviceInfo(imei);
            if (!device) {
                throw new Error(`Device not found: ${imei}`);
            }
            
            const postfixConfig = this.postfixOptions[grade];
            if (!postfixConfig) {
                throw new Error(`Invalid grade: ${grade}. Valid options: ${Object.keys(this.postfixOptions).join(', ')}`);
            }
            
            const oldSku = device.matched_sku || device.original_sku;
            const newSku = oldSku + postfixConfig.postfix;
            
            // Update SKU in product table
            await this.client.query(
                'UPDATE product SET sku = $1, updated_at = NOW() WHERE imei = $2',
                [newSku, imei]
            );
            
            // Update SKU matching results
            await this.client.query(`
                UPDATE sku_matching_results 
                SET matched_sku = $1, match_notes = $2, updated_at = NOW()
                WHERE imei = $3
            `, [newSku, `Postfix updated: ${grade} (${postfixConfig.condition})`, imei]);
            
            // Log the action
            await this.logOperatorAction(imei, 'POSTFIX', 'GRADE_UPDATE', {
                old_sku: oldSku,
                new_sku: newSku,
                grade: postfixConfig.grade,
                condition: postfixConfig.condition,
                postfix: postfixConfig.postfix,
                operator: operatorName
            });
            
            return {
                success: true,
                imei,
                action: 'POSTFIX_UPDATE',
                oldSku,
                newSku,
                grade: postfixConfig.grade,
                condition: postfixConfig.condition,
                message: `Device ${imei} graded as ${grade}: ${newSku}`
            };
            
        } catch (error) {
            console.error(`❌ Postfix update failed for ${imei}:`, error);
            throw error;
        }
    }

    /**
     * REPAIR OPERATOR: Update location and repair notes
     */
    async repairUpdate(imei: string, newLocation: string, repairNotes: string, operatorName: string = 'REPAIR-OP'): Promise<any> {
        try {
            console.log(`🔧 Repair update: IMEI ${imei}, Location: ${newLocation}`);
            
            // Get current device info
            const device = await this.getDeviceInfo(imei);
            if (!device) {
                throw new Error(`Device not found: ${imei}`);
            }
            
            const oldLocation = device.location || 'Unknown';
            
            // Update location
            await this.updateDeviceLocation(imei, newLocation, operatorName, 'REPAIR_UPDATE');
            
            // Update repair notes in device_test
            if (repairNotes) {
                const currentNotes = device.device_notes || '';
                const updatedNotes = currentNotes ? `${currentNotes}; REPAIR: ${repairNotes}` : `REPAIR: ${repairNotes}`;
                
                await this.client.query(`
                    UPDATE device_test 
                    SET notes = $1
                    WHERE imei = $2
                `, [updatedNotes, imei]);
            }
            
            // Log the action
            await this.logOperatorAction(imei, 'REPAIR', 'LOCATION_UPDATE', {
                old_location: oldLocation,
                new_location: newLocation,
                repair_notes: repairNotes,
                operator: operatorName
            });
            
            return {
                success: true,
                imei,
                action: 'REPAIR_UPDATE',
                oldLocation,
                newLocation,
                repairNotes,
                message: `Device ${imei} moved to ${newLocation} for repair`
            };
            
        } catch (error) {
            console.error(`❌ Repair update failed for ${imei}:`, error);
            throw error;
        }
    }

    /**
     * INSPECTOR OPERATOR: Update device characteristics and notes
     */
    async inspectorUpdate(imei: string, updates: any, operatorName: string = 'INSPECTOR-OP'): Promise<any> {
        try {
            console.log(`🔍 Inspector update: IMEI ${imei}`);
            
            // Get current device info
            const device = await this.getDeviceInfo(imei);
            if (!device) {
                throw new Error(`Device not found: ${imei}`);
            }
            
            const changes: any = {};
            
            // Update device notes
            if (updates.deviceNotes) {
                const currentNotes = device.device_notes || '';
                const updatedNotes = currentNotes ? `${currentNotes}; INSPECTION: ${updates.deviceNotes}` : `INSPECTION: ${updates.deviceNotes}`;
                
                await this.client.query(`
                    UPDATE device_test 
                    SET notes = $1
                    WHERE imei = $2
                `, [updatedNotes, imei]);
                
                changes.device_notes = updates.deviceNotes;
            }
            
            // Update working status
            if (updates.workingStatus) {
                await this.client.query(`
                    UPDATE item 
                    SET working = $1, updated_at = NOW()
                    WHERE imei = $2
                `, [updates.workingStatus, imei]);
                
                changes.working_status = updates.workingStatus;
            }
            
            // Update battery health (if provided)
            if (updates.batteryHealth) {
                await this.client.query(`
                    UPDATE item 
                    SET battery_health = $1, updated_at = NOW()
                    WHERE imei = $2
                `, [updates.batteryHealth, imei]);
                
                changes.battery_health = updates.batteryHealth;
            }
            
            // Log the action
            await this.logOperatorAction(imei, 'INSPECTOR', 'CHARACTERISTICS_UPDATE', {
                changes,
                operator: operatorName
            });
            
            return {
                success: true,
                imei,
                action: 'INSPECTOR_UPDATE',
                changes,
                message: `Device ${imei} characteristics updated`
            };
            
        } catch (error) {
            console.error(`❌ Inspector update failed for ${imei}:`, error);
            throw error;
        }
    }

    /**
     * Update device location
     */
    private async updateDeviceLocation(imei: string, newLocation: string, operatorName: string, reason: string): Promise<void> {
        // Get current location first
        const currentLocationResult = await this.client.query(`
            SELECT location FROM item WHERE imei = $1
        `, [imei]);
        
        const currentLocation = currentLocationResult.rows[0]?.location || 'Unknown';
        
        // Update item table
        await this.client.query(`
            UPDATE item 
            SET location = $1, updated_at = NOW()
            WHERE imei = $2
        `, [newLocation, imei]);
        
        // Add to movement history
        await this.client.query(`
            INSERT INTO movement_history (imei, location_original, location_updated, movement_date)
            VALUES ($1, $2, $3, NOW())
        `, [imei, currentLocation, newLocation]);
    }

    /**
     * Log operator actions
     */
    private async logOperatorAction(imei: string, role: string, actionType: string, details: any): Promise<void> {
        await this.client.query(`
            INSERT INTO operator_actions (imei, operator_role, action_type, new_value, created_at)
            VALUES ($1, $2, $3, $4, NOW())
        `, [imei, role, actionType, JSON.stringify(details)]);
    }

    /**
     * Get available locations
     */
    getAvailableLocations(): string[] {
        return this.availableLocations;
    }

    /**
     * Get postfix options
     */
    getPostfixOptions(): Record<string, { grade: string; condition: string; postfix: string }> {
        return this.postfixOptions;
    }

    /**
     * Get recent operator actions
     */
    async getRecentActions(limit: number = 10): Promise<any[]> {
        const query = `
            SELECT 
                imei,
                operator_role,
                action_type,
                new_value,
                created_at
            FROM operator_actions
            ORDER BY created_at DESC
            LIMIT $1
        `;
        
        const result = await this.client.query(query, [limit]);
        return result.rows;
    }

    /**
     * Clean up resources
     */
    async cleanup(): Promise<void> {
        try {
            if (this.client) {
                await this.client.end();
                console.log('🔌 OperatorService connection closed');
            }
        } catch (error) {
            console.error('❌ Error during cleanup:', error);
        }
    }
}

export default OperatorService;
