const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function createQueueProcessingTriggers() {
  const client = await pool.connect();
  try {
    console.log('🔧 Creating queue processing triggers...');
    
    // Option 1: Database Function + Trigger (Recommended)
    console.log('\n📋 Option 1: Database Function + Trigger');
    
    const databaseTriggerFunction = `
      CREATE OR REPLACE FUNCTION trigger_queue_processing()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Only trigger on bulk-add source
        IF NEW.source = 'bulk-add' AND NEW.status = 'pending' THEN
          -- Insert into a processing queue table to trigger Node.js processing
          INSERT INTO queue_processing_requests (batch_id, item_count, status, created_at)
          VALUES (
            COALESCE(NEW.batch_id, 'single_' || NEW.id),
            1,
            'pending',
            NOW()
          )
          ON CONFLICT (batch_id) DO UPDATE SET
            item_count = queue_processing_requests.item_count + 1,
            updated_at = NOW();
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    await client.query(databaseTriggerFunction);
    console.log('✅ Database trigger function created');
    
    // Create processing requests table
    const createProcessingTable = `
      CREATE TABLE IF NOT EXISTS queue_processing_requests (
        id SERIAL PRIMARY KEY,
        batch_id VARCHAR(255) UNIQUE NOT NULL,
        item_count INTEGER DEFAULT 1,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        processed_at TIMESTAMP WITH TIME ZONE
      );
    `;
    
    await client.query(createProcessingTable);
    console.log('✅ Processing requests table created');
    
    // Create trigger
    const createTrigger = `
      CREATE TRIGGER trigger_auto_queue_processing
      AFTER INSERT ON data_queue
      FOR EACH ROW
      EXECUTE FUNCTION trigger_queue_processing();
    `;
    
    await client.query(createTrigger);
    console.log('✅ Database trigger created');
    
    // Option 2: Node.js Service Integration
    console.log('\n📋 Option 2: Node.js Service Integration');
    
    const nodejsService = `
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
      const requests = await client.query(\`
        SELECT * FROM queue_processing_requests 
        WHERE status = 'pending' 
        ORDER BY created_at ASC 
        LIMIT 1
      \`);
      
      if (requests.rows.length > 0) {
        this.isProcessing = true;
        const request = requests.rows[0];
        
        console.log(\`🔄 Processing queue request: \${request.batch_id} (\${request.item_count} items)\`);
        
        // Mark as processing
        await client.query(\`
          UPDATE queue_processing_requests 
          SET status = 'processing', updated_at = NOW() 
          WHERE id = $1
        \`, [request.id]);
        
        // Process the queue
        const QueueProcessor = require('./src/services/QueueProcessor.js');
        const processor = new QueueProcessor();
        const result = await processor.processQueue();
        
        // Mark as completed
        await client.query(\`
          UPDATE queue_processing_requests 
          SET status = 'completed', processed_at = NOW(), updated_at = NOW() 
          WHERE id = $1
        \`, [request.id]);
        
        console.log(\`✅ Queue processing completed: \${result.processed} processed, \${result.errors} errors\`);
        
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
`;
    
    require('fs').writeFileSync('src/services/QueueProcessingService.js', nodejsService);
    console.log('✅ QueueProcessingService created');
    
    // Option 3: Direct API Integration
    console.log('\n📋 Option 3: Direct API Integration');
    
    const apiIntegration = `
// Add this to your ImeiQueueController.addToQueue method
// After successfully adding items to queue:

// Trigger queue processing
try {
  const QueueProcessor = require('../services/QueueProcessor.js');
  const processor = new QueueProcessor();
  
  // Process in background (non-blocking)
  setImmediate(async () => {
    try {
      const result = await processor.processQueue();
      logger.info('Auto queue processing completed', { 
        processed: result.processed, 
        errors: result.errors 
      });
    } catch (error) {
      logger.error('Auto queue processing failed', { error: error.message });
    }
  });
  
} catch (error) {
  logger.error('Failed to trigger queue processing', { error: error.message });
}
`;
    
    require('fs').writeFileSync('api-integration-example.js', apiIntegration);
    console.log('✅ API integration example created');
    
    // Option 4: Workflow Automation Script
    console.log('\n📋 Option 4: Workflow Automation Script');
    
    const workflowScript = `
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
      const result = await client.query(\`
        SELECT COUNT(*) as count, source, batch_id
        FROM data_queue 
        WHERE status = 'pending' AND source = 'bulk-add'
        GROUP BY source, batch_id
        ORDER BY MIN(created_at) ASC
        LIMIT 1
      \`);
      
      if (result.rows.length > 0 && result.rows[0].count > 0) {
        const batch = result.rows[0];
        console.log(\`🔄 Found \${batch.count} pending bulk-add items in batch \${batch.batch_id}\`);
        
        // Process the queue
        const QueueProcessor = require('./src/services/QueueProcessor.js');
        const processor = new QueueProcessor();
        const processResult = await processor.processQueue();
        
        console.log(\`✅ Workflow processing completed: \${processResult.processed} processed, \${processResult.errors} errors\`);
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
    console.log('\\n🛑 Shutting down workflow automation...');
    await workflow.stop();
    process.exit(0);
  });
}

module.exports = WorkflowAutomation;
`;
    
    require('fs').writeFileSync('workflow-automation.js', workflowScript);
    console.log('✅ Workflow automation script created');
    
    // Test the database trigger
    console.log('\n🧪 Testing database trigger...');
    
    const testData = {
      imei: '999999999999999',
      brand: 'Samsung',
      model: 'Galaxy S21',
      working: 'YES',
      carrier: 'Verizon',
      storage: '256GB',
      color: 'Black'
    };
    
    const testResult = await client.query(`
      INSERT INTO data_queue (raw_data, status, source, batch_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [testData, 'pending', 'bulk-add', 'test_batch_123']);
    
    console.log(`✅ Test item inserted: ID ${testResult.rows[0].id}`);
    
    // Check if trigger created processing request
    const processingRequest = await client.query(`
      SELECT * FROM queue_processing_requests 
      WHERE batch_id = 'test_batch_123'
    `);
    
    if (processingRequest.rows.length > 0) {
      console.log('✅ Database trigger working - processing request created');
    } else {
      console.log('❌ Database trigger not working');
    }
    
    // Clean up test data
    await client.query(`DELETE FROM queue_processing_requests WHERE batch_id = 'test_batch_123'`);
    await client.query(`DELETE FROM data_queue WHERE id = $1`, [testResult.rows[0].id]);
    
    console.log('\n🎉 All trigger options created successfully!');
    console.log('\n📋 Available Options:');
    console.log('1. Database Trigger + Node.js Service (Recommended)');
    console.log('2. Direct API Integration (Simplest)');
    console.log('3. Workflow Automation Script (Most Flexible)');
    console.log('4. Manual Processing (Current)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createQueueProcessingTriggers();


