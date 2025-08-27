# Hybrid Queue System Documentation

## Overview

The Hybrid Queue System is a sophisticated data processing solution that combines the best of both worlds:
- **Prisma Schema**: For type safety, structure, and data validation
- **SQL Functions**: For efficient queue processing and performance

This system acts as a **reverse proxy** for data processing, streamlining the flow from bulk-add operations to the database with one-by-one processing.

## Architecture

### Core Components

1. **Queue Storage** (`imei_data_queue` table)
   - Stores raw data with status tracking
   - Supports priority, retry logic, and batch processing
   - Includes comprehensive logging and error handling

2. **Queue Processing Service** (`HybridQueueService`)
   - Manages queue operations using Prisma for type safety
   - Leverages SQL functions for efficient processing
   - Provides continuous background processing

3. **API Layer** (`HybridQueueController`)
   - RESTful endpoints for queue management
   - Real-time statistics and monitoring
   - Batch tracking and progress reporting

### Database Schema

```sql
-- Enhanced Queue Table
CREATE TABLE imei_data_queue (
    id SERIAL PRIMARY KEY,
    raw_data JSONB NOT NULL,           -- Raw unprocessed data
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    priority INTEGER DEFAULT 5,         -- 1=high, 5=normal, 10=low
    retry_count INTEGER DEFAULT 0,      -- Number of retry attempts
    max_retries INTEGER DEFAULT 3,      -- Maximum retry attempts
    source VARCHAR(50),                 -- 'bulk-add', 'single-add', 'api', etc.
    batch_id VARCHAR(50),               -- Group related items together
    error_message TEXT,                 -- Error details for failed items
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP NULL
);

-- Queue Processing Logs
CREATE TABLE queue_processing_log (
    id SERIAL PRIMARY KEY,
    queue_item_id INTEGER,
    action VARCHAR(20),                 -- 'processing', 'completed', 'failed', 'retry'
    message TEXT,
    error TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Queue Batch Tracking
CREATE TABLE queue_batch (
    id SERIAL PRIMARY KEY,
    batch_id VARCHAR(50) UNIQUE,
    source VARCHAR(50),
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### Queue Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/hybrid-queue/add` | Add items to queue |
| `GET` | `/api/hybrid-queue/stats` | Get queue statistics |
| `POST` | `/api/hybrid-queue/process-next` | Process next item |
| `GET` | `/api/hybrid-queue/items` | Get queue items by status |
| `POST` | `/api/hybrid-queue/retry-failed` | Retry failed items |
| `DELETE` | `/api/hybrid-queue/clear-completed` | Clear completed items |

### Batch Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/hybrid-queue/batch/:batchId` | Get batch statistics |

### Processing Control

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/hybrid-queue/start` | Start background processing |
| `POST` | `/api/hybrid-queue/stop` | Stop background processing |

## Usage Examples

### Adding Items to Queue

```javascript
// Add items to queue
const response = await fetch('/api/hybrid-queue/add', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [
      {
        imei: '123456789012345',
        name: 'iPhone 13 Pro',
        brand: 'Apple',
        model: 'iPhone 13 Pro',
        storage: '256GB',
        color: 'Sierra Blue',
        carrier: 'Unlocked',
        location: 'Warehouse A',
        working: 'YES',
        failed: 'NO',
        batteryHealth: '95',
        screenCondition: 'Excellent',
        bodyCondition: 'Good',
        notes: 'Excellent condition'
      }
    ],
    source: 'bulk-add',
    priority: 1
  })
});

const result = await response.json();
console.log('Queue result:', result);
```

### Getting Queue Statistics

```javascript
// Get queue statistics
const statsResponse = await fetch('/api/hybrid-queue/stats');
const stats = await statsResponse.json();

console.log('Queue Stats:', {
  totalItems: stats.data.totalItems,
  pendingItems: stats.data.pendingItems,
  processingItems: stats.data.processingItems,
  completedItems: stats.data.completedItems,
  failedItems: stats.data.failedItems
});
```

### Processing Items

```javascript
// Process next item manually
const processResponse = await fetch('/api/hybrid-queue/process-next', {
  method: 'POST'
});
const processResult = await processResponse.json();

