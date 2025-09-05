
const QueueProcessor = require('./src/services/QueueProcessor.js');

async function main() {
  const processor = new QueueProcessor();
  
  try {
    const result = await processor.processQueue();
    
    if (result.processed > 0) {
      console.log('🎉 Queue processing completed successfully!');
      console.log(`📊 Processed: ${result.processed} items`);
      if (result.errors > 0) {
        console.log(`⚠️  Errors: ${result.errors} items`);
      }
    } else {
      console.log('ℹ️  No items to process');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
