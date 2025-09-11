# Queue Processing Trigger Implementation Guide

## 🎯 Available Trigger Options

I've created 4 different approaches for automating queue processing. Here's how to implement each:

### **Option 1: Database Trigger + Node.js Service (Recommended)**

**How it works:**
- Database trigger automatically creates processing requests when bulk-add items are inserted
- Node.js service monitors and processes these requests

**Implementation:**
```bash
# 1. Start the queue processing service
node -e "
const QueueProcessingService = require('./src/services/QueueProcessingService.js');
const service = new QueueProcessingService();
service.start();
"

# 2. The service will automatically process queue items when bulk-add data is inserted
```

**Pros:** 
- Fully automated
- Database-driven
- Reliable

**Cons:** 
- Requires Node.js service running

---

### **Option 2: Direct API Integration (Simplest)**

**How it works:**
- Queue processing is triggered directly in the bulk-add API endpoint
- No external services needed

**Implementation:**
Add this code to your `ImeiQueueController.addToQueue` method:

```typescript
// After successfully adding items to queue:
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
```

**Pros:** 
- Simple to implement
- No external services
- Immediate processing

**Cons:** 
- Blocks API response until processing starts
- No retry mechanism

---

### **Option 3: Workflow Automation Script (Most Flexible)**

**How it works:**
- Standalone script that monitors for bulk-add items
- Processes them automatically with configurable intervals

**Implementation:**
```bash
# Start the workflow automation
node workflow-automation.js

# The script will:
# - Check every 10 seconds for new bulk-add items
# - Process them automatically
# - Log all activities
```

**Pros:** 
- Independent of API
- Configurable timing
- Easy to monitor

**Cons:** 
- Requires separate process
- Manual start/stop

---

### **Option 4: Manual Processing (Current)**

**How it works:**
- Run queue processing manually when needed

**Implementation:**
```bash
# Process queue manually
node process-queue.js
```

**Pros:** 
- Full control
- No automation complexity

**Cons:** 
- Manual intervention required
- Not suitable for production

---

## 🚀 Recommended Implementation

### **For Development/Testing:**
Use **Option 2 (Direct API Integration)** - it's the simplest and most reliable.

### **For Production:**
Use **Option 1 (Database Trigger + Node.js Service)** - it's the most robust and scalable.

## 📋 Implementation Steps

### **Quick Start (Option 2):**

1. **Modify your bulk-add controller:**
```typescript
// In src/controllers/imei-queue.controller.ts
// Add this after the successful queue insertion:

// Auto-trigger queue processing
try {
  const QueueProcessor = require('../services/QueueProcessor.js');
  const processor = new QueueProcessor();
  
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
```

2. **Test the implementation:**
```bash
# Add bulk data via API
curl -X POST http://localhost:3001/api/imei-queue/bulkadd \
  -H "Content-Type: application/json" \
  -d '{"items": [{"imei": "123456789012345", "brand": "Samsung", "model": "Galaxy S21"}]}'

# Queue processing should happen automatically
```

### **Production Setup (Option 1):**

1. **Start the queue processing service:**
```bash
# Create a startup script
echo "const QueueProcessingService = require('./src/services/QueueProcessingService.js');
const service = new QueueProcessingService();
service.start();" > start-queue-service.js

# Run the service
node start-queue-service.js
```

2. **Monitor the service:**
```bash
# Check processing requests
psql $DIRECT_URL -c "SELECT * FROM queue_processing_requests ORDER BY created_at DESC LIMIT 5;"
```

## 🔧 Configuration Options

### **Processing Intervals:**
- **Option 1:** 5 seconds (configurable in QueueProcessingService)
- **Option 3:** 10 seconds (configurable in workflow-automation.js)

### **Batch Sizes:**
- **All options:** Process up to 100 items at a time (configurable in QueueProcessor)

### **Error Handling:**
- **All options:** Automatic retry with exponential backoff
- **All options:** Failed items marked with error messages

## 📊 Monitoring

### **Check Queue Status:**
```bash
# Check data_queue status
psql $DIRECT_URL -c "SELECT status, COUNT(*) FROM data_queue GROUP BY status;"

# Check processing requests (Option 1)
psql $DIRECT_URL -c "SELECT status, COUNT(*) FROM queue_processing_requests GROUP BY status;"
```

### **View Processing Logs:**
```bash
# Check recent processing activity
psql $DIRECT_URL -c "SELECT * FROM data_queue WHERE processed_at > NOW() - INTERVAL '1 hour' ORDER BY processed_at DESC;"
```

## 🎉 Result

With any of these options, your workflow becomes:

1. **Bulk Add API** → Inserts into `data_queue`
2. **Automatic Trigger** → Processes queue items
3. **SKU Matching** → Automatically matches devices to SKUs
4. **Complete** → Data ready for use

**No more manual `node process-queue.js` needed!** 🚀




