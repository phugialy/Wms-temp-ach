
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

class QueueProcessingService {
  constructor() {
    this.isProcessing = false;
    this.processingInterval = null;
  }
  
  async start() {
    console.log('🚀 Starting queue processing service...');
    
    // Check for processing requests every 5 seconds
    this.processingInterval = setInterval(async () => {
      await this.checkAndProcess();
    }, 5000);
  }
  
  async stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    console.log('⏹️  Queue processing service stopped');
  }
  
  async checkAndProcess() {
    if (this.isProcessing) return;
    
    const client = await pool.connect();
    try {
      // Check for pending processing requests
      const requests = await client.query(`
        SELECT * FROM queue_processing_requests 
        WHERE status = 'pending' 
        ORDER BY created_at ASC 
        LIMIT 1
      `);
      
      if (requests.rows.length > 0) {
        this.isProcessing = true;
        const request = requests.rows[0];
        
        console.log(`🔄 Processing queue request: ${request.batch_id} (${request.item_count} items)`);
        
        // Mark as processing
        await client.query(`
          UPDATE queue_processing_requests 
          SET status = 'processing', updated_at = NOW() 
          WHERE id = $1
        `, [request.id]);
        
        // Process the queue
        const QueueProcessor = require('./src/services/QueueProcessor.js');
        const processor = new QueueProcessor();
        const result = await processor.processQueue();
        
        // Mark as completed
        await client.query(`
          UPDATE queue_processing_requests 
          SET status = 'completed', processed_at = NOW(), updated_at = NOW() 
          WHERE id = $1
        `, [request.id]);
        
        console.log(`✅ Queue processing completed: ${result.processed} processed, ${result.errors} errors`);
        
      }
    } catch (error) {
      console.error('❌ Error in queue processing:', error.message);
    } finally {
      this.isProcessing = false;
      client.release();
    }
  }
}

module.exports = QueueProcessingService;
