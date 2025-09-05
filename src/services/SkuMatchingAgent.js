const { Client } = require('pg');
const CompleteSkuMatchingService = require('./CompleteSkuMatchingService');
require('dotenv').config();

/**
 * SkuMatchingAgent - Processes the SKU matching queue automatically
 * 
 * This agent:
 * 1. Polls the sku_matching_queue for pending entries
 * 2. Processes each IMEI using CompleteSkuMatchingService
 * 3. Updates queue status and results
 * 4. Handles errors and retries
 * 5. Can run continuously or process batches
 */
class SkuMatchingAgent {
    constructor(options = {}) {
        this.client = new Client({
            connectionString: process.env.DIRECT_URL
        });
        
        this.skuMatchingService = new CompleteSkuMatchingService();
        
        // Configuration
        this.batchSize = options.batchSize || 10;
        this.pollingInterval = options.pollingInterval || 5000; // 5 seconds
        this.maxRetries = options.maxRetries || 3;
        this.isRunning = false;
        this.processedCount = 0;
        this.errorCount = 0;
        
        // Statistics
        this.stats = {
            totalProcessed: 0,
            totalErrors: 0,
            totalSkipped: 0,
            startTime: null,
            lastProcessedAt: null
        };
    }

    /**
     * Initialize the agent and connect to database
     */
    async initialize() {
        try {
            console.log('🔌 Connecting to database...');
            await this.client.connect();
            console.log('✅ Database connected successfully');
            
            // Initialize the SKU matching service
            await this.skuMatchingService.initialize();
            console.log('✅ SKU matching service initialized');
            
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize SkuMatchingAgent:', error.message);
            throw error;
        }
    }

    /**
     * Process a single queue entry
     */
    async processQueueEntry(queueEntry) {
        const { id, imei, priority, source, source_reference } = queueEntry;
        
        try {
            console.log(`🔄 Processing IMEI: ${imei} (Priority: ${priority}, Source: ${source})`);
            
            // Mark as processing
            await this.updateQueueStatus(id, 'processing', {
                processing_started_at: new Date(),
                processing_attempts: queueEntry.processing_attempts + 1
            });
            
            // Get device data from sku_matching_view
            const deviceData = await this.getDeviceData(imei);
            if (!deviceData) {
                throw new Error(`Device data not found for IMEI: ${imei}`);
            }
            
            // Process with SKU matching service
            const matchResult = await this.skuMatchingService.matchImeiToSku(imei);
            
            if (matchResult.success) {
                // Update queue as completed
                await this.updateQueueStatus(id, 'completed', {
                    processing_completed_at: new Date(),
                    error_message: null,
                    error_details: null
                });
                
                console.log(`✅ Successfully processed IMEI: ${imei} - Matched SKU: ${matchResult.matchedSku}`);
                this.processedCount++;
                this.stats.totalProcessed++;
                this.stats.lastProcessedAt = new Date();
                
                return {
                    success: true,
                    imei,
                    matchedSku: matchResult.matchedSku,
                    matchScore: matchResult.matchScore,
                    requiresAttention: matchResult.requiresAttention
                };
            } else {
                throw new Error(matchResult.error || 'SKU matching failed');
            }
            
        } catch (error) {
            console.error(`❌ Error processing IMEI ${imei}:`, error.message);
            
            // Check if we should retry
            const shouldRetry = queueEntry.processing_attempts < this.maxRetries;
            const newStatus = shouldRetry ? 'pending' : 'failed';
            
            await this.updateQueueStatus(id, newStatus, {
                error_message: error.message,
                error_details: {
                    error_type: error.constructor.name,
                    stack: error.stack,
                    timestamp: new Date()
                },
                processing_attempts: queueEntry.processing_attempts + 1
            });
            
            this.errorCount++;
            this.stats.totalErrors++;
            
            if (shouldRetry) {
                console.log(`🔄 IMEI ${imei} will be retried (attempt ${queueEntry.processing_attempts + 1}/${this.maxRetries})`);
            } else {
                console.log(`💥 IMEI ${imei} failed after ${this.maxRetries} attempts`);
            }
            
            return {
                success: false,
                imei,
                error: error.message,
                willRetry: shouldRetry
            };
        }
    }