console.log('Processing result:', processResult);
```

## Features

### 1. Priority Processing
- Items with priority 1 are processed first
- Normal priority is 5
- Low priority is 10

### 2. Retry Logic
- Failed items are automatically retried up to 3 times
- Configurable retry count per item
- Exponential backoff for retries

### 3. Batch Tracking
- Each batch gets a unique ID
- Track progress across multiple items
- Monitor batch completion status

### 4. Error Handling
- Comprehensive error logging
- Detailed error messages stored
- Failed items can be retried manually

### 5. Real-time Monitoring
- Live queue statistics
- Processing progress tracking
- Performance metrics

### 6. Flexible Data Processing
- Handles partial data gracefully
- Fallback values for missing fields
- Validates required fields (IMEI)

## Benefits

### 1. **Reliability**
- One-by-one processing prevents database overload
- Automatic retry mechanism for failed items
- Comprehensive error handling and logging

### 2. **Performance**
- SQL functions for efficient queue operations
- Indexed queries for fast retrieval
- Background processing with configurable intervals

### 3. **Scalability**
- Can handle large volumes of data
- Configurable processing strategies
- Batch processing support

### 4. **Type Safety**
- Prisma schema ensures data consistency
- TypeScript interfaces for all operations
- Compile-time error checking

### 5. **Monitoring**
- Real-time progress tracking
- Detailed statistics and metrics
- Processing logs for debugging

### 6. **Flexibility**
- Configurable processing parameters
- Support for different data sources
- Extensible architecture

## Setup Instructions

### 1. Apply Database Migration

```bash
# Run the migration script
node apply-hybrid-queue-migration.js

# Follow the instructions to apply the SQL migration in Supabase
```

### 2. Generate Prisma Client

```bash
npx prisma generate
```

### 3. Start the Server

```bash
npm run dev
```

### 4. Test the System

```bash
node test-hybrid-queue.js
```

## Integration with Existing Systems

### Bulk Add Integration

The hybrid queue system seamlessly integrates with the existing bulk-add functionality:

1. **Bulk Add** → **Queue** → **Processing** → **Database**
2. Raw data is queued instead of processed immediately
3. Background processing handles data insertion
4. Real-time progress tracking available

### Single Add Integration

Single add operations can also use the queue system for consistency:

1. **Single Add** → **Queue** → **Processing** → **Database**
2. Same processing logic for all data sources
3. Unified error handling and logging

## Monitoring and Maintenance

### Queue Health Monitoring

```javascript
// Check queue health
const healthCheck = async () => {
  const stats = await fetch('/api/hybrid-queue/stats').then(r => r.json());
  
  if (stats.data.failedItems > 10) {
    console.warn('High number of failed items detected');
  }
  
  if (stats.data.pendingItems > 100) {
    console.warn('Queue backlog detected');
  }
};
```

### Performance Optimization

1. **Adjust Processing Interval**: Modify `processingInterval` in the service
2. **Batch Size**: Configure batch processing for large datasets
3. **Priority Management**: Use priorities to handle urgent items first
4. **Retry Configuration**: Adjust retry counts and intervals

### Troubleshooting

1. **Check Queue Status**: Use `/api/hybrid-queue/stats`
2. **Review Failed Items**: Use `/api/hybrid-queue/items?status=failed`
3. **Retry Failed Items**: Use `/api/hybrid-queue/retry-failed`
4. **Clear Completed Items**: Use `/api/hybrid-queue/clear-completed`

## Future Enhancements

1. **WebSocket Integration**: Real-time progress updates
2. **Advanced Scheduling**: Time-based processing
3. **Load Balancing**: Multiple processing workers
4. **Analytics Dashboard**: Advanced monitoring interface
5. **Webhook Support**: External notifications
6. **Data Validation**: Enhanced schema validation

## Conclusion

The Hybrid Queue System provides a robust, scalable, and maintainable solution for processing bulk data operations. By combining Prisma's type safety with SQL's performance, it offers the best of both worlds while acting as an efficient reverse proxy for data processing.

This system ensures reliable data processing, comprehensive monitoring, and flexible configuration options, making it ideal for production environments handling large volumes of IMEI data.

