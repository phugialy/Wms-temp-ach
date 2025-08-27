# Queue System Design for Bulk Data Processing

## Overview
A queue-based system to handle bulk data processing reliably, processing one item at a time to avoid overwhelming the database and ensure data integrity.

## Architecture

### 1. Queue Storage (Database Table)
```sql
-- imei_data_queue table (already exists)
CREATE TABLE imei_data_queue (
    id SERIAL PRIMARY KEY,
    raw_data JSONB NOT NULL,           -- Raw unprocessed data
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    priority INTEGER DEFAULT 5,         -- 1=high, 5=normal, 10=low
    retry_count INTEGER DEFAULT 0,      -- Number of retry attempts
    max_retries INTEGER DEFAULT 3,      -- Maximum retry attempts
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP NULL,
    error_message TEXT NULL,
    source VARCHAR(50) NULL,           -- 'bulk-add', 'single-add', 'api', etc.
    batch_id VARCHAR(50) NULL          -- Group related items together
);
```

### 2. Queue Processing Service
```typescript
// QueueProcessorService with enhanced features
class QueueProcessorService {
  // Process one item at a time
  async processNextItem(): Promise<ProcessResult>
  
  // Process items in batches (configurable)
  async processBatch(batchSize: number): Promise<BatchResult>
  
  // Process all pending items
  async processAllPending(): Promise<ProcessResult>
  
  // Retry failed items
  async retryFailedItems(): Promise<RetryResult>
  
  // Get queue statistics
  async getQueueStats(): Promise<QueueStats>
}
```

### 3. Queue Worker (Background Processing)
```typescript
// QueueWorker - runs continuously in background
class QueueWorker {
  private isRunning: boolean = false;
  private processingInterval: number = 1000; // 1 second
  
  async start(): Promise<void>
  async stop(): Promise<void>
  async processNextItem(): Promise<void>
}
```

## Implementation Approach

### Phase 1: Enhanced Queue Service
1. **Add to Queue**: Bulk-add puts raw data into queue
2. **Queue Processing**: Background worker processes one item at a time
3. **Status Tracking**: Monitor progress and handle failures
4. **Retry Logic**: Automatic retry for failed items

### Phase 2: Real-time Processing
1. **Immediate Processing**: Process items as they're added
2. **Batch Processing**: Process multiple items in controlled batches
3. **Priority System**: Handle high-priority items first

### Phase 3: Advanced Features
1. **Progress Tracking**: Real-time progress updates
2. **Error Recovery**: Sophisticated error handling
3. **Performance Monitoring**: Queue health metrics

## API Endpoints

### Queue Management
```
POST /api/queue/add              - Add items to queue
GET  /api/queue/stats            - Get queue statistics
POST /api/queue/process-next     - Process next item
POST /api/queue/process-batch    - Process batch of items
POST /api/queue/retry-failed     - Retry failed items
GET  /api/queue/items            - Get queue items by status
DELETE /api/queue/clear-completed - Clear completed items
```

### Processing Control
```
POST /api/queue/worker/start     - Start background worker
POST /api/queue/worker/stop      - Stop background worker
GET  /api/queue/worker/status    - Get worker status
```

## Benefits

1. **Reliability**: One-by-one processing prevents database overload
2. **Error Handling**: Failed items can be retried automatically
3. **Scalability**: Can handle large volumes of data
4. **Monitoring**: Real-time progress tracking
5. **Flexibility**: Configurable processing strategies
6. **Recovery**: System can resume after interruptions

## Implementation Steps

1. **Enhance Queue Table**: Add priority, retry, batch_id fields
2. **Create Queue Worker**: Background processing service
3. **Update Bulk Add**: Put raw data in queue instead of direct processing
4. **Add Processing APIs**: Endpoints for queue management
5. **Implement Monitoring**: Progress tracking and error reporting
6. **Add UI Components**: Queue status dashboard

