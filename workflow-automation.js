
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

class WorkflowAutomation {
  constructor() {
    this.isRunning = false;
  }
  
  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🔄 Starting workflow automation...');
    
    // Check every 10 seconds for new bulk-add items
    this.interval = setInterval(async () => {
      await this.checkForBulkAddItems();
    }, 10000);
  }
  
  async stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('⏹️  Workflow automation stopped');
  }
  
  async checkForBulkAddItems() {
    const client = await pool.connect();
    try {
      // Check for pending bulk-add items
      const result = await client.query(`
        SELECT COUNT(*) as count, source, batch_id
        FROM data_queue 
        WHERE status = 'pending' AND source = 'bulk-add'
        GROUP BY source, batch_id
        ORDER BY MIN(created_at) ASC
        LIMIT 1
      `);
      
      if (result.rows.length > 0 && result.rows[0].count > 0) {
        const batch = result.rows[0];
        console.log(`🔄 Found ${batch.count} pending bulk-add items in batch ${batch.batch_id}`);
        
        // Process the queue
        const QueueProcessor = require('./src/services/QueueProcessor.js');
        const processor = new QueueProcessor();
        const processResult = await processor.processQueue();
        
        console.log(`✅ Workflow processing completed: ${processResult.processed} processed, ${processResult.errors} errors`);
      }
      
    } catch (error) {
      console.error('❌ Error in workflow automation:', error.message);
    } finally {
      client.release();
    }
  }
}

// Auto-start if run directly
if (require.main === module) {
  const workflow = new WorkflowAutomation();
  workflow.start();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down workflow automation...');
    await workflow.stop();
    process.exit(0);
  });
}

module.exports = WorkflowAutomation;