    /**
     * Get device data from sku_matching_view
     */
    async getDeviceData(imei) {
        const query = `
            SELECT 
                imei,
                original_sku,
                brand,
                model,
                carrier,
                capacity,
                color,
                device_notes
            FROM sku_matching_view 
            WHERE imei = $1
        `;
        
        const result = await this.client.query(query, [imei]);
        return result.rows[0] || null;
    }

    /**
     * Update queue entry status
     */
    async updateQueueStatus(id, status, updates = {}) {
        const updateFields = ['status = $2', 'updated_at = NOW()'];
        const values = [id, status];
        let paramIndex = 3;
        
        // Add dynamic update fields
        Object.entries(updates).forEach(([key, value]) => {
            updateFields.push(`${key} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
        });
        
        const query = `
            UPDATE sku_matching_queue 
            SET ${updateFields.join(', ')}
            WHERE id = $1
        `;
        
        await this.client.query(query, values);
    }

    /**
     * Get pending queue entries
     */
    async getPendingQueueEntries(limit = null) {
        const limitClause = limit ? `LIMIT ${limit}` : '';
        
        const query = `
            SELECT 
                id,
                imei,
                status,
                priority,
                source,
                source_reference,
                processing_attempts,
                max_attempts,
                created_at
            FROM sku_matching_queue 
            WHERE status = 'pending'
            ORDER BY priority ASC, created_at ASC
            ${limitClause}
        `;
        
        const result = await this.client.query(query);
        return result.rows;
    }

    /**
     * Process a batch of queue entries
     */
    async processBatch() {
        try {
            const pendingEntries = await this.getPendingQueueEntries(this.batchSize);
            
            if (pendingEntries.length === 0) {
                console.log('📭 No pending queue entries to process');
                return { processed: 0, errors: 0 };
            }
            
            console.log(`📦 Processing batch of ${pendingEntries.length} entries...`);
            
            const results = [];
            let processed = 0;
            let errors = 0;
            
            for (const entry of pendingEntries) {
                const result = await this.processQueueEntry(entry);
                results.push(result);
                
                if (result.success) {
                    processed++;
                } else {
                    errors++;
                }
                
                // Small delay between processing to avoid overwhelming the system
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            console.log(`✅ Batch completed: ${processed} successful, ${errors} errors`);
            return { processed, errors, results };
            
        } catch (error) {
            console.error('❌ Error processing batch:', error.message);
            throw error;
        }
    }

    /**
     * Start continuous processing
     */
    async start() {
        if (this.isRunning) {
            console.log('⚠️ Agent is already running');
            return;
        }
        
        console.log('🚀 Starting SkuMatchingAgent...');
        this.isRunning = true;
        this.stats.startTime = new Date();
        
        try {
            while (this.isRunning) {
                await this.processBatch();
                
                // Wait before next poll
                await new Promise(resolve => setTimeout(resolve, this.pollingInterval));
            }
        } catch (error) {
            console.error('❌ Agent stopped due to error:', error.message);
            this.isRunning = false;
            throw error;
        }
    }

    /**
     * Stop continuous processing
     */
    async stop() {
        console.log('🛑 Stopping SkuMatchingAgent...');
        this.isRunning = false;
    }

    /**
     * Get agent statistics
     */
    getStats() {
        const uptime = this.stats.startTime ? 
            Date.now() - this.stats.startTime.getTime() : 0;
        
        return {
            ...this.stats,
            uptime: uptime,
            uptimeFormatted: this.formatUptime(uptime),
            isRunning: this.isRunning,
            currentBatchSize: this.batchSize,
            pollingInterval: this.pollingInterval
        };
    }

    /**
     * Format uptime in human readable format
     */
    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        try {
            if (this.client) {
                await this.client.end();
                console.log('🔌 Database connection closed');
            }
        } catch (error) {
            console.error('❌ Error during cleanup:', error.message);
        }
    }
}

module.exports = SkuMatchingAgent;
