const { EventEmitter } = require('events');

// Simple in-memory queue for testing
class SimpleQueue extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    this.queue = [];
    this.processing = false;
  }

  async add(jobData) {
    const job = {
      id: Date.now() + Math.random(),
      data: jobData,
      createdAt: new Date()
    };

    this.queue.push(job);
    console.log(`✅ Added job to ${this.name} queue: ${job.id}`);
    
    // Start processing if not already running
    if (!this.processing) {
      this.process();
    }
    
    return job;
  }

  async process() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    console.log(`🔄 Starting to process ${this.name} queue...`);
    
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      
      try {
        console.log(`📝 Processing job ${job.id} from ${this.name} queue`);
        
        // Emit job event for processing
        this.emit('job', job);
        
        // Wait a bit to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Error processing job ${job.id}: ${error.message}`);
      }
    }
    
    this.processing = false;
    console.log(`✅ ${this.name} queue processing completed`);
  }

  getStats() {
    return {
      queueName: this.name,
      queueLength: this.queue.length,
      isProcessing: this.processing
    };
  }
}

// Create queue instances
const bulkDataQueue = new SimpleQueue('bulk-data-processing');
const phonecheckQueue = new SimpleQueue('phonecheck-data-processing');

// Set up processors
bulkDataQueue.on('job', async (job) => {
  console.log(`📦 Processing bulk data: ${job.data.items?.length || 0} items`);
  
  // Simulate processing each item
  for (const item of job.data.items || []) {
    console.log(`  📱 Processing IMEI: ${item.imei} - ${item.model}`);
    // Simulate database insert
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`✅ Bulk data job ${job.id} completed`);
});

phonecheckQueue.on('job', async (job) => {
  console.log(`📱 Processing PhoneCheck data for IMEI: ${job.data.imei}`);
  
  // Simulate PhoneCheck API call
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log(`✅ PhoneCheck job ${job.id} completed`);
});

// Test function
async function testSimpleQueue() {
  console.log('🧪 Testing Simple Queue System...\n');
  
  try {
    // Test 1: Add bulk data
    console.log('📦 Testing bulk data queue...');
    const bulkData = {
      source: 'bulk-add',
      batchId: 'test-batch-001',
      items: [
        {
          imei: '111111111111111',
          model: 'iPhone 14 Pro',
          brand: 'Apple',
          working: 'YES'
        },
        {
          imei: '222222222222222',
          model: 'Samsung Galaxy S23',
          brand: 'Samsung',
          working: 'PENDING'
        }
      ]
    };
    
    await bulkDataQueue.add(bulkData);
    
    // Test 2: Add PhoneCheck data
    console.log('\n📱 Testing PhoneCheck queue...');
    const phonecheckData = {
      imei: '333333333333333',
      source: 'phonecheck-api'
    };
    
    await phonecheckQueue.add(phonecheckData);
    
    // Wait for processing
    console.log('\n⏳ Waiting for queue processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Test 3: Get stats
    console.log('\n📊 Queue Statistics:');
    console.log('Bulk Data Queue:', bulkDataQueue.getStats());
    console.log('PhoneCheck Queue:', phonecheckQueue.getStats());
    
    console.log('\n🎉 Simple queue system test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run test
testSimpleQueue();
